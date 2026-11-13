'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { StatCard, Card, Section } from '@/components/ui'
import RecordToolbar from '@/components/RecordToolbar'
import { nairobiToday } from '@/lib/nairobi-date'
import { EMPTY_INVOICE_FILTERS, filterInvoices, invoiceListTotals, invoiceOutstanding, invoiceOverdueDays, type InvoicePaymentFilter } from '@/lib/invoice-filters'
import './receivables-workspace.css'
import SegmentDonut, { type Seg } from '@/components/SegmentDonut'
import { kes, kesPlain, fmtDate } from '@/lib/format'
import type { Contractor, Invoice } from '@/lib/types'
import { saveInvoice, recordPayment, markPaid, deleteInvoice, previewInvoiceFromTrips, generateInvoiceFromTrips, type InvoicePreview } from './actions'

// Read fresh on each call: as module-level constants these froze the date for the
// life of the process, and took the UTC day — a day behind between midnight and
// 3am in Nairobi, which is exactly when an invoice tips into "overdue".
const todayIso = () => nairobiToday()
const thisMonthIso = () => todayIso().slice(0, 7)

const outstanding = invoiceOutstanding
const overdueDays = (i: Invoice) => invoiceOverdueDays(i, todayIso())

function statusOf(i: Invoice): { label: string; color: string } {
  const out = outstanding(i)
  if (out <= 0) return { label: 'Paid', color: 'var(--accent)' }
  if (overdueDays(i) > 0) return { label: `Overdue ${overdueDays(i)}d`, color: 'var(--danger)' }
  if (Number(i.amount_paid) > 0) return { label: 'Part-paid', color: 'var(--gold)' }
  return { label: 'Unpaid', color: 'var(--gold)' }
}

