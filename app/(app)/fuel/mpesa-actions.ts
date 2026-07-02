'use server'

import { revalidatePath } from 'next/cache'
import { batchInsert, listFuel } from '@/lib/db'
import type { ImportResult, ImportOptions } from '@/lib/import-types'

// Kenyan petrol brands / fuel keywords seen in M-Pesa "Details".
const STATION_RE = /(shell|total ?energ|totalenergies|\btotal\b|rubis|oil ?libya|oilibya|petro|gulf ?energ|astrol|hashi|hass|ola ?energ|national oil|galana|be ?energy|lake ?oil|texas|engen|vivo|kobil|delta|olympic|\bfuel\b|filling station|service station|petrol|\benergy\b)/i

function num(v: string): number {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? Math.abs(n) : 0
}
function toISODate(v: string): string {
  const s = String(v ?? '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (dmy) { let [, d, m, y] = dmy; if (y.length === 2) y = '20' + y; return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` }
  const dt = new Date(s)
  return Number.isFinite(dt.getTime()) ? dt.toISOString().slice(0, 10) : ''
}
function stationName(details: string): string | null {
  const s = String(details ?? '').trim()
  const dash = s.match(/-\s*([^-]+)$/)          // "…to 174379 - SHELL KAREN"
  const name = (dash ? dash[1] : s).trim()
  return name || null
}

// Import fuel payments out of an M-Pesa statement (as rows). Detects payments to
// petrol stations and records them as fuel (no vehicle — she pays the station).
export async function importMpesaFuel(rows: Record<string, string>[], opts: ImportOptions = {}): Promise<ImportResult> {
  const detectAll = opts.detect === 'all'

  const dates = rows.map((r) => toISODate(r.date)).filter(Boolean).sort()
  const existing = dates.length ? await listFuel(dates[0], dates[dates.length - 1]) : []
  const seenRef = new Set(existing.map((f) => f.mpesa_ref).filter(Boolean) as string[])

  let created = 0, skippedNonFuel = 0, dupes = 0, skippedBad = 0, total = 0
  const batch: Record<string, unknown>[] = []
  for (const r of rows) {
    const details = (r.details || '').trim()
    const amount = num(r.amount)
    const fuel_date = toISODate(r.date)
    const ref = (r.reference || '').trim()

    if (!fuel_date || amount <= 0) { skippedBad++; continue }
    const isFuel = detectAll ? true : STATION_RE.test(details)
    if (!isFuel) { skippedNonFuel++; continue }
    if (ref && seenRef.has(ref)) { dupes++; continue }
    if (ref) seenRef.add(ref)

    batch.push({
      fuel_date, amount,
      vehicle_id: null, driver_id: null,
      station: stationName(details),
      mpesa_ref: ref || null,
      notes: 'Imported from M-Pesa statement',
    })
    created++; total += amount
  }
  await batchInsert('fuel_entries', batch)
  revalidatePath('/fuel'); revalidatePath('/')

  const notes = [
    skippedNonFuel ? `${skippedNonFuel} non-fuel skipped` : '',
    dupes ? `${dupes} already imported` : '',
    skippedBad ? `${skippedBad} unreadable` : '',
  ].filter(Boolean).join(' · ')
  return {
    created, skipped: skippedNonFuel + dupes + skippedBad,
    message: `Imported ${created} fuel payment${created === 1 ? '' : 's'} totalling KES ${Math.round(total).toLocaleString()}${notes ? ` (${notes})` : ''}. Assign vehicles later if you know them.`,
  }
}
