'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, deleteRecord } from '@/lib/db'

export async function saveDocument(formData: FormData) {
  const id = String(formData.get('id') || '')
  const ownerKind = String(formData.get('owner_kind') || 'vehicle')
  const row = {
    owner_kind: ownerKind,
    vehicle_id: ownerKind === 'vehicle' ? emptyToNull(formData.get('vehicle_id')) : null,
    driver_id: ownerKind === 'driver' ? emptyToNull(formData.get('driver_id')) : null,
    doc_type: String(formData.get('doc_type') || '').trim(),
    reference: emptyToNull(formData.get('reference')),
    provider: emptyToNull(formData.get('provider')),
    issue_date: emptyToNull(formData.get('issue_date')),
    expiry_date: emptyToNull(formData.get('expiry_date')),
    notes: emptyToNull(formData.get('notes')),
  }
  if (!row.doc_type) return
  if (ownerKind === 'vehicle' && !row.vehicle_id) return
  if (ownerKind === 'driver' && !row.driver_id) return
  await saveRecord('documents', row, id || null)
  revalidatePath('/compliance')
  revalidatePath('/')
}

export async function deleteDocument(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (id) await deleteRecord('documents', id)
  revalidatePath('/compliance')
  revalidatePath('/')
}

export async function markAttended(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (!id) return
  const attended_on = String(formData.get('attended_on') || '').trim() || new Date().toISOString().slice(0, 10)
  await saveRecord('documents', {
    attended: true,
    attended_on,
    attended_note: emptyToNull(formData.get('attended_note')),
  }, id)
  revalidatePath('/compliance')
  revalidatePath('/')
}

export async function unmarkAttended(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (!id) return
  await saveRecord('documents', { attended: false, attended_on: null, attended_note: null }, id)
  revalidatePath('/compliance')
  revalidatePath('/')
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
