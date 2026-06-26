'use client'

import { useState } from 'react'
import { kes, fmtDate, MONTH_NAMES } from '@/lib/format'

export type BillRow = {
  trip_date: string
  client_name: string
  slip_no: string | null
  voucher_no: string | null
  organization: string
  pickup: string | null
  dropoff: string | null
  amount: number
  express: number
}
export type ContractorBill = {
  id: string
  name: string
  rows: BillRow[]
  revenue: number
  express: number
}

export default function BillingView({ bills, year, month }: { bills: ContractorBill[]; year: number; month: number }) {
  const [open, setOpen] = useState<string | null>(bills[0]?.id ?? null)

  function exportCsv(b: ContractorBill) {
    const header = ['Date', 'Client', 'Slip', 'Voucher', 'Organization', 'From', 'To', 'Amount', 'Express']
    const lines = b.rows.map((r) => [
      r.trip_date, r.client_name, r.slip_no ?? '', r.voucher_no ?? '', r.organization,
      r.pickup ?? '', r.dropoff ?? '', String(r.amount), String(r.express),
    ])
    lines.push([])
    lines.push(['', '', '', '', '', '', 'TOTAL', String(b.revenue), String(b.express)])
    const csv = [header, ...lines].map((row) => row.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${b.name}_${MONTH_NAMES[month]}_${year}.csv`.replace(/\s+/g, '_')
    a.click()
    URL.revokeObjectURL(url)
  }

  if (bills.length === 0) {
    return <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--ink3)' }}>No billable trips this month.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {bills.map((b) => (
        <div key={b.id} className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', cursor: 'pointer' }} onClick={() => setOpen(open === b.id ? null : b.id)}>
            <div>
              <div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>{b.name}</div>
              <div style={{ fontSize: 13, color: 'var(--ink2)', marginTop: 2 }}>{b.rows.length} trips · express {kes(b.express)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="font-display" style={{ fontSize: 20, fontWeight: 700 }}>{kes(b.revenue + b.express)}</div>
              <button className="btn-ghost" style={{ padding: '7px 14px', fontSize: 13, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); exportCsv(b) }}>
                Export CSV
              </button>
            </div>
          </div>

          {open === b.id && (
            <div style={{ borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                    <Th>Date</Th><Th>Client</Th><Th>Voucher</Th><Th>Organization</Th><Th>Route</Th><Th right>Express</Th><Th right>Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <Td>{fmtDate(r.trip_date)}</Td>
                      <Td>{r.client_name}{r.slip_no && <span style={{ color: 'var(--ink3)' }}> #{r.slip_no}</span>}</Td>
                      <Td>{r.voucher_no ?? '—'}</Td>
                      <Td>{r.organization}</Td>
                      <Td>{(r.pickup || '—')} → {(r.dropoff || '—')}</Td>
                      <Td right>{r.express ? kes(r.express) : '—'}</Td>
                      <Td right><strong>{kes(r.amount)}</strong></Td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--border-med)', background: 'var(--surface2)' }}>
                    <Td><strong>Total</strong></Td><Td /><Td /><Td /><Td />
                    <Td right><strong>{kes(b.express)}</strong></Td>
                    <Td right><strong>{kes(b.revenue)}</strong></Td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function csvCell(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}
function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 600, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: right ? 'right' : 'left' }}>{children}</th>
}
function Td({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <td style={{ padding: '10px 14px', textAlign: right ? 'right' : 'left' }}>{children}</td>
}
