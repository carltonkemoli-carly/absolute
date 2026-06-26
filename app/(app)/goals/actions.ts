'use server'

import { revalidatePath } from 'next/cache'
import { upsertTarget } from '@/lib/db'

export async function saveTargets(formData: FormData) {
  const period = String(formData.get('period') || '').trim()
  if (!period) return

  await upsertTarget(period, 'revenue', null, num(formData.get('revenue_target')))
  await upsertTarget(period, 'profit', null, num(formData.get('profit_target')))

  for (const [key, value] of formData.entries()) {
    if (key.startsWith('cap_')) {
      const category = key.slice(4)
      await upsertTarget(period, 'spend_cap', category, num(value))
    }
  }
  revalidatePath('/goals')
}

function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : 0
}
