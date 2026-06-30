'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, deleteRecord } from '@/lib/db'

export async function saveTrip(formData: FormData) {
  const id = String(formData.get('id') || '')
  const row = {
    trip_date: String(formData.get('trip_date') || '').trim(),
    client_name: String(formData.get('client_name') || '').trim(),
    slip_no: emptyToNull(formData.get('slip_no')),
    pickup: emptyToNull(formData.get('pickup')),
    pickup_time: emptyToNull(formData.get('pickup_time')),
    dropoff: emptyToNull(formData.get('dropoff')),
    notes: emptyToNull(formData.get('notes')),
    express_charges: num(formData.get('express_charges')),
    voucher_no: emptyToNull(formData.get('voucher_no')),
    organization_id: emptyToNull(formData.get('organization_id')),
    contractor_id: emptyToNull(formData.get('contractor_id')),
    vehicle_id: emptyToNull(formData.get('vehicle_id')),
    driver_id: emptyToNull(formData.get('driver_id')),
    amount: num(formData.get('amount')),
    distance_km: numOrNull(formData.get('distance_km')),
    hire_cost: num(formData.get('hire_cost')),
    flight_no: emptyToNull(formData.get('flight_no')),
    flight_time: emptyToNull(formData.get('flight_time')),
    payment: String(formData.get('payment') || 'account'),
    status: String(formData.get('status') || 'completed'),
  }
  if (!row.trip_date || !row.client_name) return
  await saveRecord('trips', row, id || null)
  revalidatePath('/trips')
  revalidatePath('/')
}

export async function deleteTrip(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (id) await deleteRecord('trips', id)
  revalidatePath('/trips')
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
function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
