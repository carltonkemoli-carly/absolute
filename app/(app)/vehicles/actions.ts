'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, deleteRecord } from '@/lib/db'

export async function saveVehicle(formData: FormData) {
  const id = String(formData.get('id') || '')
  const row = {
    plate: String(formData.get('plate') || '').trim().toUpperCase(),
    model: emptyToNull(formData.get('model')),
    vehicle_type: emptyToNull(formData.get('vehicle_type')),
    capacity: numOrNull(formData.get('capacity')),
    status: String(formData.get('status') || 'active'),
    ownership: String(formData.get('ownership') || 'owned'),
    owner_name: emptyToNull(formData.get('owner_name')),
    monthly_fee: num(formData.get('monthly_fee')),
    notes: emptyToNull(formData.get('notes')),
  }
  if (!row.plate) return
  await saveRecord('vehicles', row, id || null)
  revalidatePath('/vehicles')
}

export async function deleteVehicle(formData: FormData) {
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
