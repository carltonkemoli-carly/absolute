'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { DemoUserKey } from '@/lib/devstore'

// Demo-only: switch which persona you're viewing the app as.
export async function setDemoUser(key: DemoUserKey) {
  const c = await cookies()
  c.set('demo_user', key, { path: '/', maxAge: 60 * 60 * 24 * 30 })
  revalidatePath('/', 'layout')
  // Rachel can't see the finance dashboard — land her on Trips.
  if (key === 'rachel') redirect('/trips')
  redirect('/')
}
