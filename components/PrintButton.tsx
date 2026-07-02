'use client'

export default function PrintButton({ label = 'Print / Save PDF' }: { label?: string }) {
  return (
    <button className="btn-ghost no-print" style={{ padding: '7px 14px', fontSize: 13, cursor: 'pointer' }} onClick={() => window.print()}>
      🖨 {label}
    </button>
  )
}
