'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

export default function ChangePassword() {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pw.length < 8) { toast.error('Password must be at least 8 characters.'); return }
    if (pw !== confirm) { toast.error('Passwords do not match.'); return }
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success('Password changed.')
    setPw(''); setConfirm('')
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <label className="field" style={{ minWidth: 180 }}><span>New password</span>
        <input type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
      </label>
      <label className="field" style={{ minWidth: 180 }}><span>Confirm</span>
        <input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
      </label>
      <button type="submit" className="btn-primary" style={{ padding: '9px 18px', fontSize: 14, cursor: 'pointer', opacity: busy ? 0.6 : 1 }} disabled={busy}>
        {busy ? 'Saving…' : 'Change password'}
      </button>
    </form>
  )
}