export default function ReceivablesView({
  invoices, contractors, unbilledValue = 0, unbilledCount = 0,
}: {
  invoices: Invoice[]; contractors: Contractor[]
  unbilledValue?: number; unbilledCount?: number
}) {
  const router = useRouter()
  const [filters, setFilters] = useState({ ...EMPTY_INVOICE_FILTERS })
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [payId, setPayId] = useState<string | null>(null)
  const cname = (id: string | null) => contractors.find((c) => c.id === id)?.name ?? '—'

  // Generate-from-trips state
  const [genContractor, setGenContractor] = useState('')
  const [genMonth, setGenMonth] = useState(thisMonthIso())
  const [preview, setPreview] = useState<InvoicePreview | null>(null)
  const [busy, startBusy] = useTransition()

  async function mutate(action: (fd: FormData) => Promise<void>, fd: FormData, success: () => void) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true); setMutationError(null)
    try { await action(fd); success(); router.refresh() }
    catch (error) { setMutationError(error instanceof Error ? error.message : 'The change could not be saved. Please try again.') }
    finally { savingRef.current = false; setSaving(false) }
  }
  function doPreview() {
    if (busy || saving) return
    setMutationError(null)
    setPreview(null)
    startBusy(async () => {
      // The outcome renders inline below the form and stays put — a duplicate
      // warning is a decision point, not something to flash for four seconds.
      try { setPreview(await previewInvoiceFromTrips(genContractor, genMonth)) }
      catch (error) { setMutationError(error instanceof Error ? error.message : 'The invoice preview could not be loaded.') }
    })
  }
  function doGenerate(fd: FormData) {
    if (busy) return
    void mutate(generateInvoiceFromTrips, fd, () => {
      toast.success('Invoice created from trips.')
      setGenerating(false); setPreview(null); setGenContractor('')
    })
  }

  const totalBilled = invoices.reduce((s, i) => s + Number(i.amount), 0)
  const totalCollected = invoices.reduce((s, i) => s + Number(i.amount_paid), 0)
  const totalOutstanding = invoices.reduce((s, i) => s + outstanding(i), 0)
  const overdue = invoices.reduce((s, i) => s + (overdueDays(i) > 0 ? outstanding(i) : 0), 0)

  // Who owes you, by contractor
  const byContractor = contractors.map((c) => {
    const mine = invoices.filter((i) => i.contractor_id === c.id)
    const out = mine.reduce((s, i) => s + outstanding(i), 0)
    const od = mine.reduce((s, i) => s + (overdueDays(i) > 0 ? outstanding(i) : 0), 0)
    const worst = Math.max(0, ...mine.map(overdueDays))
    return { id: c.id, name: c.name, out, od, worst }
  }).filter((c) => c.out > 0).sort((a, b) => b.out - a.out)

  const sorted = filterInvoices(invoices, contractors, filters, todayIso())
  const listTotals = invoiceListTotals(sorted, todayIso())
  const paymentLabel = { all: 'All payment states', unpaid: 'Unpaid', 'part-paid': 'Part-paid', paid: 'Paid', overdue: 'Overdue' }[filters.payment]
  const filterSummary = [filters.search.trim() ? `Search: ${filters.search.trim()}` : '', filters.contractorId ? cname(filters.contractorId) : '', filters.payment !== 'all' ? paymentLabel : ''].filter(Boolean).join(' · ')

  const statusSegs: Seg[] = [
    { label: 'Collected', value: totalCollected, color: '#2C7A53' },
    { label: 'Outstanding', value: Math.max(0, totalOutstanding - overdue), color: '#C9A227' },
    { label: 'Overdue', value: overdue, color: '#BC3E22' },
  ].filter((s) => s.value > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Section title="Current position · all invoices">
        <div className="grid-stats">
          <StatCard label="Outstanding" value={kes(totalOutstanding)} hint="owed to you" accent={totalOutstanding > 0 ? 'var(--gold)' : 'var(--accent)'} />
          <StatCard label="Overdue" value={kes(overdue)} hint="past due date" accent={overdue > 0 ? 'var(--danger)' : 'var(--accent)'} />
          <StatCard label="Collected" value={kes(totalCollected)} hint={`of ${kes(totalBilled)} billed`} accent="var(--accent)" />
          <StatCard label="Not yet invoiced" value={kes(unbilledValue)}
            hint={unbilledCount > 0 ? `${unbilledCount} trip${unbilledCount === 1 ? '' : 's'} ready to bill` : 'all recent work billed'}
            accent={unbilledValue > 0 ? 'var(--gold)' : 'var(--accent)'} />
          <StatCard label="Invoices" value={String(invoices.length)} />
        </div>
      </Section>

      {invoices.length > 0 && (
        <div className={byContractor.length > 0 ? 'grid-2' : undefined}>
          <Card title="Collection status">
            {statusSegs.length === 0
              ? <p style={{ fontSize: 13.5, color: 'var(--ink3)' }}>Nothing billed yet.</p>
              : <SegmentDonut data={statusSegs} centerValue={kesPlain(totalBilled)} centerLabel="Ksh billed" centerSize={18} money />}
          </Card>
          {byContractor.length > 0 && (
            <Card title="Who owes you">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {byContractor.map((c) => (
                  <div key={c.id} style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: c.od > 0 ? 'var(--danger-light)' : 'var(--surface2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <strong>{c.name}</strong>
                      <span className="font-display" style={{ fontWeight: 700 }}>{kes(c.out)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: c.od > 0 ? 'var(--danger)' : 'var(--ink3)', marginTop: 3 }}>
                      {c.od > 0 ? `${kes(c.od)} overdue · up to ${c.worst} days late` : 'within terms'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <RecordToolbar search={filters.search} onSearchChange={value => setFilters(current => ({ ...current, search: value }))}
        searchLabel="Search invoices" searchPlaceholder="Invoice no., contractor or period…" count={sorted.length} countLabel={`of ${invoices.length} invoices`}
        filterSummary={filterSummary} onClearFilters={() => setFilters({ ...EMPTY_INVOICE_FILTERS })}
        action={<><button type="button" className="btn-primary invoice-action" disabled={saving || busy} onClick={() => { setGenerating(value => !value); setCreating(false); setPreview(null); setMutationError(null) }}>{generating ? 'Close generator' : 'Generate invoices'}</button><button type="button" className="btn-ghost invoice-action" disabled={saving || busy} onClick={() => { setCreating(value => !value); setGenerating(false); setMutationError(null) }}>{creating ? 'Close form' : 'New manual invoice'}</button></>}>
        <label className="invoice-filter"><span>Contractor</span><select className="input" aria-label="Filter invoices by contractor" value={filters.contractorId} onChange={event => setFilters(current => ({ ...current, contractorId: event.target.value }))}><option value="">All contractors</option>{contractors.map(contractor => <option key={contractor.id} value={contractor.id}>{contractor.name}</option>)}</select></label>
        <label className="invoice-filter"><span>Payment state</span><select className="input" aria-label="Filter invoices by payment state" value={filters.payment} onChange={event => setFilters(current => ({ ...current, payment: event.target.value as InvoicePaymentFilter }))}><option value="all">All payment states</option><option value="unpaid">Unpaid</option><option value="part-paid">Part-paid</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select></label>
      </RecordToolbar>
      {mutationError && <div className="invoice-error" role="alert">{mutationError}</div>}
      <div className="invoice-list-summary" aria-label="Current invoice list totals">
        <div><span>Current list · billed</span><strong>{kes(listTotals.billed)}</strong></div><div><span>Collected</span><strong>{kes(listTotals.collected)}</strong></div><div><span>Outstanding</span><strong>{kes(listTotals.outstanding)}</strong></div><div><span>Overdue</span><strong>{kes(listTotals.overdue)}</strong></div>
      </div>

      {generating && (
        <div className="card" style={{ padding: 20 }}>
          <div className="font-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Generate an invoice from logged trips</div>
          <p style={{ fontSize: 13, color: 'var(--ink2)', margin: '0 0 14px' }}>Pick a contractor and month. The invoice totals every logged trip for them.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="field" style={{ minWidth: 200 }}><span>Contractor *</span>
              <select className="input" value={genContractor} onChange={(e) => { setGenContractor(e.target.value); setPreview(null) }}>
                <option value="">Choose…</option>
                {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Month *</span>
              <input type="month" className="input" value={genMonth} onChange={(e) => { setGenMonth(e.target.value); setPreview(null) }} />
            </label>
            <button className="btn-ghost" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} disabled={busy || saving || !genContractor} onClick={doPreview}>
              {busy && !preview ? 'Checking…' : 'Preview'}
            </button>
          </div>

          {preview?.ok && (
            <form onSubmit={event => { event.preventDefault(); doGenerate(new FormData(event.currentTarget)) }} className="animate-fadeup" style={{ marginTop: 16, padding: 16, background: 'var(--accent-light)', borderRadius: 'var(--radius-sm)' }}>
              <input type="hidden" name="contractor_id" value={genContractor} />
              <input type="hidden" name="month" value={genMonth} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 14 }}>
                  <strong>{cname(genContractor)}</strong> · {preview.label} · <strong>{preview.count}</strong> un-billed trip{preview.count === 1 ? '' : 's'}
                  {preview.alreadyBilled ? (
                    <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 2 }}>
                      {preview.alreadyBilled} further trip{preview.alreadyBilled === 1 ? '' : 's'} in this period {preview.alreadyBilled === 1 ? 'is' : 'are'} already on an invoice and {preview.alreadyBilled === 1 ? 'has' : 'have'} been left out.
                    </div>
                  ) : null}
                </div>
                <div className="font-display" style={{ fontSize: 22, fontWeight: 700 }}>{kes(preview.total)}</div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 14 }}>
                <label className="field"><span>Invoice no. (optional)</span><input name="invoice_no" className="input" placeholder="INV-1042" /></label>
                <label className="field"><span>Payment terms</span>
                  <select name="due_days" className="input" defaultValue="30">
                    <option value="7">Due in 7 days</option>
                    <option value="14">Due in 14 days</option>
                    <option value="30">Due in 30 days</option>
                    <option value="45">Due in 45 days</option>
                  </select>
                </label>
                <button type="submit" className="btn-primary" style={{ padding: '10px 20px', fontSize: 14, cursor: 'pointer' }} disabled={busy || saving}>
                  {saving ? 'Creating…' : 'Create invoice →'}
                </button>
              </div>
            </form>
          )}

          {/* Nothing to bill, or already billed — say so plainly instead of
              appearing to do nothing when Preview is pressed. */}
          {preview && !preview.ok && preview.message && (
            <div className="animate-fadeup" style={{
              marginTop: 16, padding: '13px 16px', borderRadius: 'var(--radius-sm)',
              background: preview.duplicate ? 'var(--gold-light)' : 'var(--surface2)',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 15 }}>{preview.duplicate ? '⚠' : 'ℹ'}</span>
              <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>{preview.message}</div>
            </div>
          )}
        </div>
      )}

      {creating && (
        <form onSubmit={event => { event.preventDefault(); void mutate(saveInvoice, new FormData(event.currentTarget), () => setCreating(false)) }} className="card" style={{ padding: 20 }}>
          <div className="grid-form">
            <label className="field"><span>Contractor *</span>
              <select name="contractor_id" className="input" required defaultValue="">
                <option value="" disabled>Choose…</option>
                {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Period</span><input name="period_label" className="input" placeholder="e.g. June 2026" /></label>
            <label className="field"><span>Invoice no.</span><input name="invoice_no" className="input" placeholder="INV-1042" /></label>
            <label className="field"><span>Amount (KES) *</span><input name="amount" type="number" step="1" className="input" required /></label>
            <label className="field"><span>Issue date</span><input name="issue_date" type="date" className="input" defaultValue={todayIso()} /></label>
            <label className="field"><span>Due date</span><input name="due_date" type="date" className="input" /></label>
            <label className="field" style={{ gridColumn: 'span 2' }}><span>Notes</span><input name="notes" className="input" /></label>
          </div>
          <div style={{ marginTop: 14 }}>
            <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '9px 20px', fontSize: 14, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save invoice'}</button>
          </div>
        </form>
      )}

      <div className="card invoice-list-scroll" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 820 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <Th>Contractor</Th><Th>Period</Th><Th>Due</Th><Th right>Amount</Th><Th right>Paid</Th><Th right>Outstanding</Th><Th>Status</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '30px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: 26, opacity: 0.6 }}>🧾</div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink2)', marginTop: 6 }}>{invoices.length ? 'No invoices match these filters' : 'No invoices yet'}</div>
                <div style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 4 }}>{invoices.length ? <button type="button" className="invoice-clear" onClick={() => setFilters({ ...EMPTY_INVOICE_FILTERS })}>Clear filters to see all invoices</button> : <>Use <strong>Generate invoices</strong> above to bill a contractor for a month, or add a manual invoice.</>}</div>
              </td></tr>
            )}
            {sorted.map((i) => {
              const st = statusOf(i)
              return (
                <tr key={i.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <Td><strong>{cname(i.contractor_id)}</strong>{i.invoice_no && <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{i.invoice_no}</div>}</Td>
                  <Td>{i.period_label ?? '—'}</Td>
                  <Td>{i.due_date ? fmtDate(i.due_date) : '—'}</Td>
                  <Td right>{kes(i.amount)}</Td>
                  <Td right>{kes(i.amount_paid)}</Td>
                  <Td right><strong>{kes(outstanding(i))}</strong></Td>
                  <Td><span style={{ fontSize: 12, fontWeight: 700, color: st.color }}>{st.label}</span></Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Link href={`/receivables/${i.id}`} style={linkBtn}>View / print</Link>
                      {outstanding(i) > 0 && (
                        <form onSubmit={event => { event.preventDefault(); void mutate(markPaid, new FormData(event.currentTarget), () => toast.success('Invoice marked paid.')) }}>
                          <input type="hidden" name="id" value={i.id} /><input type="hidden" name="expected_amount" value={i.amount} /><input type="hidden" name="expected_amount_paid" value={i.amount_paid} />
                          <button type="submit" disabled={saving} style={linkBtn}>Mark paid</button>
                        </form>
                      )}
                      <button onClick={() => setPayId(payId === i.id ? null : i.id)} style={linkBtn}>Record</button>
                      <form onSubmit={event => { event.preventDefault(); if (confirm('Delete this invoice?')) void mutate(deleteInvoice, new FormData(event.currentTarget), () => toast.success('Invoice deleted.')) }}>
                        <input type="hidden" name="id" value={i.id} />
                        <button type="submit" disabled={saving} style={{ ...linkBtn, color: 'var(--danger)' }}>Delete</button>
                      </form>
                    </div>
                    {payId === i.id && (
                      <form onSubmit={event => { event.preventDefault(); void mutate(recordPayment, new FormData(event.currentTarget), () => setPayId(null)) }} style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                        <input type="hidden" name="id" value={i.id} /><input type="hidden" name="expected_amount" value={i.amount} /><input type="hidden" name="expected_amount_paid" value={i.amount_paid} />
                        <input name="amount_paid" type="number" step="1" className="input" defaultValue={i.amount_paid} style={{ width: 120, padding: '6px 9px' }} placeholder="Paid so far" />
                        <input name="paid_date" type="date" className="input" defaultValue={todayIso()} style={{ width: 150, padding: '6px 9px' }} />
                        <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
                      </form>
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--accent-mid)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }
function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: right ? 'right' : 'left' }}>{children}</th>
}
function Td({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <td style={{ padding: '11px 14px', textAlign: right ? 'right' : 'left', verticalAlign: 'top' }}>{children}</td>
}
