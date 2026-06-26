'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, deleteRecord } from '@/lib/db'

export async function saveExpense(formData: FormData) {
  const id = String(formData.get('id') || '')
  const row = {
    expense_date: String(formData.get('expense_date') || '').trim(),
    category: String(formData.get('category') || '').trim(),
    amount: num(formData.get('amount')),
    vehicle_id: emptyToNull(formData.get('vehicle_id')),
    driver_id: emptyToNull(formData.get('driver_id')),
    payee: emptyToNull(formData.get('payee')),
    description: emptyToNull(formData.get('description')),
    notes: emptyToNull(formData.get('notes')),
  }
  if (!row.expense_date || !row.category) return
  await saveRecord('expenses', row, id || null)
  revalidatePath('/expenses')
  revalidatePath('/goals')
  revalidatePath('/')
}

export async function deleteExpense(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (id) await deleteRecord('expenses', id)
  revalidatePath('/expenses')
  revalidatePath('/goals')
  revalidatePath('/')
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : 0
}
