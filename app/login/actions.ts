'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AuthResult = { error: string } | undefined

export async function signIn(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  if (!email || !password) return { error: 'Enter your email and password.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  redirect('/')
}

export async function signUp(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  const fullName = String(formData.get('full_name') || '').trim()
  if (!email || !password) return { error: 'Enter your email and password.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })
  if (error) return { error: error.message }
  // If email confirmation is disabled, the user is signed in immediately.
  const { data } = await supabase.auth.getUser()
  if (data.user) redirect('/')
  return { error: 'Check your email to confirm your account, then sign in.' }
}
