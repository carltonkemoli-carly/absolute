'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, deleteRecord } from '@/lib/db'
import { requireOperations } from '@/lib/auth'

export async function saveFuel(formData: FormData) {
  await requireOperations()
  const id = String(formData.get('id') || '')
  const row = {
    fuel_date: String(formData.get('fuel_date') || '').trim(),
    vehicle_id: emptyToNull(formData.get('vehicle_id')),
    driver_id: emptyToNull(formData.get('driver_id')),
    amount: num(formData.get('amount')),
    litres: numOrNull(formData.get('litres')),
    odometer: intOrNull(formData.get('odometer')),
    station: emptyToNull(formData.get('station')),
    mpesa_ref: emptyToNull(formData.get('mpesa_ref')),
    notes: emptyToNull(formData.get('notes')),
  }
  if (!row.fuel_date) return  // vehicle optional: station payments aren't tied to one car
  const { error } = await saveRecord('fuel_entries', row, id || null)
  if (error) throw new Error(error)
  revalidatePath('/fuel')
  revalidatePath('/')
}

export async function deleteFuel(formData: FormData) {
  await requireOperations()
  const id = String(formData.get('id') || '')
  if (id) await deleteRecord('fuel_entries', id)
  revalidatePath('/fuel')
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
function intOrNull(v: FormDataEntryValue | null): number | null {
  const n = numOrNull(v)
  return n === null ? null : Math.round(n)
}
