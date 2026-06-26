'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { backupToSheetNow } from './actions'

export default function PushToSheetButton() {
  const [busy, setBusy] = useState(false)
  const [lastDone, setLastDone] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    const t = toast.loading('Backing up to Google Sheet…')
    try {
      const res = await backupToSheetNow()
      toast.dismiss(t)
      if (res.ok) {
        toast.success(res.message)
        setLastDone(new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }))
      } else {
        toast.error(res.message, { duration: 7000 })
      }
    } catch {
      toast.dismiss(t)
      toast.error('Backup failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <button className="btn-primary" style={{ padding: '10px 18px', fontSize: 14, cursor: 'pointer', opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap' }} onClick={run} disabled={busy}>
        {busy ? 'Backing up…' : '↗ Back up to Sheet now'}
      </button>
      {lastDone && <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>Last pushed at {lastDone}</span>}
    </div>
  )
}
