'use client'

import { useRouter } from 'next/navigation'

export default function PrintBar() {
  const router = useRouter()
  return (
    <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
      <button className="btn-ghost" style={{ padding: '8px 16px', fontSize: 14, cursor: 'pointer' }} onClick={() => router.push('/receivables')}>← Back</button>
      <div style={{ flex: 1 }} />
      <button className="btn-primary" style={{ padding: '8px 18px', fontSize: 14, cursor: 'pointer' }} onClick={() => window.print()}>🖨 Print / Save PDF</button>
    </div>
  )
}
