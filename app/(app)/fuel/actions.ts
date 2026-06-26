'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, deleteRecord } from '@/lib/db'

export async function saveFuel(formData: FormData) {
  const id = String(formData.get('id') || '')
  const row = {
    fuel_date: String(formData.get('fuel_date') || '').trim(),
    vehicle_id: emptyToNull(formData.get('vehicle_id')),
    driver_id: emptyToNull(formData.get('driver_id')),
    amount: num(formData.get('amount')),
    litres: numOrNull(formData.get('litres')),
    odometer: intOrNull(formData.get('odometer')),
    station: emptyToNull(formData.get('station')),
    notes: emptyToNull(formData.get('notes')),
  }
  if (!row.fuel_date || !row.vehicle_id) return
  await saveRecord('fuel_entries', row, id || null)
  revalidatePath('/fuel')
  revalidatePath('/')
}

export async function deleteFuel(formData: FormData) {
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
