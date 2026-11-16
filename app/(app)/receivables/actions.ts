'use server'

import { revalidatePath } from 'next/cache'
import {
  saveRecord, deleteRecord, listContractorTrips,
  findInvoiceForPeriod, createInvoiceForTrips, getInvoice, addPayment, deletePayment,
} from '@/lib/db'
import { requireFinance } from '@/lib/auth'
import { isoDate, addDays } from '@/lib/format'
import { nairobiToday } from '@/lib/nairobi-date'
import { paymentProblem, PAYMENT_METHODS, type PaymentInput } from '@/lib/payments'
import type { PaymentMethod } from '@/lib/types'

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
    return { ...empty, start: r.start, end: r.end, label: r.label, message: `No completed trips for this contractor in ${r.label}.` }
  }

  const unbilled = trips.filter((t) => !t.invoice_id)
  const alreadyBilled = trips.length - unbilled.length
  if (unbilled.some((t) => !(Number(t.amount) > Number(t.express_charges || 0)))) {
    return { ...empty, start: r.start, end: r.end, label: r.label, alreadyBilled,
      message: 'A completed trip has no fare after expressway tolls. Correct that trip before invoicing this month.' }
  }
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
  if (trips.some((t) => !(Number(t.amount) > Number(t.express_charges || 0)))) {
    throw new Error('A completed trip has no fare after expressway tolls. Correct it before invoicing.')
  }

  const amount = trips.reduce((s, t) => s + Number(t.amount ?? 0), 0)
  const result = await createInvoiceForTrips({
    contractor_id, invoice_no,
    period_label: r.label, period_start: r.start, period_end: r.end,
    issue_date: isoDate(new Date()), due_date: isoDate(addDays(new Date(), dueDays)),
    amount, amount_paid: 0,
    notes: `Auto-generated from ${trips.length} logged trips.`,
  }, trips.map((t) => t.id))
  if (result.error) throw new Error(result.error)

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
  const result = await saveRecord('invoices', row, id || null)
  if (result.error) throw new Error(result.error)
  revalidatePath('/receivables')
}

export type PaymentResult = { ledger: boolean }

// Record one receipt against an invoice. amount_paid and paid_date follow from
// the ledger (or, before the migration, are adjusted directly — `ledger: false`).
export async function addInvoicePayment(formData: FormData): Promise<PaymentResult> {
  const profile = await requireFinance()
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Invoice not found. Refresh and try again.')
  const invoice = await getInvoice(id)
  if (!invoice) throw new Error('Invoice not found. Refresh and try again.')
  assertFreshInvoice(formData, invoice)
  const input = readPayment(formData)
  const problem = paymentProblem(invoice, input)
  if (problem) throw new Error(problem)
  const result = await addPayment(id, input, Number(invoice.amount_paid), profile.id ?? null)
  if (result.error) throw new Error(result.error)
  revalidatePath('/receivables'); revalidatePath(`/receivables/${id}`); revalidatePath('/')
  return { ledger: result.ledger }
}

// Settle the balance in one step: a single receipt for whatever is still owed.
export async function markPaid(formData: FormData): Promise<PaymentResult> {
  const profile = await requireFinance()
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Invoice not found. Refresh and try again.')
  const invoice = await getInvoice(id)
  if (!invoice) throw new Error('Invoice not found. Refresh and try again.')
  assertFreshInvoice(formData, invoice)
  const owed = Math.round((Number(invoice.amount) - Number(invoice.amount_paid)) * 100) / 100
  if (!(Number(invoice.amount) > 0) || owed <= 0) throw new Error('Nothing is owed on this invoice.')
  const input: PaymentInput = { amount: owed, paid_on: nairobiToday(), method: readMethod(formData.get('method')), reference: emptyToNull(formData.get('reference')), note: null }
  const result = await addPayment(id, input, Number(invoice.amount_paid), profile.id ?? null)
  if (result.error) throw new Error(result.error)
  revalidatePath('/receivables'); revalidatePath(`/receivables/${id}`); revalidatePath('/')
  return { ledger: result.ledger }
}

// Remove a receipt entered in error; the invoice's totals follow.
export async function removeInvoicePayment(formData: FormData) {
  await requireFinance()
  const paymentId = String(formData.get('payment_id') || '')
  const invoiceId = String(formData.get('id') || '')
  if (!paymentId) throw new Error('Payment not found.')
  const result = await deletePayment(paymentId)
  if (result.error) throw new Error(result.error)
  revalidatePath('/receivables'); if (invoiceId) revalidatePath(`/receivables/${invoiceId}`); revalidatePath('/')
}

function readPayment(formData: FormData): PaymentInput {
  return {
    amount: money(formData.get('amount')),
    paid_on: String(formData.get('paid_on') || '').trim(),
    method: readMethod(formData.get('method')),
    reference: emptyToNull(formData.get('reference')),
    note: emptyToNull(formData.get('note')),
  }
}
function readMethod(value: FormDataEntryValue | null): PaymentMethod {
  const method = String(value ?? 'other').trim() as PaymentMethod
  return PAYMENT_METHODS.includes(method) ? method : 'other'
}

export async function deleteInvoice(formData: FormData) {
  await requireFinance()
  const id = String(formData.get('id') || '')
  if (!id) return
  // The foreign key releases trips in the same transaction as deletion.
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
function money(v: FormDataEntryValue | null): number {
  const raw = String(v ?? '').trim().replace(/,/g, '')
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error('Enter an amount with at most two decimal places.')
  return Number(raw)
}
function assertFreshInvoice(formData: FormData, invoice: { amount: number; amount_paid: number }) {
  const expectedAmount = money(formData.get('expected_amount'))
  const expectedPaid = money(formData.get('expected_amount_paid'))
  if (expectedAmount !== Number(invoice.amount) || expectedPaid !== Number(invoice.amount_paid)) {
    throw new Error('Invoice changed since this page loaded. Refresh and try again.')
  }
}
