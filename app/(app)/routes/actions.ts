'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, deleteRecord } from '@/lib/db'

export async function saveRoute(formData: FormData) {
  const id = String(formData.get('id') || '')
  const row = {
    pickup: String(formData.get('pickup') || '').trim(),
    dropoff: String(formData.get('dropoff') || '').trim(),
    price_saloon: num(formData.get('price_saloon')),
    price_wagon: num(formData.get('price_wagon')),
    price_van: num(formData.get('price_van')),
    price_bus: num(formData.get('price_bus')),
    active: formData.get('active') === 'on',
    notes: emptyToNull(formData.get('notes')),
  }
  if (!row.pickup || !row.dropoff) return
  await saveRecord('routes', row, id || null)
  revalidatePath('/routes')
}

export async function deleteRoute(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (id) await deleteRecord('routes', id)
  revalidatePath('/routes')
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : 0
}
