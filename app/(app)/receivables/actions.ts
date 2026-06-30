'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, deleteRecord, listContractorTrips } from '@/lib/db'

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
}

// Preview what a trip-generated invoice would contain (count + total) before creating it.
export async function previewInvoiceFromTrips(contractorId: string, month: string): Promise<InvoicePreview> {
  const empty = { ok: false, count: 0, total: 0, start: '', end: '', label: '' }
  if (!contractorId) return { ...empty, message: 'Pick a contractor.' }
  const r = monthRange(month)
  if (!r) return { ...empty, message: 'Pick a month.' }
  const trips = await listContractorTrips(contractorId, r.start, r.end)
  const total = trips.reduce((s, t) => s + Number(t.amount ?? 0), 0)
  if (trips.length === 0) return { ...empty, start: r.start, end: r.end, label: r.label, message: `No trips logged for this contractor in ${r.label}.` }
  return { ok: true, count: trips.length, total, start: r.start, end: r.end, label: r.label }
}

// Create an invoice from all of a contractor's trips in a month.
export async function generateInvoiceFromTrips(formData: FormData) {
  const contractor_id = emptyToNull(formData.get('contractor_id'))
  const month = String(formData.get('month') || '')
  const invoice_no = emptyToNull(formData.get('invoice_no'))
  const dueDays = num(formData.get('due_days')) || 30
  if (!contractor_id) return
  const r = monthRange(month)
  if (!r) return
  const trips = await listContractorTrips(contractor_id, r.start, r.end)
  if (trips.length === 0) return
  const amount = trips.reduce((s, t) => s + Number(t.amount ?? 0), 0)
  const issue = new Date().toISOString().slice(0, 10)
  const due = new Date(Date.now() + dueDays * 86400000).toISOString().slice(0, 10)
  await saveRecord('invoices', {
    contractor_id, invoice_no,
    period_label: r.label, period_start: r.start, period_end: r.end,
    issue_date: issue, due_date: due,
    amount, amount_paid: 0,
    notes: `Auto-generated from ${trips.length} logged trips.`,
  }, null)
  revalidatePath('/receivables')
}

export async function saveInvoice(formData: FormData) {
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
  const id = String(formData.get('id') || '')
  if (!id) return
  const amount = num(formData.get('amount'))
  const amount_paid = num(formData.get('amount_paid'))
  const paid_date = amount_paid >= amount && amount > 0
    ? (emptyToNull(formData.get('paid_date')) ?? new Date().toISOString().slice(0, 10))
    : emptyToNull(formData.get('paid_date'))
  await saveRecord('invoices', { amount_paid, paid_date }, id)
  revalidatePath('/receivables')
}

// Mark fully paid in one click.
export async function markPaid(formData: FormData) {
  const id = String(formData.get('id') || '')
  const amount = num(formData.get('amount'))
  if (!id) return
  await saveRecord('invoices', { amount_paid: amount, paid_date: new Date().toISOString().slice(0, 10) }, id)
  revalidatePath('/receivables')
}

export async function deleteInvoice(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (id) await deleteRecord('invoices', id)
  revalidatePath('/receivables')
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}
