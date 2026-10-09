import { notFound, redirect } from 'next/navigation'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { getInvoice, listContractors, listContractorTrips, listInvoiceTrips, getCompany } from '@/lib/db'
import { kes, fmtDate } from '@/lib/format'
import PrintBar from './PrintButton'

export const dynamic = 'force-dynamic'

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/trips')

  const { id } = await params
  const invoice = await getInvoice(id)
  if (!invoice) notFound()

  const [contractors, COMPANY] = await Promise.all([listContractors(), getCompany()])
  const contractor = contractors.find((c) => c.id === invoice.contractor_id) ?? null

  // Line items: exactly the trips this invoice bills. Older invoices (raised before
  // trips carried an invoice link) fall back to the billed date range — otherwise a
  // trip added to the month after invoicing would be printed but not charged.
  const linked = await listInvoiceTrips(invoice.id)
  const trips = linked.length > 0
    ? linked
    : invoice.contractor_id && invoice.period_start && invoice.period_end
      ? await listContractorTrips(invoice.contractor_id, invoice.period_start, invoice.period_end)
      : []

  const outstanding = Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid))
  const paid = Number(invoice.amount_paid)

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <PrintBar />

      <div className="invoice-sheet card" style={{ padding: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap', borderBottom: '2px solid var(--ink)', paddingBottom: 20 }}>
          <div>
            <div className="font-display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{COMPANY.name}</div>
            <div style={{ fontSize: 13, color: 'var(--ink2)', marginTop: 3 }}>{COMPANY.tagline}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 8, lineHeight: 1.6 }}>
              {COMPANY.location}<br />{COMPANY.email} · {COMPANY.phone}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="font-display" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--accent-mid)' }}>INVOICE</div>
            {invoice.invoice_no && <div style={{ fontSize: 13.5, color: 'var(--ink2)', marginTop: 4 }}>No. {invoice.invoice_no}</div>}
          </div>
        </div>

        {/* Bill-to + meta */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginTop: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Bill to</div>
            <div className="font-display" style={{ fontSize: 17, fontWeight: 700, marginTop: 5 }}>{contractor?.name ?? '—'}</div>
            {invoice.period_label && <div style={{ fontSize: 13.5, color: 'var(--ink2)', marginTop: 3 }}>Period: {invoice.period_label}</div>}
          </div>
          <div style={{ textAlign: 'right', fontSize: 13.5, lineHeight: 1.9 }}>
            {invoice.issue_date && <div><span style={{ color: 'var(--ink3)' }}>Issued:</span> {fmtDate(invoice.issue_date)}</div>}
            {invoice.due_date && <div><span style={{ color: 'var(--ink3)' }}>Due:</span> <strong>{fmtDate(invoice.due_date)}</strong></div>}
          </div>
        </div>

        {/* Line items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 24 }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid var(--border-med)', textAlign: 'left' }}>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Client</th>
              <th style={thStyle}>Route</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {trips.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '16px 10px', color: 'var(--ink3)' }}>
                {invoice.notes || 'Services rendered for the period above.'}
              </td></tr>
            )}
            {trips.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={tdStyle}>{fmtDate(t.trip_date)}</td>
                <td style={tdStyle}>{t.client_name}</td>
                <td style={{ ...tdStyle, color: 'var(--ink2)' }}>{(t.pickup || '—')} → {(t.dropoff || '—')}</td>
                <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>{kes(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
          <div style={{ width: 280, fontSize: 14 }}>
            <Row label="Subtotal" value={kes(invoice.amount)} />
            {paid > 0 && <Row label="Paid" value={`− ${kes(paid)}`} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', marginTop: 8, borderTop: '2px solid var(--ink)' }}>
              <span className="font-display" style={{ fontSize: 16, fontWeight: 700 }}>{paid > 0 ? 'Balance due' : 'Total due'}</span>
              <span className="font-display" style={{ fontSize: 20, fontWeight: 700 }}>{kes(paid > 0 ? outstanding : invoice.amount)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 36, paddingTop: 18, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--ink3)', textAlign: 'center' }}>
          Thank you for your business. · {COMPANY.name} · {COMPANY.location}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--ink2)' }}>
      <span>{label}</span><span>{value}</span>
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '8px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink3)' }
const tdStyle: React.CSSProperties = { padding: '9px 10px', verticalAlign: 'top' }
