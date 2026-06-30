'use server'

import { revalidatePath } from 'next/cache'
import { batchInsert, saveRecord, listContractors, listOrganizations, listTrips } from '@/lib/db'
import type { ImportResult, ImportOptions } from '@/lib/import-types'

export async function importTrips(rows: Record<string, string>[], opts: ImportOptions = {}): Promise<ImportResult> {
  const status = opts.status === 'booked' ? 'booked' : 'completed'

  // --- 1. Resolve dates robustly (Excel serials + day/month-swap auto-correct) ---
  // Find the dominant month across the sheet, then nudge stray rows into it.
  const decoded = rows.map((r) => decodeDate(r.trip_date))
  const monthTally = new Map<string, number>()
  for (const d of decoded) if (d) { const ym = d.slice(0, 7); monthTally.set(ym, (monthTally.get(ym) ?? 0) + 1) }
  let dominant = ''
  let best = 0
  for (const [ym, n] of monthTally) if (n > best) { best = n; dominant = ym }

  let dateFixes = 0
  const resolveDate = (raw: string): string => {
    const d = decodeDate(raw)
    if (!d) return ''
    if (!dominant || d.startsWith(dominant)) return d
    const swapped = swapMonthDay(d)             // BCD sheets sometimes store day/month swapped
    if (isValidDate(swapped) && swapped.startsWith(dominant)) { dateFixes++; return swapped }
    return d
  }

  // --- 2. Ensure referenced contractors & organizations exist, map names→ids ---
  const wantedCon = new Set<string>(), wantedOrg = new Set<string>()
  for (const r of rows) {
    const c = (r.contractor || '').trim(); if (c) wantedCon.add(c)
    const o = (r.organization || '').trim().replace(/\s+/g, ' '); if (o) wantedOrg.add(o)
  }
  let contractors = await listContractors()
  let organizations = await listOrganizations()
  const hasCon = (n: string) => contractors.some((c) => c.name.toLowerCase() === n.toLowerCase())
  const hasOrg = (n: string) => organizations.some((o) => o.name.toLowerCase() === n.toLowerCase())
  let createdLookups = false
  for (const n of wantedCon) if (!hasCon(n)) { await saveRecord('contractors', { name: n }, null); createdLookups = true }
  for (const n of wantedOrg) if (!hasOrg(n)) { await saveRecord('organizations', { name: n }, null); createdLookups = true }
  if (createdLookups) { contractors = await listContractors(); organizations = await listOrganizations() }
  const conId = (n: string) => contractors.find((c) => c.name.toLowerCase() === n.trim().toLowerCase())?.id ?? null
  const orgId = (n: string) => organizations.find((o) => o.name.toLowerCase() === n.trim().toLowerCase())?.id ?? null

  // --- 3. Dedup against existing trips in the imported date range ---
  const allDates = rows.map((r) => resolveDate(r.trip_date)).filter(Boolean).sort()
  dateFixes = 0 // reset (the pass above also counted; recount during the real loop)
  const existing = allDates.length ? await listTrips(allDates[0], allDates[allDates.length - 1]) : []
  const sig = (date: string, client: string, pickup: string, dropoff: string) =>
    `${date}|${client.toLowerCase()}|${pickup.toLowerCase()}|${dropoff.toLowerCase()}`
  const seen = new Set(existing.map((t) => sig(t.trip_date, t.client_name ?? '', t.pickup ?? '', t.dropoff ?? '')))

  // --- 4. Build the batch, skipping junk and rescuing nameless-but-paid rows ---
  let skippedCancelled = 0, skippedNoDate = 0, dupes = 0, namedFixed = 0
  const batch: Record<string, unknown>[] = []
  for (const r of rows) {
    const notes = (r.notes || '').trim()
    let client_name = (r.client_name || '').trim()
    const amount = num(r.amount)

    // Cancelled / not-run jobs are noise — drop them.
    if (isCancelled(client_name, notes) && amount <= 0) { skippedCancelled++; continue }

    const trip_date = resolveDate(r.trip_date)
    if (!trip_date) { skippedNoDate++; continue }

    // A row with money but no name is a real trip with a data gap — keep with a placeholder.
    if (!client_name) {
      if (amount > 0) { client_name = '(client not listed)'; namedFixed++ }
      else { skippedCancelled++; continue }
    }

    const pickup = (r.pickup || '').trim()
    const dropoff = (r.dropoff || '').trim()
    const key = sig(trip_date, client_name, pickup, dropoff)
    if (seen.has(key)) { dupes++; continue }
    seen.add(key)

    batch.push({
      trip_date, client_name,
      slip_no: emptyToNull(r.slip_no),
      pickup: emptyToNull(r.pickup),
      pickup_time: normalizeTime(r.pickup_time),
      dropoff: emptyToNull(r.dropoff),
      notes: emptyToNull(r.notes),
      express_charges: num(r.express_charges),
      voucher_no: emptyToNull(r.voucher_no),
      organization_id: r.organization ? orgId(r.organization) : null,
      contractor_id: r.contractor ? conId(r.contractor) : null,
      amount,
      payment: 'account',
      status,
    })
  }
  await batchInsert('trips', batch)
  const created = batch.length
  revalidatePath('/trips'); revalidatePath('/dispatch')

  const where = status === 'booked' ? 'as bookings (assign them in Dispatch)' : 'as completed trips'
  const notes = [
    dateFixes ? `auto-corrected ${dateFixes} swapped date${dateFixes === 1 ? '' : 's'}` : '',
    namedFixed ? `${namedFixed} had no client name (kept as “(client not listed)”)` : '',
    skippedCancelled ? `skipped ${skippedCancelled} cancelled/blank` : '',
    skippedNoDate ? `skipped ${skippedNoDate} with no valid date` : '',
    dupes ? `skipped ${dupes} duplicate${dupes === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' · ')
  return {
    created, skipped: skippedCancelled + skippedNoDate + dupes,
    message: `Imported ${created} trip${created === 1 ? '' : 's'} ${where}.${notes ? ` (${notes})` : ''}`,
  }
}

// ---- helpers ----
function num(v: string): number {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}
function emptyToNull(v: string): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
// Normalise a time cell to "HH:MM": accepts "HH:MM[:SS]", "h:mm am/pm", or an
// Excel time fraction (0–1 of a day).
function normalizeTime(v: string): string | null {
  const s = String(v ?? '').trim()
  if (!s) return null
  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i)
  if (ampm) {
    let h = Number(ampm[1]); const m = ampm[2]; const ap = ampm[3]?.toLowerCase()
    if (ap === 'pm' && h < 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, '0')}:${m}`
  }
  const frac = Number(s)
  if (Number.isFinite(frac) && frac > 0 && frac < 1) {
    const mins = Math.round(frac * 24 * 60)
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
  }
  return null
}
const CANCEL_RE = /\b(not\s*done|cancel|no\s*show)\b/i
function isCancelled(client: string, notes: string): boolean {
  return CANCEL_RE.test(`${client} ${notes}`)
}
// Excel serial (days since 1899-12-30) → ISO date.
function serialToISO(n: number): string {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10)
}
function swapMonthDay(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${y}-${(d || '').padStart(2, '0')}-${(m || '').padStart(2, '0')}`
}
function isValidDate(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`)
  return !isNaN(d.getTime()) && iso === d.toISOString().slice(0, 10)
}
// Decode ISO, Kenyan DD/MM/YYYY, Excel serials, and general date strings → ISO (no swap).
function decodeDate(v: string): string {
  const s = String(v ?? '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const slash = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (slash) {
    let [, d, m, y] = slash
    if (y.length === 2) y = '20' + y
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  if (/^\d{4,6}$/.test(s)) return serialToISO(Number(s)) // bare Excel serial
  const dt = new Date(s)
  return Number.isFinite(dt.getTime()) ? dt.toISOString().slice(0, 10) : ''
}
