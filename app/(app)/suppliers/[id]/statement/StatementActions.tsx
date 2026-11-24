'use client'

import Link from 'next/link'
import toast from 'react-hot-toast'

// The bar above a statement: back, show settled invoices, send a reminder, print.
export default function StatementActions({
  backHref, allHref, showAll, message,
}: { backHref: string; allHref: string; showAll: boolean; message: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      toast.success('Reminder copied. Paste it into WhatsApp or an email.')
    } catch {
      toast.error('Your browser blocked copying. Use the WhatsApp button, or select the text yourself.')
    }
  }

  return (
    <div className="no-print statement-actions">
      <Link href={backHref} className="btn-ghost statement-btn">← Supplier</Link>
      <Link href={allHref} className="btn-ghost statement-btn">{showAll ? 'Open invoices only' : 'Include settled invoices'}</Link>
      <div className="statement-spacer" />
      {message && (
        <>
          <button type="button" className="btn-ghost statement-btn" onClick={copy}>Copy reminder</button>
          <a className="btn-ghost statement-btn" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>
        </>
      )}
      <button type="button" className="btn-primary statement-btn" onClick={() => window.print()}>Print / Save PDF</button>
    </div>
  )
}
