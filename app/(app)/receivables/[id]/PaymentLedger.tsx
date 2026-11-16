'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { kes, fmtDate } from '@/lib/format'
import { PAYMENT_METHOD_LABELS, type InvoicePayment } from '@/lib/types'
import { removeInvoicePayment } from '../actions'

// Every receipt against this invoice, in the order the money arrived. Printed
// with the invoice so the client sees the same history. Removal is for an entry
// made in error; the invoice's paid total follows the ledger.
export default function PaymentLedger({ invoiceId, payments }: { invoiceId: string; payments: InvoicePayment[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  if (payments.length === 0) return null
  const total = payments.reduce((sum, payment) => sum + Number(payment.amount), 0)

  function remove(payment: InvoicePayment) {
    if (!confirm(`Remove the ${kes(payment.amount)} receipt from ${fmtDate(payment.paid_on)}? The invoice will show that amount as owed again.`)) return
    const fd = new FormData(); fd.set('payment_id', payment.id); fd.set('id', invoiceId)
    setError('')
    startTransition(async () => {
      try { await removeInvoicePayment(fd); router.refresh() }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'The receipt could not be removed.') }
    })
  }

  const ordered = [...payments].sort((a, b) => a.paid_on.localeCompare(b.paid_on) || a.created_at.localeCompare(b.created_at))
  return (
    <div className="ledger">
      <div className="ledger-title">Payments received</div>
      <table className="ledger-table">
        <thead>
          <tr><th>Date</th><th>Method</th><th>Reference</th><th className="ledger-num">Amount</th><th className="no-print" aria-label="Actions" /></tr>
        </thead>
        <tbody>
          {ordered.map((payment) => (
            <tr key={payment.id}>
              <td>{fmtDate(payment.paid_on)}</td>
              <td>{PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}</td>
              <td>{payment.reference || <span className="ledger-muted">—</span>}{payment.note && <div className="ledger-muted">{payment.note}</div>}</td>
              <td className="ledger-num">{kes(payment.amount)}</td>
              <td className="no-print ledger-num"><button type="button" className="ledger-remove" disabled={pending} onClick={() => remove(payment)}>Remove</button></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={3}>Total received</td><td className="ledger-num">{kes(total)}</td><td className="no-print" /></tr>
        </tfoot>
      </table>
      {error && <p className="ledger-error no-print" role="alert">{error}</p>}
    </div>
  )
}
