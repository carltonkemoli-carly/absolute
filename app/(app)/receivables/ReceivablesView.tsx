'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { StatCard } from '@/components/ui'
import { kes, fmtDate } from '@/lib/format'
import type { Contractor, Invoice } from '@/lib/types'
import { saveInvoice, recordPayment, markPaid, deleteInvoice, previewInvoiceFromTrips, generateInvoiceFromTrips, type InvoicePreview } from './actions'

const thisMonth = new Date().toISOString().slice(0, 7)

const today = new Date().toISOString().slice(0, 10)
function outstanding(i: Invoice) { return Math.max(0, Number(i.amount) - Number(i.amount_paid)) }
function overdueDays(i: Invoice) {
  if (outstanding(i) <= 0 || !i.due_date) return 0
  const d = Math.round((Date.parse(today) - Date.parse(i.due_date)) / 86400000)
  return d > 0 ? d : 0
}
function statusOf(i: Invoice): { label: string; color: string } {
  const out = outstanding(i)
  if (out <= 0) return { label: 'Paid', color: 'var(--accent)' }
  if (overdueDays(i) > 0) return { label: `Overdue ${overdueDays(i)}d`, color: 'var(--danger)' }
  if (Number(i.amount_paid) > 0) return { label: 'Part-paid', color: 'var(--gold)' }
  return { label: 'Unpaid', color: 'var(--gold)' }
}

export default function ReceivablesView({ invoices, contractors }: { invoices: Invoice[]; contractors: Contractor[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [payId, setPayId] = useState<string | null>(null)
  const cname = (id: string | null) => contractors.find((c) => c.id === id)?.name ?? '—'

  // Generate-from-trips state
  const [genContractor, setGenContractor] = useState('')
  const [genMonth, setGenMonth] = useState(thisMonth)
  const [preview, setPreview] = useState<InvoicePreview | null>(null)
  const [busy, startBusy] = useTransition()

  function doPreview() {
    setPreview(null)
    startBusy(async () => {
      const p = await previewInvoiceFromTrips(genContractor, genMonth)
      setPreview(p)
      if (!p.ok && p.message) toast.error(p.message)
    })
  }
  function doGenerate(fd: FormData) {
    startBusy(async () => {
      await generateInvoiceFromTrips(fd)
      toast.success('Invoice created from trips.')
      setGenerating(false); setPreview(null); setGenContractor('')
      router.refresh()
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

  const sorted = [...invoices].sort((a, b) => (b.due_date ?? '').localeCompare(a.due_date ?? ''))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="grid-stats">
        <StatCard label="Outstanding" value={kes(totalOutstanding)} hint="owed to you" accent={totalOutstanding > 0 ? 'var(--gold)' : 'var(--accent)'} />
        <StatCard label="Overdue" value={kes(overdue)} hint="past due date" accent={overdue > 0 ? 'var(--danger)' : 'var(--accent)'} />
        <StatCard label="Collected" value={kes(totalCollected)} hint={`of ${kes(totalBilled)} billed`} accent="var(--accent)" />
        <StatCard label="Invoices" value={String(invoices.length)} />
      </div>

      {byContractor.length > 0 && (
        <div className="card" style={{ padding: 18 }}>
          <div className="font-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Who owes you</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
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
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn-primary" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} onClick={() => { setGenerating((v) => !v); setCreating(false); setPreview(null) }}>
          {generating ? 'Close' : '⚡ Generate from trips'}
        </button>
        <button className="btn-ghost" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} onClick={() => { setCreating((v) => !v); setGenerating(false) }}>
          {creating ? 'Close' : '+ Manual invoice'}
        </button>
      </div>

      {generating && (
        <div className="card" style={{ padding: 20 }}>
          <div className="font-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Generate an invoice from logged trips</div>
          <p style={{ fontSize: 13, color: 'var(--ink2)', margin: '0 0 14px' }}>Pick a contractor and month — we’ll total every trip you logged for them and build the invoice.</p>
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
            <button className="btn-ghost" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} disabled={busy || !genContractor} onClick={doPreview}>
              {busy && !preview ? 'Checking…' : 'Preview'}
            </button>
          </div>

          {preview?.ok && (
            <form action={doGenerate} className="animate-fadeup" style={{ marginTop: 16, padding: 16, background: 'var(--accent-light)', borderRadius: 'var(--radius-sm)' }}>
              <input type="hidden" name="contractor_id" value={genContractor} />
              <input type="hidden" name="month" value={genMonth} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 14 }}>
                  <strong>{cname(genContractor)}</strong> · {preview.label} — <strong>{preview.count}</strong> trip{preview.count === 1 ? '' : 's'}
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
                <button type="submit" className="btn-primary" style={{ padding: '10px 20px', fontSize: 14, cursor: 'pointer' }} disabled={busy}>
                  {busy ? 'Creating…' : 'Create invoice →'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {creating && (
        <form action={async (fd) => { await saveInvoice(fd); setCreating(false) }} className="card" style={{ padding: 20 }}>
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
            <label className="field"><span>Issue date</span><input name="issue_date" type="date" className="input" defaultValue={today} /></label>
            <label className="field"><span>Due date</span><input name="due_date" type="date" className="input" /></label>
            <label className="field" style={{ gridColumn: 'span 2' }}><span>Notes</span><input name="notes" className="input" /></label>
          </div>
          <div style={{ marginTop: 14 }}>
            <button type="submit" className="btn-primary" style={{ padding: '9px 20px', fontSize: 14, cursor: 'pointer' }}>Save invoice</button>
          </div>
        </form>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
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
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink2)', marginTop: 6 }}>No invoices yet</div>
                <div style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 4 }}>Use <strong>⚡ Generate from trips</strong> above to bill a contractor for a month in one click, or add a manual invoice.</div>
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
                        <form action={markPaid}>
                          <input type="hidden" name="id" value={i.id} /><input type="hidden" name="amount" value={i.amount} />
                          <button type="submit" style={linkBtn}>Mark paid</button>
                        </form>
                      )}
                      <button onClick={() => setPayId(payId === i.id ? null : i.id)} style={linkBtn}>Record</button>
                      <form action={deleteInvoice} onSubmit={(e) => { if (!confirm('Delete this invoice?')) e.preventDefault() }}>
                        <input type="hidden" name="id" value={i.id} />
                        <button type="submit" style={{ ...linkBtn, color: 'var(--danger)' }}>Delete</button>
                      </form>
                    </div>
                    {payId === i.id && (
                      <form action={async (fd) => { await recordPayment(fd); setPayId(null) }} style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                        <input type="hidden" name="id" value={i.id} /><input type="hidden" name="amount" value={i.amount} />
                        <input name="amount_paid" type="number" step="1" className="input" defaultValue={i.amount_paid} style={{ width: 120, padding: '6px 9px' }} placeholder="Paid so far" />
                        <input name="paid_date" type="date" className="input" defaultValue={today} style={{ width: 150, padding: '6px 9px' }} />
                        <button type="submit" className="btn-primary" style={{ padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>Save</button>
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
