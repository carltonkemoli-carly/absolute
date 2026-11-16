// Calculations behind the management dashboard. Pure and self-contained (type
// imports only) so they can be tested without a database or a browser.
import type { Contractor, Invoice } from '@/lib/types'

const DAY = 86400000

const outstandingOf = (invoice: Invoice): number =>
  Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid))

// Whole days past the due date. Zero when settled, not yet due, due today, or
// when the invoice has no usable due date.
export function daysLate(invoice: Invoice, today: string): number {
  if (outstandingOf(invoice) <= 0 || !invoice.due_date) return 0
  const days = Math.round((Date.parse(today) - Date.parse(invoice.due_date)) / DAY)
  return Number.isFinite(days) && days > 0 ? days : 0
}

export type AgingKey = 'current' | 'late30' | 'late60' | 'older'
export interface AgingBucket { key: AgingKey; label: string; amount: number; count: number }

// Who owes what, by how late it is. The buckets always come back in the same
// order, including empty ones, so a chart keeps its shape month to month.
export function agingBuckets(invoices: Invoice[], today: string): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { key: 'current', label: 'Not yet due', amount: 0, count: 0 },
    { key: 'late30', label: '1–30 days late', amount: 0, count: 0 },
    { key: 'late60', label: '31–60 days late', amount: 0, count: 0 },
    { key: 'older', label: 'Over 60 days late', amount: 0, count: 0 },
  ]
  for (const invoice of invoices) {
    const owed = outstandingOf(invoice)
    if (owed <= 0) continue
    const late = daysLate(invoice, today)
    const bucket = buckets[late === 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : 3]
    bucket.amount += owed
    bucket.count++
  }
  return buckets
}

export interface Debtor {
  contractorId: string | null
  name: string
  outstanding: number
  overdue: number
  oldestDaysLate: number
  invoices: number
}

// One row per supplier that still owes money, largest balance first.
export function debtors(invoices: Invoice[], contractors: Contractor[], today: string): Debtor[] {
  const names = new Map(contractors.map((contractor) => [contractor.id, contractor.name]))
  const rows = new Map<string, Debtor>()
  for (const invoice of invoices) {
    const owed = outstandingOf(invoice)
    if (owed <= 0) continue
    const key = invoice.contractor_id ?? ''
    const row = rows.get(key) ?? {
      contractorId: invoice.contractor_id ?? null,
      name: names.get(key) ?? 'Direct / no supplier',
      outstanding: 0, overdue: 0, oldestDaysLate: 0, invoices: 0,
    }
    const late = daysLate(invoice, today)
    row.outstanding += owed
    row.invoices++
    if (late > 0) { row.overdue += owed; row.oldestDaysLate = Math.max(row.oldestDaysLate, late) }
    rows.set(key, row)
  }
  return Array.from(rows.values()).sort((a, b) => b.outstanding - a.outstanding)
}

// Change against a previous figure, as a fraction (0.12 = up 12%). Null when
// there is nothing to compare with, so the UI can say so instead of "+∞%".
export function change(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous <= 0) return null
  return (current - previous) / previous
}

// A month still in progress must not be compared with a whole month — it always
// reads as a collapse. While the selected month is running, measure the previous
// month only up to the same day number (clamped to that month's length).
export function comparisonWindow(
  selected: { start: string; end: string },
  previous: { start: string; end: string },
  today: string,
): { cutoff: string; partial: boolean } {
  const partial = today >= selected.start && today < selected.end
  if (!partial) return { cutoff: previous.end, partial: false }
  const sameDay = previous.start.slice(0, 8) + today.slice(8, 10)
  return { cutoff: sameDay > previous.end ? previous.end : sameDay, partial: true }
}
