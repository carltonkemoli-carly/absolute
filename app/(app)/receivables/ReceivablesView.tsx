'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { KpiCard, Badge } from '@/components/ui'
import DataTable, { type Column } from '@/components/DataTable'
import { EMPTY_INVOICE_FILTERS, filterInvoices, invoiceListTotals, invoiceOutstanding, invoiceOverdueDays, type InvoicePaymentFilter } from '@/lib/invoice-filters'
import { agingBuckets, debtors } from '@/lib/dashboard'
import { CHART_COLORS, STATUS_COLORS } from '@/lib/chart'
import { kes, fmtDate } from '@/lib/format'
import { PAYMENT_METHOD_LABELS, type Contractor, type Invoice, type PaymentMethod } from '@/lib/types'
import { saveInvoice, addInvoicePayment, markPaid, deleteInvoice, previewInvoiceFromTrips, generateInvoiceFromTrips, type InvoicePreview, type PaymentResult } from './actions'
import './receivables-workspace.css'

const AGING_COLORS = [CHART_COLORS[0], STATUS_COLORS.warn, CHART_COLORS[5], STATUS_COLORS.bad]

function statusOf(invoice: Invoice, today: string): { label: string; tone: 'green' | 'gold' | 'red' | 'neutral' } {
  const owed = invoiceOutstanding(invoice)
  if (owed <= 0) return { label: 'Paid', tone: 'green' }
  const late = invoiceOverdueDays(invoice, today)
  if (late > 0) return { label: `${late}d late`, tone: 'red' }
  if (Number(invoice.amount_paid) > 0) return { label: 'Part paid', tone: 'gold' }
  return { label: 'Unpaid', tone: 'neutral' }
}

