'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { signIn, signUp, type AuthResult } from './actions'

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="btn-primary"
      style={{ width: '100%', padding: '11px', fontSize: 15, marginTop: 4, opacity: pending ? 0.6 : 1 }}>
      {pending ? 'Please wait…' : label}
    </button>
  )
}

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const action = mode === 'signin' ? signIn : signUp
  const [state, formAction] = useActionState<AuthResult, FormData>(action, undefined)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card animate-fadeup" style={{ width: '100%', maxWidth: 400, padding: 32 }}>
        <div style={{ marginBottom: 24 }}>
          <div className="font-display" style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--accent-mid)', textTransform: 'uppercase' }}>
            Absolute Comfort Travel
          </div>
          <h1 className="font-display" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: '8px 0 4px' }}>
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink2)', margin: 0 }}>
            Operations &amp; finance dashboard
          </p>
        </div>

        <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'signup' && (
            <label className="field">
              <span>Full name</span>
              <input name="full_name" className="input" placeholder="e.g. Jane Doe" autoComplete="name" />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" className="input" placeholder="you@company.com" autoComplete="email" required />
          </label>
          <label className="field">
            <span>Password</span>
            <input name="password" type="password" className="input" placeholder="••••••••"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required />
          </label>

          {state?.error && (
            <div style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--danger-light)', padding: '9px 11px', borderRadius: 9 }}>
              {state.error}
            </div>
          )}

          <SubmitButton label={mode === 'signin' ? 'Sign in' : 'Create account'} />
        </form>

        <div style={{ marginTop: 18, fontSize: 13, color: 'var(--ink2)', textAlign: 'center' }}>
          {mode === 'signin' ? (
            <>First time here?{' '}
              <button onClick={() => setMode('signup')} style={{ color: 'var(--accent-mid)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                Create an account
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => setMode('signin')} style={{ color: 'var(--accent-mid)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
