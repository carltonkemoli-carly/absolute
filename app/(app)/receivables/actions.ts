'use server'

import { revalidatePath } from 'next/cache'
import {
  saveRecord, deleteRecord, listContractorTrips,
  findInvoiceForPeriod, createInvoiceForTrips, clearInvoiceTrips,
} from '@/lib/db'
import { requireFinance } from '@/lib/auth'
import { isoDate, addDays } from '@/lib/format'

// month is "YYYY-MM" → first/last day of that month.
function monthRange(month: string): { start: string; end: string; label: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2])
  if (mo < 1 || mo > 12) return null
  const start = `${m[1]}-${m[2]}-01`
  const last = new Date(y, mo, 0).getDate() // day 0 of next month = last day of this month
  const end = `${m[1]}-${m[2]}-${String(last).padStart(2, '0')}`
  const label = new Date(y, mo - 1, 1).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
  return { start, end, label }
}

export type InvoicePreview = {
  ok: boolean
  message?: string
  count: number
  total: number
  start: string
  end: string
  label: string
  alreadyBilled?: number   // trips in this period already on another invoice
  duplicate?: boolean      // this contractor-period has been invoiced before
}

// Preview what a trip-generated invoice would contain before creating it, including
// anything already billed — so she sees the duplicate before it exists, not after.
export async function previewInvoiceFromTrips(contractorId: string, month: string): Promise<InvoicePreview> {
  await requireFinance()
  const empty = { ok: false, count: 0, total: 0, start: '', end: '', label: '' }
  if (!contractorId) return { ...empty, message: 'Pick a contractor.' }
  const r = monthRange(month)
  if (!r) return { ...empty, message: 'Pick a month.' }

  const [trips, existing] = await Promise.all([
    listContractorTrips(contractorId, r.start, r.end),
    findInvoiceForPeriod(contractorId, r.start, r.end),
  ])
  if (trips.length === 0) {
    return { ...empty, start: r.start, end: r.end, label: r.label, message: `No trips logged for this contractor in ${r.label}.` }
  }

  const unbilled = trips.filter((t) => !t.invoice_id)
  const alreadyBilled = trips.length - unbilled.length
  const total = unbilled.reduce((s, t) => s + Number(t.amount ?? 0), 0)

  if (existing) {
    return {
      ...empty, start: r.start, end: r.end, label: r.label, duplicate: true, alreadyBilled,
      message: `${r.label} has already been invoiced for this contractor${existing.invoice_no ? ` (${existing.invoice_no})` : ''}. Delete that invoice first if you need to re-issue it.`,
    }
  }
  if (unbilled.length === 0) {
    return {
      ...empty, start: r.start, end: r.end, label: r.label, alreadyBilled,
      message: `All ${trips.length} trips in ${r.label} are already on an invoice.`,
    }
  }
  return { ok: true, count: unbilled.length, total, start: r.start, end: r.end, label: r.label, alreadyBilled }
}

// Create an invoice from a contractor's un-billed trips in a month, and stamp the
// invoice onto those trips so they can never be billed a second time.
export async function generateInvoiceFromTrips(formData: FormData) {
  await requireFinance()
  const contractor_id = emptyToNull(formData.get('contractor_id'))
  const month = String(formData.get('month') || '')
  const invoice_no = emptyToNull(formData.get('invoice_no'))
  const dueDays = num(formData.get('due_days')) || 30
  if (!contractor_id) return
  const r = monthRange(month)
  if (!r) return

  // Refuse a second invoice for the same contractor-period. The form is guarded
  // too, but a Server Action is reachable by direct POST, so check here as well.
  if (await findInvoiceForPeriod(contractor_id, r.start, r.end)) return

  const trips = (await listContractorTrips(contractor_id, r.start, r.end)).filter((t) => !t.invoice_id)
  if (trips.length === 0) return

  const amount = trips.reduce((s, t) => s + Number(t.amount ?? 0), 0)
  await createInvoiceForTrips({
    contractor_id, invoice_no,
    period_label: r.label, period_start: r.start, period_end: r.end,
    issue_date: isoDate(new Date()), due_date: isoDate(addDays(new Date(), dueDays)),
    amount, amount_paid: 0,
    notes: `Auto-generated from ${trips.length} logged trips.`,
  }, trips.map((t) => t.id))

  revalidatePath('/receivables')
  revalidatePath('/trips')
}

export async function saveInvoice(formData: FormData) {
  await requireFinance()
  const id = String(formData.get('id') || '')
  const row = {
    contractor_id: emptyToNull(formData.get('contractor_id')),
    invoice_no: emptyToNull(formData.get('invoice_no')),
    period_label: emptyToNull(formData.get('period_label')),
    issue_date: emptyToNull(formData.get('issue_date')),
    due_date: emptyToNull(formData.get('due_date')),
    amount: num(formData.get('amount')),
    notes: emptyToNull(formData.get('notes')),
  }
  if (!row.contractor_id || row.amount <= 0) return
  await saveRecord('invoices', row, id || null)
  revalidatePath('/receivables')
}

// Record a payment: set amount_paid (and paid_date if cleared).
export async function recordPayment(formData: FormData) {
  await requireFinance()
  const id = String(formData.get('id') || '')
  if (!id) return
  const amount = num(formData.get('amount'))
  const amount_paid = num(formData.get('amount_paid'))
  const paid_date = amount_paid >= amount && amount > 0
    ? (emptyToNull(formData.get('paid_date')) ?? isoDate(new Date()))
    : emptyToNull(formData.get('paid_date'))
  await saveRecord('invoices', { amount_paid, paid_date }, id)
  revalidatePath('/receivables')
}

// Mark fully paid in one click.
export async function markPaid(formData: FormData) {
  await requireFinance()
  const id = String(formData.get('id') || '')
  const amount = num(formData.get('amount'))
  if (!id) return
  await saveRecord('invoices', { amount_paid: amount, paid_date: isoDate(new Date()) }, id)
  revalidatePath('/receivables')
}

export async function deleteInvoice(formData: FormData) {
  await requireFinance()
  const id = String(formData.get('id') || '')
  if (!id) return
  // Release the trips first, so they return to the un-billed pool rather than
  // being stranded against an invoice that no longer exists.
  await clearInvoiceTrips(id)
  await deleteRecord('invoices', id)
  revalidatePath('/receivables')
  revalidatePath('/trips')
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}
