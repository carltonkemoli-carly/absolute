'use server'

import { revalidatePath } from 'next/cache'
import { batchInsert, saveRecord, listContractors, listOrganizations, listTrips } from '@/lib/db'
import type { ImportResult } from '@/lib/import-types'

export async function importTrips(rows: Record<string, string>[]): Promise<ImportResult> {
  // Ensure all referenced contractors & organizations exist, then map names→ids.
  const wantedCon = new Set<string>()
  const wantedOrg = new Set<string>()
  for (const r of rows) {
    const c = (r.contractor || '').trim(); if (c) wantedCon.add(c)
    const o = (r.organization || '').trim(); if (o) wantedOrg.add(o)
  }

  let contractors = await listContractors()
  let organizations = await listOrganizations()
  const hasCon = (n: string) => contractors.some((c) => c.name.toLowerCase() === n.toLowerCase())
  const hasOrg = (n: string) => organizations.some((o) => o.name.toLowerCase() === n.toLowerCase())

  let createdLookups = false
  for (const n of wantedCon) if (!hasCon(n)) { await saveRecord('contractors', { name: n }, null); createdLookups = true }
  for (const n of wantedOrg) if (!hasOrg(n)) { await saveRecord('organizations', { name: n }, null); createdLookups = true }
  if (createdLookups) {
    contractors = await listContractors()
    organizations = await listOrganizations()
  }
  const conId = (n: string) => contractors.find((c) => c.name.toLowerCase() === n.trim().toLowerCase())?.id ?? null
  const orgId = (n: string) => organizations.find((o) => o.name.toLowerCase() === n.trim().toLowerCase())?.id ?? null

  // Build a set of existing trips (across the date range of this import) to skip duplicates.
  const dates = rows.map((r) => parseDate(r.trip_date)).filter(Boolean).sort()
  const existing = dates.length ? await listTrips(dates[0], dates[dates.length - 1]) : []
  const sig = (date: string, client: string, pickup: string, dropoff: string) =>
    `${date}|${client.toLowerCase()}|${pickup.toLowerCase()}|${dropoff.toLowerCase()}`
  const seen = new Set(existing.map((t) => sig(t.trip_date, t.client_name ?? '', t.pickup ?? '', t.dropoff ?? '')))

  let skipped = 0, dupes = 0
  const batch: Record<string, unknown>[] = []
  for (const r of rows) {
    const client_name = (r.client_name || '').trim()
    const trip_date = parseDate(r.trip_date)
    if (!client_name || !trip_date) { skipped++; continue }
    const pickup = (r.pickup || '').trim()
    const dropoff = (r.dropoff || '').trim()
    const key = sig(trip_date, client_name, pickup, dropoff)
    if (seen.has(key)) { dupes++; continue } // already imported — don't pile up duplicates
    seen.add(key)
    batch.push({
      trip_date,
      client_name,
      slip_no: emptyToNull(r.slip_no),
      pickup: emptyToNull(r.pickup),
      dropoff: emptyToNull(r.dropoff),
      notes: emptyToNull(r.notes),
      express_charges: num(r.express_charges),
      voucher_no: emptyToNull(r.voucher_no),
      organization_id: r.organization ? orgId(r.organization) : null,
      contractor_id: r.contractor ? conId(r.contractor) : null,
      amount: num(r.amount),
      payment: 'account',
      status: 'booked', // new jobs land unassigned, ready for the dispatch board
    })
  }
  await batchInsert('trips', batch)
  const created = batch.length
  revalidatePath('/trips')
  revalidatePath('/dispatch')
  const extras = [
    skipped ? `${skipped} skipped (missing date/client)` : '',
    dupes ? `${dupes} duplicate${dupes === 1 ? '' : 's'} skipped` : '',
  ].filter(Boolean).join(', ')
  return {
    created, skipped,
    message: `Imported ${created} trip${created === 1 ? '' : 's'} as bookings${extras ? ` (${extras})` : ''}. Assign them in Dispatch.`,
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
// Handles ISO (YYYY-MM-DD), Kenyan DD/MM/YYYY, and general date strings.
function parseDate(v: string): string {
  const s = String(v ?? '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const slash = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (slash) {
    let [, d, m, y] = slash
    if (y.length === 2) y = '20' + y
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const dt = new Date(s)
  return Number.isFinite(dt.getTime()) ? dt.toISOString().slice(0, 10) : ''
}
