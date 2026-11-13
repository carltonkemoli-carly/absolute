'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, deleteRecord } from '@/lib/db'
import { requireOperations, canSeeFinance } from '@/lib/auth'

export async function saveDriver(formData: FormData) {
  const profile = await requireOperations()
  const id = String(formData.get('id') || '')
  const row = {
    name: String(formData.get('name') || '').trim(),
    phone: emptyToNull(formData.get('phone')),
    license_no: emptyToNull(formData.get('license_no')),
    default_vehicle_id: emptyToNull(formData.get('default_vehicle_id')),
    ...(canSeeFinance(profile.role) ? { monthly_wage: num(formData.get('monthly_wage')) } : {}),
    status: String(formData.get('status') || 'active'),
  }
  if (!row.name) return
  const { error } = await saveRecord('drivers', row, id || null)
  // Graceful fallback if the monthly_wage migration hasn't been run yet —
  // still save the rest of the driver's details.
  if (error && /monthly_wage/i.test(error) && 'monthly_wage' in row) {
    const { monthly_wage: _omit, ...rest } = row
    void _omit
    const retry = await saveRecord('drivers', rest, id || null)
    if (retry.error) throw new Error(retry.error)
  } else if (error) {
    throw new Error(error)
  }
  revalidatePath('/drivers')
}

export async function deleteDriver(formData: FormData) {
  await requireOperations()
  const id = String(formData.get('id') || '')
  if (id) await deleteRecord('drivers', id)
  revalidatePath('/drivers')
}

function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : 0
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
