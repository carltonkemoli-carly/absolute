import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/devmode'

export async function POST(request: Request) {
  if (!DEV_MODE) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
}
