'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, deleteRecord } from '@/lib/db'
import { requireOperations } from '@/lib/auth'

export async function saveContractor(formData: FormData) {
  await requireOperations()
  const id = String(formData.get('id') || '')
  const row = {
    name: String(formData.get('name') || '').trim(),
    code: emptyToNull(formData.get('code')),
    billing_notes: emptyToNull(formData.get('billing_notes')),
  }
  if (!row.name) return
  const { error } = await saveRecord('contractors', row, id || null)
  if (error) throw new Error(error)
  revalidatePath('/settings')
}

export async function deleteContractor(formData: FormData) {
  await requireOperations()
  const id = String(formData.get('id') || '')
  if (id) await deleteRecord('contractors', id)
  revalidatePath('/settings')
}

export async function saveOrganization(formData: FormData) {
  await requireOperations()
  const id = String(formData.get('id') || '')
  const row = {
    name: String(formData.get('name') || '').trim(),
    contractor_id: emptyToNull(formData.get('contractor_id')),
  }
  if (!row.name) return
  const { error } = await saveRecord('organizations', row, id || null)
  if (error) throw new Error(error)
  revalidatePath('/settings')
}

export async function deleteOrganization(formData: FormData) {
  await requireOperations()
  const id = String(formData.get('id') || '')
  if (id) await deleteRecord('organizations', id)
  revalidatePath('/settings')
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
