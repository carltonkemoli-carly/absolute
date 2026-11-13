'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, deleteRecord } from '@/lib/db'
import { requireOperations, requireFinance, canSeeFinance } from '@/lib/auth'

export async function saveVehicle(formData: FormData) {
  const profile = await requireOperations()
  const id = String(formData.get('id') || '')
  const row = {
    plate: String(formData.get('plate') || '').trim().toUpperCase(),
    model: emptyToNull(formData.get('model')),
    vehicle_type: emptyToNull(formData.get('vehicle_type')),
    capacity: numOrNull(formData.get('capacity')),
    status: String(formData.get('status') || 'active'),
    ownership: String(formData.get('ownership') || 'owned'),
    owner_name: emptyToNull(formData.get('owner_name')),
    notes: emptyToNull(formData.get('notes')),
    ...(canSeeFinance(profile.role) ? {
      monthly_fee: num(formData.get('monthly_fee')),
      purchase_date: emptyToNull(formData.get('purchase_date')),
      purchase_price: num(formData.get('purchase_price')),
      loan_amount: num(formData.get('loan_amount')),
      loan_monthly: num(formData.get('loan_monthly')),
    } : id ? {} : { monthly_fee: 0, purchase_date: null, purchase_price: 0, loan_amount: 0, loan_monthly: 0 }),
  }
  if (!row.plate) throw new Error('Vehicle registration is required')
  const result = await saveRecord('vehicles', row, id || null)
  if (result.error) throw new Error(result.error)
  revalidatePath('/vehicles')
  revalidatePath('/payback')
}

export async function deleteVehicle(formData: FormData) {
  await requireFinance()
  const id = String(formData.get('id') || '')
  if (id) await deleteRecord('vehicles', id)
  revalidatePath('/vehicles')
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : 0
}
