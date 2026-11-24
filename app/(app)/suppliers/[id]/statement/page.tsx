import { notFound, redirect } from 'next/navigation'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { getCompany, listContractors, listInvoices, listPayments } from '@/lib/db'
import { buildStatement, reminderMessage } from '@/lib/statement'
import { kes, fmtDate } from '@/lib/format'
import { nairobiToday } from '@/lib/nairobi-date'
import { PAYMENT_METHOD_LABELS } from '@/lib/types'
import StatementActions from './StatementActions'
import './statement.css'

export const dynamic = 'force-dynamic'

export default async function SupplierStatementPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ all?: string }> }) {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/trips')

  const { id } = await params
  const showAll = (await searchParams).all === '1'
  const [contractors, invoices, company] = await Promise.all([listContractors(), listInvoices(), getCompany()])
  const supplier = contractors.find((contractor) => contractor.id === id)
  if (!supplier) notFound()

  const mine = invoices.filter((invoice) => invoice.contractor_id === id)
  const payments = await listPayments(mine.map((invoice) => invoice.id))
  const today = nairobiToday()
  const statement = buildStatement(mine, payments, today, showAll)
  const message = reminderMessage(supplier.name, company.name, statement, today)
  const base = `/suppliers/${encodeURIComponent(id)}/statement`

  return (
    <div className="statement-page">
      <StatementActions backHref={`/suppliers?c=${encodeURIComponent(id)}`} allHref={showAll ? base : `${base}?all=1`} showAll={showAll} message={message} />

      <div className="invoice-sheet card statement-sheet">
        <header className="statement-head">
          <div>
            <div className="statement-company">{company.name}</div>
            {company.tagline && <div className="statement-muted">{company.tagline}</div>}
            <div className="statement-small">{[company.location, company.email, company.phone].filter(Boolean).join(' · ')}</div>
          </div>
          <div className="statement-title">
            <div>STATEMENT</div>
            <span>As of {fmtDate(today)}</span>
          </div>
        </header>

        <section className="statement-to">
          <div className="statement-label">Account</div>
          <div className="statement-supplier">{supplier.name}</div>
          {supplier.billing_notes && <div className="statement-muted">{supplier.billing_notes}</div>}
        </section>

        {statement.lines.length === 0 ? (
          <p className="statement-empty">{showAll ? `No invoices have been raised for ${supplier.name}.` : `Nothing is owed by ${supplier.name}. Every invoice is settled.`}</p>
        ) : (
          <>
            <section className="statement-summary" aria-label="Summary">
              <div><span>{showAll ? 'Billed' : 'Billed on these invoices'}</span><strong>{kes(statement.billed)}</strong></div>
              <div><span>Received</span><strong>{kes(statement.paid)}</strong></div>
              <div><span>Balance due</span><strong>{kes(statement.owed)}</strong></div>
              <div data-late={statement.overdue > 0 || undefined}><span>Past due</span><strong>{kes(statement.overdue)}</strong>{statement.oldestDaysLate > 0 && <small>up to {statement.oldestDaysLate} days late</small>}</div>
            </section>

            {statement.owed > 0 && (
              <section className="statement-aging" aria-label="How late the balance is">
                {statement.aging.map((bucket) => (
                  <div key={bucket.key}><span>{bucket.label}</span><strong>{kes(bucket.amount)}</strong></div>
                ))}
              </section>
            )}

            <table className="statement-table">
              <thead>
                <tr><th>Invoice</th><th>Issued</th><th>Due</th><th className="statement-num">Amount</th><th className="statement-num">Received</th><th className="statement-num">Owed</th></tr>
              </thead>
              <tbody>
                {statement.lines.map((line) => (
                  <tr key={line.invoice.id} className={line.owed <= 0 ? 'statement-settled' : undefined}>
                    <td>
                      <strong>{line.invoice.invoice_no ?? 'No number'}</strong>
                      <div className="statement-small">{line.invoice.period_label ?? ''}</div>
                      {line.receipts.map((receipt) => (
                        <div key={receipt.id} className="statement-receipt">
                          Received {fmtDate(receipt.paid_on)}, {PAYMENT_METHOD_LABELS[receipt.method] ?? receipt.method}{receipt.reference ? `, ${receipt.reference}` : ''}: {kes(receipt.amount)}
                        </div>
                      ))}
                    </td>
                    <td>{line.invoice.issue_date ? fmtDate(line.invoice.issue_date) : '·'}</td>
                    <td>
                      {line.invoice.due_date ? fmtDate(line.invoice.due_date) : '·'}
                      {line.daysLate > 0 && <div className="statement-late">{line.daysLate} days late</div>}
                    </td>
                    <td className="statement-num">{kes(line.invoice.amount)}</td>
                    <td className="statement-num">{kes(line.invoice.amount_paid)}</td>
                    <td className="statement-num"><strong>{kes(line.owed)}</strong></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={5}>Balance due</td><td className="statement-num">{kes(statement.owed)}</td></tr>
              </tfoot>
            </table>
          </>
        )}

        <footer className="statement-foot">
          Please quote the invoice number and send the M-Pesa or bank reference when you pay. {company.name}
        </footer>
      </div>
    </div>
  )
}
