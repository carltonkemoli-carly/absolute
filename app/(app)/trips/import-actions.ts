'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, listContractors, listOrganizations } from '@/lib/db'
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

  let created = 0, skipped = 0
  for (const r of rows) {
    const client_name = (r.client_name || '').trim()
    const trip_date = parseDate(r.trip_date)
    if (!client_name || !trip_date) { skipped++; continue }
    await saveRecord('trips', {
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
    }, null)
    created++
  }
  revalidatePath('/trips')
  revalidatePath('/dispatch')
  return {
    created, skipped,
    message: `Imported ${created} trip${created === 1 ? '' : 's'} as bookings${skipped ? `, skipped ${skipped} (missing date/client)` : ''}. Assign them in Dispatch.`,
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
