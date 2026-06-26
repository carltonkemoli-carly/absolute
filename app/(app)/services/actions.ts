'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, deleteRecord } from '@/lib/db'

export async function saveService(formData: FormData) {
  const id = String(formData.get('id') || '')
  const row = {
    vehicle_id: emptyToNull(formData.get('vehicle_id')),
    service_date: String(formData.get('service_date') || '').trim(),
    odometer: intOrNull(formData.get('odometer')),
    service_type: emptyToNull(formData.get('service_type')),
    description: emptyToNull(formData.get('description')),
    cost: num(formData.get('cost')),
    garage: emptyToNull(formData.get('garage')),
    next_service_date: emptyToNull(formData.get('next_service_date')),
    next_service_odometer: intOrNull(formData.get('next_service_odometer')),
    notes: emptyToNull(formData.get('notes')),
  }
  if (!row.vehicle_id || !row.service_date) return
  await saveRecord('vehicle_services', row, id || null)
  revalidatePath('/services')
  revalidatePath('/')
}

export async function deleteService(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (id) await deleteRecord('vehicle_services', id)
  revalidatePath('/services')
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
function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n) : null
}
