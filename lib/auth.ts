import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/devmode'
import { DEMO_USERS, type DemoUserKey } from '@/lib/devstore'
import { FINANCE_ROLES, type Profile } from '@/lib/types'

// Loads the signed-in user's profile, or redirects to /login.
export async function requireProfile(): Promise<Profile> {
  if (DEV_MODE) {
    const key = (await cookies()).get('demo_user')?.value as DemoUserKey | undefined
    return DEMO_USERS[key === 'rachel' ? 'rachel' : 'ceo']
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // Profile row missing (trigger not run yet) — fall back to a minimal one.
    return {
      id: user.id,
      full_name: user.email ?? null,
      role: 'office',
      created_at: new Date().toISOString(),
    }
  }
  return profile as Profile
}

export function canSeeFinance(role: Profile['role']): boolean {
  return FINANCE_ROLES.includes(role)
}

// Guard for server actions that mutate finance data. Server Actions are
// reachable by direct POST, not just through our gated pages, so every
// finance mutation must re-check authorization here (per Next.js guidance).
export async function requireFinance(): Promise<Profile> {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) throw new Error('Not authorized')
  return profile
}

// Guard for owner-only actions (user management, destructive data ops).
export async function requireOwner(): Promise<Profile> {
  const profile = await requireProfile()
  if (profile.role !== 'owner') throw new Error('Not authorized')
  return profile
}