export default function ReceivablesView({
  invoices, contractors, receipts, today, unbilledValue = 0, unbilledCount = 0,
}: {
  invoices: Invoice[]; contractors: Contractor[]
  receipts: Record<string, number>; today: string
  unbilledValue?: number; unbilledCount?: number
}) {
  const router = useRouter()
  const [filters, setFilters] = useState({ ...EMPTY_INVOICE_FILTERS })
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [panel, setPanel] = useState<'generate' | 'manual' | null>(null)
  const [payId, setPayId] = useState<string | null>(null)
  const cname = (id: string | null) => contractors.find((c) => c.id === id)?.name ?? '—'

  // Generate-from-trips state
  const [genContractor, setGenContractor] = useState('')
  const [genMonth, setGenMonth] = useState(today.slice(0, 7))
  const [preview, setPreview] = useState<InvoicePreview | null>(null)
  const [busy, startBusy] = useTransition()

  async function mutate<T>(action: (fd: FormData) => Promise<T>, fd: FormData, success: (result: T) => void) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true); setMutationError(null)
    try { const result = await action(fd); success(result); router.refresh() }
    catch (error) { setMutationError(error instanceof Error ? error.message : 'The change could not be saved. Please try again.') }
    finally { savingRef.current = false; setSaving(false) }
  }
  function paymentSaved(result: PaymentResult) {
    toast.success(result.ledger ? 'Payment recorded.' : 'Payment recorded. (The payment ledger is not set up on the database yet, so only the paid total was updated.)')
    setPayId(null)
  }
  function doPreview() {
    if (busy || saving) return
    setMutationError(null)
    setPreview(null)
    startBusy(async () => {
      try { setPreview(await previewInvoiceFromTrips(genContractor, genMonth)) }
      catch (error) { setMutationError(error instanceof Error ? error.message : 'The invoice preview could not be loaded.') }
    })
  }

  // ---- Position: a running balance, not a monthly flow ----
  const totalBilled = invoices.reduce((s, i) => s + Number(i.amount), 0)
  const totalCollected = invoices.reduce((s, i) => s + Number(i.amount_paid), 0)
  const aging = agingBuckets(invoices, today)
  const outstanding = aging.reduce((s, b) => s + b.amount, 0)
  const overdue = outstanding - aging[0].amount
  const agingMax = Math.max(1, ...aging.map((b) => b.amount))
  const owing = debtors(invoices, contractors, today)

  const sorted = filterInvoices(invoices, contractors, filters, today)
  const listTotals = invoiceListTotals(sorted, today)
  const isFiltered = filters.search.trim() !== '' || filters.contractorId !== '' || filters.payment !== 'all'

  const columns: Column<Invoice>[] = [
    { label: 'Invoice', role: 'primary', render: (i) => (
      <>
        <Link href={`/receivables/${i.id}`} className="rcv-link"><strong>{cname(i.contractor_id)}</strong></Link>
        <div className="rcv-sub">{[i.invoice_no, i.period_label].filter(Boolean).join(' · ') || 'No number'}</div>
      </>
    ) },
    { label: 'Due', nowrap: true, render: (i) => i.due_date ? fmtDate(i.due_date) : '—' },
    { label: 'Amount', align: 'right', render: (i) => kes(i.amount) },
    { label: 'Paid', align: 'right', render: (i) => (
      <>
        {kes(i.amount_paid)}
        {receipts[i.id] > 0 && <div className="rcv-sub">{receipts[i.id]} {receipts[i.id] === 1 ? 'receipt' : 'receipts'}</div>}
      </>
    ) },
    { label: 'Owed', align: 'right', render: (i) => <strong>{kes(invoiceOutstanding(i))}</strong> },
    { label: 'Status', render: (i) => { const s = statusOf(i, today); return <Badge tone={s.tone}>{s.label}</Badge> } },
    { label: '', role: 'actions', render: (i) => (
      <div className="rcv-actions">
        {invoiceOutstanding(i) > 0 && (
          <button type="button" className="rcv-btn" disabled={saving} onClick={() => { setPayId(payId === i.id ? null : i.id); setMutationError(null) }} aria-expanded={payId === i.id}>
            {payId === i.id ? 'Cancel' : 'Record payment'}
          </button>
        )}
        <Link href={`/receivables/${i.id}`} className="rcv-btn">View</Link>
        <form onSubmit={(event) => { event.preventDefault(); if (confirm(`Delete this invoice for ${cname(i.contractor_id)}? Its receipts are deleted with it.`)) void mutate(deleteInvoice, new FormData(event.currentTarget), () => toast.success('Invoice deleted.')) }}>
          <input type="hidden" name="id" value={i.id} />
          <button type="submit" disabled={saving} className="rcv-btn rcv-btn-danger">Delete</button>
        </form>
        {payId === i.id && <PaymentForm invoice={i} today={today} saving={saving}
          onSubmit={(fd) => void mutate(addInvoicePayment, fd, paymentSaved)}
          onSettle={(fd) => void mutate(markPaid, fd, paymentSaved)} />}
      </div>
    ) },
  ]

  return (
    <div className="rcv">
      <div className="rcv-kpis">
        <KpiCard label="Owed to you" value={kes(outstanding)} tone={overdue > 0 ? 'var(--danger)' : outstanding > 0 ? 'var(--gold)' : 'var(--ink)'}
          sub={overdue > 0 ? `${kes(overdue)} past its due date` : outstanding > 0 ? 'Nothing overdue' : 'Everything collected'}
          chart={outstanding > 0 ? <span className="rcv-aging-mini" role="img" aria-label="Share of the balance by how late it is">{aging.map((b, index) => b.amount > 0 && <i key={b.key} style={{ flex: b.amount, background: AGING_COLORS[index] }} />)}</span> : undefined} />
        <KpiCard label="Collected" value={kes(totalCollected)} tone="var(--ok)" sub={totalBilled > 0 ? `${Math.round((totalCollected / totalBilled) * 100)}% of ${kes(totalBilled)} billed` : 'Nothing billed yet'} />
        <KpiCard label="Not yet invoiced" value={kes(unbilledValue)} tone={unbilledValue > 0 ? 'var(--gold)' : 'var(--ink)'}
          sub={unbilledCount > 0 ? `${unbilledCount} completed ${unbilledCount === 1 ? 'trip' : 'trips'} from the last 60 days` : 'All recent work is billed'} />
        <KpiCard label="Invoices" value={String(invoices.length)} sub={`${invoices.filter((i) => invoiceOutstanding(i) > 0).length} still open`} />
      </div>

      {invoices.length > 0 && (
        <div className="rcv-row">
          <section className="card rcv-panel" aria-labelledby="rcv-aging">
            <header className="rcv-panel-head"><h2 id="rcv-aging">How late the money is</h2><span>As of today</span></header>
            {outstanding <= 0 ? <p className="rcv-quiet">Every invoice is settled.</p> : (
              <ul className="rcv-aging">
                {aging.map((b, index) => (
                  <li key={b.key}>
                    <span>{b.label}</span>
                    <span className="rcv-aging-bar"><i style={{ width: `${b.amount > 0 ? Math.max(2, (b.amount / agingMax) * 100) : 0}%`, background: AGING_COLORS[index] }} /></span>
                    <b>{kes(b.amount)}</b>
                    <em>{b.count ? `${b.count} ${b.count === 1 ? 'invoice' : 'invoices'}` : '—'}</em>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card rcv-panel" aria-labelledby="rcv-debtors">
            <header className="rcv-panel-head"><h2 id="rcv-debtors">Who owes you</h2><span>Largest balance first</span></header>
            {owing.length === 0 ? <p className="rcv-quiet">Nobody owes anything.</p> : (
              <ul className="rcv-debtors">
                {owing.map((row) => (
                  <li key={row.contractorId ?? 'direct'}>
                    <button type="button" onClick={() => setFilters({ ...EMPTY_INVOICE_FILTERS, contractorId: row.contractorId ?? '', payment: 'all' })} title="Show this supplier's invoices">
                      <span><strong>{row.name}</strong><small>{row.oldestDaysLate > 0 ? `${kes(row.overdue)} overdue, up to ${row.oldestDaysLate} days late` : `${row.invoices} ${row.invoices === 1 ? 'invoice' : 'invoices'} within terms`}</small></span>
                      <b style={{ color: row.overdue > 0 ? 'var(--danger)' : undefined }}>{kes(row.outstanding)}</b>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <div className="card rcv-bar">
        <div className="rcv-bar-row">
          <label className="record-search rcv-search">
            <span className="workspace-sr-only">Search invoices</span>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
            <input type="search" value={filters.search} onChange={(event) => setFilters((c) => ({ ...c, search: event.target.value }))} placeholder="Invoice no., supplier or period…" />
          </label>
          <select className="input rcv-filter" aria-label="Supplier" data-on={filters.contractorId ? '' : undefined} value={filters.contractorId} onChange={(event) => setFilters((c) => ({ ...c, contractorId: event.target.value }))}>
            <option value="">All suppliers</option>
            {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input rcv-filter" aria-label="Payment state" data-on={filters.payment !== 'all' ? '' : undefined} value={filters.payment} onChange={(event) => setFilters((c) => ({ ...c, payment: event.target.value as InvoicePaymentFilter }))}>
            <option value="all">Any state</option><option value="unpaid">Unpaid</option><option value="part-paid">Part paid</option><option value="overdue">Overdue</option><option value="paid">Paid</option>
          </select>
          {isFiltered && <button type="button" className="rcv-clear" onClick={() => setFilters({ ...EMPTY_INVOICE_FILTERS })}>Clear</button>}
          <div className="rcv-bar-actions">
            <button type="button" className="btn-primary rcv-action" disabled={saving || busy} onClick={() => { setPanel(panel === 'generate' ? null : 'generate'); setPreview(null); setMutationError(null) }}>{panel === 'generate' ? 'Close' : 'Invoice a month'}</button>
            <button type="button" className="btn-ghost rcv-action" disabled={saving || busy} onClick={() => { setPanel(panel === 'manual' ? null : 'manual'); setMutationError(null) }}>{panel === 'manual' ? 'Close' : 'Manual invoice'}</button>
          </div>
        </div>
        <div className="rcv-bar-foot" role="status" aria-live="polite">
          <span><strong>{sorted.length}</strong>{isFiltered ? ` of ${invoices.length}` : ''} {invoices.length === 1 && !isFiltered ? 'invoice' : 'invoices'}</span>
          {isFiltered && sorted.length > 0 && <span className="rcv-list-totals">{kes(listTotals.billed)} billed · {kes(listTotals.collected)} paid · <b>{kes(listTotals.outstanding)} owed</b>{listTotals.overdue > 0 && <> · <b style={{ color: 'var(--danger)' }}>{kes(listTotals.overdue)} overdue</b></>}</span>}
        </div>
      </div>

      {mutationError && <div className="invoice-error" role="alert">{mutationError}</div>}

      {panel === 'generate' && (
        <div className="card rcv-form">
          <div className="rcv-form-title">Invoice a supplier for a month</div>
          <p className="rcv-form-note">Every completed trip for the supplier in that month goes on one invoice. Trips already on an invoice are left out.</p>
          <div className="rcv-form-row">
            <label className="field" style={{ minWidth: 200 }}><span>Supplier *</span>
              <select className="input" value={genContractor} onChange={(e) => { setGenContractor(e.target.value); setPreview(null) }}>
                <option value="">Choose…</option>
                {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Month *</span>
              <input type="month" className="input" value={genMonth} onChange={(e) => { setGenMonth(e.target.value); setPreview(null) }} />
            </label>
            <button className="btn-ghost rcv-action" disabled={busy || saving || !genContractor} onClick={doPreview}>{busy && !preview ? 'Checking…' : 'Preview'}</button>
          </div>

          {preview?.ok && (
            <form onSubmit={(event) => { event.preventDefault(); void mutate(generateInvoiceFromTrips, new FormData(event.currentTarget), () => { toast.success('Invoice created.'); setPanel(null); setPreview(null); setGenContractor('') }) }} className="rcv-preview animate-fadeup">
              <input type="hidden" name="contractor_id" value={genContractor} />
              <input type="hidden" name="month" value={genMonth} />
              <div className="rcv-preview-head">
                <div>
                  <strong>{cname(genContractor)}</strong> · {preview.label} · {preview.count} {preview.count === 1 ? 'trip' : 'trips'}
                  {preview.alreadyBilled ? <div className="rcv-sub">{preview.alreadyBilled} more {preview.alreadyBilled === 1 ? 'trip is' : 'trips are'} already on an invoice and left out.</div> : null}
                </div>
                <div className="font-display rcv-preview-total">{kes(preview.total)}</div>
              </div>
              <div className="rcv-form-row">
                <label className="field"><span>Invoice no.</span><input name="invoice_no" className="input" placeholder="INV-1042" /></label>
                <label className="field"><span>Payment terms</span>
                  <select name="due_days" className="input" defaultValue="30">
                    <option value="7">Due in 7 days</option><option value="14">Due in 14 days</option><option value="30">Due in 30 days</option><option value="45">Due in 45 days</option>
                  </select>
                </label>
                <button type="submit" className="btn-primary rcv-action" disabled={busy || saving}>{saving ? 'Creating…' : 'Create invoice'}</button>
              </div>
            </form>
          )}
          {preview && !preview.ok && preview.message && (
            <div className="rcv-preview-note animate-fadeup" data-tone={preview.duplicate ? 'warn' : undefined}>{preview.message}</div>
          )}
        </div>
      )}

      {panel === 'manual' && (
        <form onSubmit={(event) => { event.preventDefault(); void mutate(saveInvoice, new FormData(event.currentTarget), () => { toast.success('Invoice saved.'); setPanel(null) }) }} className="card rcv-form">
          <div className="rcv-form-title">Manual invoice</div>
          <div className="grid-form">
            <label className="field"><span>Supplier *</span>
              <select name="contractor_id" className="input" required defaultValue="">
                <option value="" disabled>Choose…</option>
                {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Period</span><input name="period_label" className="input" placeholder="e.g. June 2026" /></label>
            <label className="field"><span>Invoice no.</span><input name="invoice_no" className="input" placeholder="INV-1042" /></label>
            <label className="field"><span>Amount (KES) *</span><input name="amount" type="number" step="1" min="1" className="input" required /></label>
            <label className="field"><span>Issue date</span><input name="issue_date" type="date" className="input" defaultValue={today} /></label>
            <label className="field"><span>Due date</span><input name="due_date" type="date" className="input" /></label>
            <label className="field" style={{ gridColumn: 'span 2' }}><span>Notes</span><input name="notes" className="input" /></label>
          </div>
          <div style={{ marginTop: 14 }}>
            <button type="submit" disabled={saving} className="btn-primary rcv-action">{saving ? 'Saving…' : 'Save invoice'}</button>
          </div>
        </form>
      )}

      <DataTable rows={sorted} rowKey={(i) => i.id} minWidth={820} columns={columns}
        empty={invoices.length ? 'No invoices match these filters.' : 'No invoices yet. Use "Invoice a month" to bill a supplier for their completed trips.'} />
    </div>
  )
}

// Record one receipt: how much, when, how, and the reference on the statement.
function PaymentForm({ invoice, today, saving, onSubmit, onSettle }: {
  invoice: Invoice; today: string; saving: boolean
  onSubmit: (fd: FormData) => void; onSettle: (fd: FormData) => void
}) {
  const owed = Math.round((Number(invoice.amount) - Number(invoice.amount_paid)) * 100) / 100
  const [amount, setAmount] = useState(String(owed))
  const [method, setMethod] = useState<PaymentMethod>('mpesa')
  const full = Number(amount) === owed
  return (
    <form className="rcv-pay animate-fadeup" onSubmit={(event) => { event.preventDefault(); const fd = new FormData(event.currentTarget); (full ? onSettle : onSubmit)(fd) }}>
      <input type="hidden" name="id" value={invoice.id} />
      <input type="hidden" name="expected_amount" value={invoice.amount} />
      <input type="hidden" name="expected_amount_paid" value={invoice.amount_paid} />
      <div className="rcv-pay-grid">
        <label className="field"><span>Amount received</span><input name="amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
        <label className="field"><span>Date</span><input name="paid_on" type="date" className="input" defaultValue={today} max={today} required /></label>
        <label className="field"><span>How</span>
          <select name="method" className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
          </select>
        </label>
        <label className="field"><span>{method === 'mpesa' ? 'M-Pesa code' : method === 'cheque' ? 'Cheque no.' : 'Reference'}</span><input name="reference" className="input" placeholder={method === 'mpesa' ? 'e.g. QKJ7H2X9PL' : ''} /></label>
      </div>
      <div className="rcv-pay-foot">
        <span className="rcv-sub">{full ? 'This settles the invoice.' : `${kes(owed - Number(amount || 0))} will still be owed.`}</span>
        <button type="submit" className="btn-primary rcv-action" disabled={saving}>{saving ? 'Saving…' : full ? 'Record & settle' : 'Record payment'}</button>
      </div>
    </form>
  )
}
