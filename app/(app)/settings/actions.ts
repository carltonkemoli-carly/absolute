'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, deleteRecord } from '@/lib/db'

export async function saveContractor(formData: FormData) {
  const id = String(formData.get('id') || '')
  const row = {
    name: String(formData.get('name') || '').trim(),
    code: emptyToNull(formData.get('code')),
    billing_notes: emptyToNull(formData.get('billing_notes')),
  }
  if (!row.name) return
  await saveRecord('contractors', row, id || null)
  revalidatePath('/settings')
}

export async function deleteContractor(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (id) await deleteRecord('contractors', id)
  revalidatePath('/settings')
}

export async function saveOrganization(formData: FormData) {
  const id = String(formData.get('id') || '')
  const row = {
    name: String(formData.get('name') || '').trim(),
    contractor_id: emptyToNull(formData.get('contractor_id')),
  }
  if (!row.name) return
  await saveRecord('organizations', row, id || null)
  revalidatePath('/settings')
}

export async function deleteOrganization(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (id) await deleteRecord('organizations', id)
  revalidatePath('/settings')
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
