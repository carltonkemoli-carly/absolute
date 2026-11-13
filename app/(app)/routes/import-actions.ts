'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, listRoutes } from '@/lib/db'
import { requireFinance } from '@/lib/auth'
import type { ImportResult } from '@/lib/import-types'

export async function importRoutes(rows: Record<string, string>[]): Promise<ImportResult> {
  await requireFinance()
  const existing = await listRoutes()
  const key = (p: string, d: string) => `${p.toLowerCase().trim()}→${d.toLowerCase().trim()}`
  const byKey = new Map(existing.map((r) => [key(r.pickup, r.dropoff), r.id]))

  let created = 0, updated = 0, skipped = 0
  for (const r of rows) {
    const pickup = (r.pickup || '').trim()
    const dropoff = (r.dropoff || '').trim()
    if (!pickup || !dropoff) { skipped++; continue }
    const row = {
      pickup, dropoff,
      price_saloon: num(r.price_saloon), price_wagon: num(r.price_wagon),
      price_van: num(r.price_van), price_bus: num(r.price_bus),
      active: true, notes: emptyToNull(r.notes),
    }
    const id = byKey.get(key(pickup, dropoff))
    const { error } = await saveRecord('routes', row, id || null)
    if (error) throw new Error(error)
    if (id) updated++
    else created++
  }
  revalidatePath('/routes')
  return {
    created, skipped,
    message: `Imported ${created} new route${created === 1 ? '' : 's'}${updated ? `, updated ${updated}` : ''}${skipped ? `, skipped ${skipped}` : ''}.`,
  }
}

function num(v: string): number {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}
function emptyToNull(v: string): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
