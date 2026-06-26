'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, deleteRecord } from '@/lib/db'

export async function saveDriver(formData: FormData) {
  const id = String(formData.get('id') || '')
  const row = {
    name: String(formData.get('name') || '').trim(),
    phone: emptyToNull(formData.get('phone')),
    license_no: emptyToNull(formData.get('license_no')),
    default_vehicle_id: emptyToNull(formData.get('default_vehicle_id')),
    status: String(formData.get('status') || 'active'),
  }
  if (!row.name) return
  await saveRecord('drivers', row, id || null)
  revalidatePath('/drivers')
}

export async function deleteDriver(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (id) await deleteRecord('drivers', id)
  revalidatePath('/drivers')
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
