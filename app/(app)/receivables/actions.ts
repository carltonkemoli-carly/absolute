'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, deleteRecord } from '@/lib/db'

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
