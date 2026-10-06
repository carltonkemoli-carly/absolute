'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Card } from '@/components/ui'
import { kes, fmtDate } from '@/lib/format'
import { EXPENSE_CATEGORIES, type Driver, type Expense, type Vehicle } from '@/lib/types'
import { saveExpense, deleteExpense, postMonthlyWages, copyLastMonthExpenses } from './actions'

// Categories offered as one-tap chips (the common recurring costs).
const QUICK_CATS = ['Driver Wages', 'Insurance', 'Parking', 'Car Wash', 'Airtime', 'Spare Parts']

export default function ExpenseManager({
  expenses, vehicles, drivers, defaultDate, year, month, wageBudget, monthLabel,
}: {
  expenses: Expense[]; vehicles: Vehicle[]; drivers: Driver[]; defaultDate: string
  year: number; month: number; wageBudget: number; monthLabel: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)
  const [presetCat, setPresetCat] = useState('')
  const [cat, setCat] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const plate = (id: string | null) => vehicles.find((v) => v.id === id)?.plate ?? ''
  const dname = (id: string | null) => drivers.find((d) => d.id === id)?.name ?? ''

  const filtered = useMemo(() => cat ? expenses.filter((e) => e.category === cat) : expenses, [cat, expenses])

  function openAdd(category = '') {
    setPresetCat(category)
    setEditing('new')
  }

  async function runGenerator(kind: 'wages' | 'copy') {
    if (busy) return
    const fd = new FormData()
    fd.set('year', String(year)); fd.set('month', String(month))
    try {
      setBusy(kind)
      if (kind === 'wages') {
        if (!confirm(`Post driver wages for ${monthLabel}? This adds a "Driver Wages" expense for each active driver with a wage set.`)) { setBusy(null); return }
        const r = await postMonthlyWages(fd)
        if (r.added === 0) toast(r.skipped > 0 ? 'Wages already posted this month.' : 'No drivers have a wage set yet.')
        else toast.success(`Posted wages for ${r.added} driver${r.added === 1 ? '' : 's'}.`)
      } else {
        if (!confirm(`Copy last month's expenses into ${monthLabel}? Matching entries already here are skipped.`)) { setBusy(null); return }
        const r = await copyLastMonthExpenses(fd)
        toast.success(r.added === 0 ? 'Nothing new to copy.' : `Copied ${r.added} expense${r.added === 1 ? '' : 's'}.`)
      }
      router.refresh()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {/* Fast ways to log the recurring costs */}
      <Card title="Log costs faster">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <button className="btn-primary" style={genBtn} disabled={busy !== null} onClick={() => runGenerator('wages')}>
            {busy === 'wages' ? 'Posting…' : `Post ${monthLabel} wages`}{wageBudget > 0 && busy !== 'wages' ? ` · ${kes(wageBudget)}` : ''}
          </button>
          <button className="btn-ghost" style={genBtn} disabled={busy !== null} onClick={() => runGenerator('copy')}>
            {busy === 'copy' ? 'Copying…' : 'Copy last month'}
          </button>
          <span style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px' }} />
          <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>Quick add:</span>
          {QUICK_CATS.map((c) => (
            <button key={c} style={chipStyle} onClick={() => openAdd(c)}>{c}</button>
          ))}
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 12, margin: '16px 0', alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn-primary" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} onClick={() => (editing === 'new' ? setEditing(null) : openAdd())}>
          {editing === 'new' ? 'Close' : '+ Add expense'}
        </button>
      </div>

      {editing && (
        <div className="card animate-fadeup" style={{ padding: 20, marginBottom: 18 }}>
          <form action={async (fd) => { await saveExpense(fd); setEditing(null); router.refresh() }} key={editing === 'new' ? `new-${presetCat}` : editing.id}>
            {editing !== 'new' && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid-form">
              <label className="field"><span>Date *</span>
                <input name="expense_date" type="date" className="input" required defaultValue={editing === 'new' ? defaultDate : editing.expense_date} />
              </label>
              <label className="field"><span>Category *</span>
                <select name="category" className="input" required defaultValue={editing === 'new' ? presetCat : editing.category}>
                  <option value="">—</option>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="field"><span>Amount (KES) *</span>
                <input name="amount" type="number" step="1" className="input" required autoFocus={editing === 'new'} defaultValue={editing === 'new' ? '' : editing.amount} />
              </label>
              <label className="field"><span>Payee</span>
                <input name="payee" className="input" defaultValue={editing === 'new' ? '' : editing.payee ?? ''} placeholder="Who was paid" />
              </label>
              <label className="field"><span>Vehicle (optional)</span>
                <select name="vehicle_id" className="input" defaultValue={editing === 'new' ? '' : editing.vehicle_id ?? ''}>
                  <option value="">—</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
                </select>
              </label>
              <label className="field"><span>Driver (optional)</span>
                <select name="driver_id" className="input" defaultValue={editing === 'new' ? '' : editing.driver_id ?? ''}>
                  <option value="">—</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label className="field" style={{ gridColumn: 'span 2' }}><span>Description</span>
                <input name="description" className="input" defaultValue={editing === 'new' ? '' : editing.description ?? ''} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="btn-primary" style={{ padding: '9px 20px', fontSize: 14, cursor: 'pointer' }}>Save</button>
              <button type="button" className="btn-ghost" style={{ padding: '9px 18px', fontSize: 14, cursor: 'pointer' }} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 760 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <Th>Date</Th><Th>Category</Th><Th>Payee</Th><Th>For</Th><Th right>Amount</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 28, textAlign: 'center', color: 'var(--ink3)' }}>No expenses logged for {monthLabel}. Use the quick-add buttons above to get started.</td></tr>
            )}
            {filtered.map((e) => (
              <tr key={e.id} style={{ borderTop: '1px solid var(--border)' }}>
                <Td>{fmtDate(e.expense_date)}</Td>
                <Td><strong>{e.category}</strong>{e.description && <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{e.description}</div>}</Td>
                <Td>{e.payee ?? '—'}</Td>
                <Td>{[plate(e.vehicle_id), dname(e.driver_id)].filter(Boolean).join(' · ') || '—'}</Td>
                <Td right><strong>{kes(e.amount)}</strong></Td>
                <Td>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setPresetCat(''); setEditing(e) }} style={linkBtn}>Edit</button>
                    <form action={async (fd) => { await deleteExpense(fd); router.refresh() }} onSubmit={(ev) => { if (!confirm('Delete this expense?')) ev.preventDefault() }}>
                      <input type="hidden" name="id" value={e.id} />
                      <button type="submit" style={{ ...linkBtn, color: 'var(--danger)' }}>Delete</button>
                    </form>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

const genBtn: React.CSSProperties = { padding: '9px 16px', fontSize: 13.5, cursor: 'pointer' }
const chipStyle: React.CSSProperties = { padding: '5px 11px', fontSize: 12.5, fontWeight: 600, border: '1px solid var(--border-med)', background: 'var(--surface)', color: 'var(--ink2)', borderRadius: 999, cursor: 'pointer' }
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--accent-mid)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }
function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: right ? 'right' : 'left' }}>{children}</th>
}
function Td({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <td style={{ padding: '11px 14px', textAlign: right ? 'right' : 'left', verticalAlign: 'top' }}>{children}</td>
}
