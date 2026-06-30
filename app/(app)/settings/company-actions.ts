'use server'

import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth'
import { saveCompany } from '@/lib/db'

export async function saveCompanyAction(formData: FormData) {
  const profile = await requireProfile()
  if (profile.role !== 'owner') return // only the owner edits company details
  const str = (k: string) => {
    const s = String(formData.get(k) ?? '').trim()
    return s === '' ? null : s
  }
  const name = str('name') ?? 'Absolute Comfort Travel'
  await saveCompany({
    name,
    tagline: str('tagline'),
    location: str('location'),
    email: str('email'),
    phone: str('phone'),
  })
  revalidatePath('/settings')
  revalidatePath('/receivables')
}
