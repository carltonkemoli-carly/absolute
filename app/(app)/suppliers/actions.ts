'use server'

import { revalidatePath } from 'next/cache'
import { upsertTarget } from '@/lib/db'
import { requireFinance } from '@/lib/auth'

// Monthly goals for one supplier: what we expect them to send us.
export async function saveSupplierTargets(formData: FormData) {
  await requireFinance()
  const period = String(formData.get('period') || '').trim()
  const contractorId = String(formData.get('contractor_id') || '').trim()
  if (!period || !contractorId) return

  await upsertTarget(period, 'revenue', null, num(formData.get('revenue_target')), contractorId)
  await upsertTarget(period, 'trips', null, num(formData.get('trips_target')), contractorId)
  revalidatePath('/suppliers')
}

function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}
