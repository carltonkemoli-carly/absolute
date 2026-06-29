'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { requireProfile } from '@/lib/auth'
import { DEV_MODE } from '@/lib/devmode'
import type { UserRole } from '@/lib/types'

export type UserActionResult = { ok: boolean; message: string }

const ROLES: UserRole[] = ['owner', 'accountant', 'office', 'driver']

function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Change a user's role. Owner only.
export async function setUserRole(userId: string, role: string): Promise<UserActionResult> {
  const me = await requireProfile()
  if (me.role !== 'owner') return { ok: false, message: 'Only an owner can change roles.' }
  if (!ROLES.includes(role as UserRole)) return { ok: false, message: 'Invalid role.' }
  if (userId === me.id && role !== 'owner') return { ok: false, message: "You can't remove your own owner access." }
  if (DEV_MODE) return { ok: false, message: 'Not available in demo mode.' }

  const { error } = await admin().from('profiles').update({ role }).eq('id', userId)
  if (error) return { ok: false, message: error.message }
  revalidatePath('/settings')
  return { ok: true, message: 'Role updated.' }
}

// Create a new staff login. Owner only.
export async function createUser(formData: FormData): Promise<UserActionResult> {
  const me = await requireProfile()
  if (me.role !== 'owner') return { ok: false, message: 'Only an owner can add users.' }
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  const full_name = String(formData.get('full_name') || '').trim()
  const role = String(formData.get('role') || 'office')
  if (!email || password.length < 8) return { ok: false, message: 'Enter an email and a password of at least 8 characters.' }
  if (DEV_MODE) return { ok: false, message: 'Not available in demo mode.' }

  const sb = admin()
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })
  if (error) return { ok: false, message: error.message }
  const id = data.user?.id
  if (id && role !== 'office') await sb.from('profiles').update({ role }).eq('id', id)
  revalidatePath('/settings')
  return { ok: true, message: `Created ${full_name || email}.` }
}
