import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader, StatCard, Card, Section, EmptyState } from '@/components/ui'
import MonthNav from '@/components/MonthNav'
import PrintButton from '@/components/PrintButton'
import SegmentDonut from '@/components/SegmentDonut'
import { Bars } from '@/components/Bars'
import { topSegments } from '@/lib/chart'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listContractors, listOrganizations, listInvoices, listTargets } from '@/lib/db'
import { monthRange, MONTH_NAMES, kes, kesPlain, isoDate, fmtDate } from '@/lib/format'
import { stickyPeriod } from '@/lib/period'
import type { Contractor, Invoice, Trip } from '@/lib/types'
import SupplierTargets from './SupplierTargets'

export const dynamic = 'force-dynamic'

const MONTHS_BACK = 6

// One supplier's picture for the selected month, plus the standing receivables
// position (a balance, not a monthly flow — so it is deliberately not scoped).
interface SupplierRow {
  contractor: Contractor
  trips: number
  revenue: number
  express: number
  netFare: number
  avgFare: number
  outstanding: number
  overdue: number
  daysToPay: number | null
  invoices: number
  revenueTarget: number
  tripsTarget: number
}

export default async function SuppliersPage({
  searchParams,
}: { searchParams: Promise<{ c?: string; y?: string; m?: string }> }) {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/trips')

  const sp = await searchParams
  const { year, month } = await stickyPeriod(sp)
  const { start, end } = monthRange(year, month)
  const windowStart = monthRange(year, month - 5).start
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`
  const periodLabel = `${MONTH_NAMES[month]} ${year}`
  const today = isoDate(new Date())
  // A target is only fair to judge against the part of the month that has happened.
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const pace = today.slice(0, 7) === ym ? Number(today.slice(8, 10)) / daysInMonth : 1

  const [winTrips, contractors, organizations, invoices, targets] = await Promise.all([
    listTrips(windowStart, end), listContractors(), listOrganizations(), listInvoices(), listTargets(ym),
  ])

  const monthTrips = winTrips.filter((t) => t.trip_date >= start && t.trip_date <= end)
  const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0)
  const due = (i: Invoice) => Math.max(0, Number(i.amount) - Number(i.amount_paid))
  const targetFor = (cid: string, kind: 'revenue' | 'trips') =>
    Number(targets.find((t) => t.contractor_id === cid && t.kind === kind)?.amount ?? 0)

  const rows: SupplierRow[] = contractors.map((c) => {
    const ct = monthTrips.filter((t) => t.contractor_id === c.id)
    const ci = invoices.filter((i) => i.contractor_id === c.id)
    const revenue = sum(ct, (t) => t.amount)
    const express = sum(ct, (t) => t.express_charges)

    // How long they actually take to settle — the number that tells you whether
    // an account is worth having, and which nothing in the system showed before.
    const settled = ci.filter((i) => i.paid_date && i.issue_date && due(i) <= 0)
    const daysToPay = settled.length
      ? Math.round(sum(settled, (i) => (Date.parse(i.paid_date as string) - Date.parse(i.issue_date as string)) / 86400000) / settled.length)
      : null

    return {
      contractor: c,
      trips: ct.length,
      revenue,
      express,
      netFare: revenue - express,
      avgFare: ct.length ? revenue / ct.length : 0,
      outstanding: sum(ci, due),
      overdue: sum(ci, (i) => (due(i) > 0 && i.due_date && i.due_date < today ? due(i) : 0)),
      daysToPay,
      invoices: ci.length,
      revenueTarget: targetFor(c.id, 'revenue'),
      tripsTarget: targetFor(c.id, 'trips'),
    }
  })

  const selectedId = sp.c && sp.c !== 'all' ? sp.c : null
  const selected = selectedId ? rows.find((r) => r.contractor.id === selectedId) ?? null : null
  const href = (c: string) => `/suppliers?c=${c}&y=${year}&m=${month}`

  return (
    <>
      <PageHeader
        title="Suppliers"
        subtitle={selected ? `${selected.contractor.name} — the work they send and what it's worth` : 'Who sends you work, how much, and whether they pay'}
        action={<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><MonthNav year={year} month={month} /><PrintButton /></div>}
      />

      {/* Supplier switch — plain links so the whole page stays server-rendered
          and a view can be bookmarked or shared. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
        <Chip href={href('all')} active={!selected}>All suppliers</Chip>
        {rows.map((r) => (
          <Chip key={r.contractor.id} href={href(r.contractor.id)} active={selected?.contractor.id === r.contractor.id}>
            {r.contractor.name}
          </Chip>
        ))}
      </div>

      {contractors.length === 0 ? (
        <div className="card"><EmptyState message="No suppliers yet. Add the companies that send you work under Settings → Contractors." /></div>
      ) : selected ? (
        <SupplierDetail
          row={selected} ym={ym} periodLabel={periodLabel}
          winTrips={winTrips} year={year} month={month} pace={pace}
          organizations={organizations}
          invoices={invoices.filter((i) => i.contractor_id === selected.contractor.id)}
        />
      ) : (
        <AllSuppliers rows={rows} periodLabel={periodLabel} pace={pace} />
      )}
    </>
  )
}

// ---------- All suppliers ----------

function AllSuppliers({ rows, periodLabel, pace }: { rows: SupplierRow[]; periodLabel: string; pace: number }) {
  const total = (f: (r: SupplierRow) => number) => rows.reduce((s, r) => s + f(r), 0)
  const revenue = total((r) => r.revenue)
  const trips = total((r) => r.trips)
  const outstanding = total((r) => r.outstanding)
  const overdue = total((r) => r.overdue)
  const revenueTarget = total((r) => r.revenueTarget)

  const paying = rows.filter((r) => r.daysToPay !== null)
  const avgDays = paying.length ? Math.round(paying.reduce((s, r) => s + (r.daysToPay as number), 0) / paying.length) : null

  const share = topSegments(rows.map((r) => ({ label: r.contractor.name, value: r.revenue })), 8)
  const ranked = [...rows].sort((a, b) => b.revenue - a.revenue)

  return (
    <>
      <Section title={`All suppliers · ${periodLabel}`}>
        <div className="grid-stats" style={{ marginBottom: revenue > 0 ? 16 : 2 }}>
          <StatCard label="Revenue" value={kes(revenue)}
            hint={revenueTarget > 0 ? `${Math.round((revenue / revenueTarget) * 100)}% of ${kes(revenueTarget)} target` : `${rows.length} supplier${rows.length === 1 ? '' : 's'}`}
            accent="var(--accent)" />
          <StatCard label="Trips" value={String(trips)} hint="this month" />
          <StatCard label="Outstanding" value={kes(outstanding)} hint="owed to you · any month" accent={outstanding > 0 ? 'var(--gold)' : 'var(--accent)'} />
          <StatCard label="Overdue" value={kes(overdue)} hint="past due date · any month" accent={overdue > 0 ? 'var(--danger)' : 'var(--accent)'} />
          <StatCard label="Average days to pay" value={avgDays === null ? '—' : `${avgDays}`}
            hint={avgDays === null ? 'no settled invoices yet' : 'from issue to settled'}
            accent={avgDays !== null && avgDays > 45 ? 'var(--danger)' : avgDays !== null && avgDays > 30 ? 'var(--gold)' : 'var(--accent)'} />
        </div>

        {revenue > 0 && (
          <div className="grid-2">
            <Card title="Share of revenue">
              <SegmentDonut data={share} centerValue={kesPlain(revenue)} centerLabel="Ksh billed" centerSize={18} money />
            </Card>
            <Card title="Trips by supplier">
              <Bars
                items={ranked.map((r) => ({ label: r.contractor.name, value: r.trips, sub: kes(r.revenue) }))}
                max={Math.max(1, ...ranked.map((r) => r.trips))}
                format={(v) => `${v} trip${v === 1 ? '' : 's'}`} accent="var(--accent)"
                emptyText="No trips logged this month." />
            </Card>
          </div>
        )}
      </Section>

      <Section title="Side by side">
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 820 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <Th>Supplier</Th><Th right>Trips</Th><Th right>Revenue</Th><Th right>Target</Th>
                <Th right>Avg fare</Th><Th right>Outstanding</Th><Th right>Overdue</Th><Th right>Days to pay</Th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => {
                const pct = r.revenueTarget > 0 ? r.revenue / r.revenueTarget : null
                return (
                  <tr key={r.contractor.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <Td><Link href={`/suppliers?c=${r.contractor.id}`} style={{ fontWeight: 700, color: 'var(--accent-mid)' }}>{r.contractor.name}</Link></Td>
                    <Td right>{r.trips}</Td>
                    <Td right><strong>{kes(r.revenue)}</strong></Td>
                    <Td right>{pct === null ? <span style={{ color: 'var(--ink3)' }}>—</span>
                      : <span style={{ fontWeight: 700, color: pct >= 1 || pct >= pace ? 'var(--accent)' : pct >= pace * 0.7 ? 'var(--gold)' : 'var(--danger)' }}>{Math.round(pct * 100)}%</span>}</Td>
                    <Td right>{kes(r.avgFare)}</Td>
                    <Td right>{kes(r.outstanding)}</Td>
                    <Td right>{r.overdue > 0 ? <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{kes(r.overdue)}</span> : '—'}</Td>
                    <Td right>{r.daysToPay === null ? <span style={{ color: 'var(--ink3)' }}>—</span>
                      : <span style={{ color: r.daysToPay > 45 ? 'var(--danger)' : r.daysToPay > 30 ? 'var(--gold)' : 'var(--ink)' }}>{r.daysToPay}d</span>}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 10 }}>
          Trips, revenue and target are for {periodLabel}. Outstanding, overdue and days to pay are running positions across every month.
          {pace < 1 && <> Targets are judged against the <strong>{Math.round(pace * 100)}%</strong> of the month that has passed, not the whole of it.</>}
        </p>
      </Section>
    </>
  )
}

// ---------- One supplier ----------

function SupplierDetail({
  row, ym, periodLabel, winTrips, year, month, pace, organizations, invoices,
}: {
  row: SupplierRow; ym: string; periodLabel: string
  winTrips: Trip[]; year: number; month: number; pace: number
  organizations: { id: string; name: string }[]; invoices: Invoice[]
}) {
  const cid = row.contractor.id
  const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0)

  // Six-month revenue trend for this supplier.
  const trend: { label: string; value: number; sub: string }[] = []
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const r = monthRange(year, month - i)
    const mt = winTrips.filter((t) => t.contractor_id === cid && t.trip_date >= r.start && t.trip_date <= r.end)
    const d = new Date(r.start + 'T12:00:00Z')
    trend.push({
      label: `${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)} ${String(d.getUTCFullYear()).slice(2)}`,
      value: sum(mt, (t) => t.amount),
      sub: `${mt.length} trip${mt.length === 1 ? '' : 's'}`,
    })
  }

  const { start, end } = monthRange(year, month)
  const monthTrips = winTrips.filter((t) => t.contractor_id === cid && t.trip_date >= start && t.trip_date <= end)
  const orgName = (id: string | null) => organizations.find((o) => o.id === id)?.name ?? 'Direct / none'

  const byOrg = groupRevenue(monthTrips, (t) => orgName(t.organization_id))
  const byRoute = groupRevenue(monthTrips, (t) => `${(t.pickup || '?').trim()} → ${(t.dropoff || '?').trim()}`)
  const openInvoices = invoices
    .filter((i) => Math.max(0, Number(i.amount) - Number(i.amount_paid)) > 0)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))

  return (
    <>
      <Section title={`${row.contractor.name} · ${periodLabel}`}>
        <div className="grid-stats" style={{ marginBottom: 16 }}>
          <StatCard label="Revenue" value={kes(row.revenue)} hint={`net ${kes(row.netFare)} (excl. expressway)`} accent="var(--accent)" />
          <StatCard label="Trips" value={String(row.trips)} hint={row.trips > 0 ? `avg fare ${kes(row.avgFare)}` : 'none this month'} />
          <StatCard label="Outstanding" value={kes(row.outstanding)} hint={`${row.invoices} invoice${row.invoices === 1 ? '' : 's'} · any month`} accent={row.outstanding > 0 ? 'var(--gold)' : 'var(--accent)'} />
          <StatCard label="Overdue" value={kes(row.overdue)} hint={row.overdue > 0 ? 'chase this' : 'nothing late'} accent={row.overdue > 0 ? 'var(--danger)' : 'var(--accent)'} />
          <StatCard label="Days to pay" value={row.daysToPay === null ? '—' : `${row.daysToPay}`}
            hint={row.daysToPay === null ? 'no settled invoices yet' : 'average, issue to settled'}
            accent={row.daysToPay !== null && row.daysToPay > 45 ? 'var(--danger)' : row.daysToPay !== null && row.daysToPay > 30 ? 'var(--gold)' : 'var(--accent)'} />
        </div>

        <div className="grid-2">
          <SupplierTargets
            contractorId={cid} contractorName={row.contractor.name} period={ym} periodLabel={periodLabel} pace={pace}
            revenueTarget={row.revenueTarget} revenueActual={row.revenue}
            tripsTarget={row.tripsTarget} tripsActual={row.trips}
          />
          <Card title="Revenue — last 6 months">
            <Bars items={trend} max={Math.max(1, ...trend.map((t) => t.value))} format={kes} accent="var(--accent)"
              emptyText="No work from this supplier in the last six months." />
          </Card>
        </div>
      </Section>

      {monthTrips.length > 0 && (
        <Section title={`What they sent in ${periodLabel}`}>
          <div className="grid-2">
            <Card title="By end client">
              <Bars items={byOrg.slice(0, 8)} max={Math.max(1, ...byOrg.map((o) => o.value))} format={kes} accent="var(--accent)" />
            </Card>
            <Card title="Top routes">
              <Bars items={byRoute.slice(0, 8)} max={Math.max(1, ...byRoute.map((o) => o.value))} format={kes} accent="var(--accent)" />
            </Card>
          </div>
        </Section>
      )}

      <Section title="Open invoices" action={<Link href="/receivables" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent-mid)' }}>All receivables →</Link>}>
        <div className="card" style={{ overflowX: 'auto' }}>
          {openInvoices.length === 0 ? (
            <EmptyState message={`Nothing outstanding from ${row.contractor.name}.`} />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <Th>Invoice</Th><Th>Period</Th><Th>Due</Th><Th right>Amount</Th><Th right>Paid</Th><Th right>Outstanding</Th>
                </tr>
              </thead>
              <tbody>
                {openInvoices.map((i) => {
                  const out = Math.max(0, Number(i.amount) - Number(i.amount_paid))
                  const late = i.due_date && i.due_date < isoDate(new Date())
                  return (
                    <tr key={i.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <Td><Link href={`/receivables/${i.id}`} style={{ fontWeight: 600, color: 'var(--accent-mid)' }}>{i.invoice_no ?? 'View'}</Link></Td>
                      <Td>{i.period_label ?? '—'}</Td>
                      <Td><span style={{ color: late ? 'var(--danger)' : 'var(--ink2)' }}>{i.due_date ? fmtDate(i.due_date) : '—'}</span></Td>
                      <Td right>{kes(i.amount)}</Td>
                      <Td right>{kes(i.amount_paid)}</Td>
                      <Td right><strong>{kes(out)}</strong></Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Section>
    </>
  )
}

function groupRevenue(trips: Trip[], keyOf: (t: Trip) => string): { label: string; value: number; sub: string }[] {
  const m = new Map<string, { value: number; count: number }>()
  for (const t of trips) {
    const k = keyOf(t)
    const g = m.get(k) ?? { value: 0, count: 0 }
    g.value += Number(t.amount) || 0
    g.count++
    m.set(k, g)
  }
  return [...m.entries()]
    .map(([label, g]) => ({ label, value: g.value, sub: `${g.count} trip${g.count === 1 ? '' : 's'}` }))
    .sort((a, b) => b.value - a.value)
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} style={{
      padding: '7px 15px', borderRadius: 'var(--radius-pill)', fontSize: 13.5, fontWeight: 600,
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      background: active ? 'var(--accent)' : 'var(--surface)',
      color: active ? 'var(--on-accent)' : 'var(--ink2)',
      textDecoration: 'none', whiteSpace: 'nowrap',
    }}>{children}</Link>
  )
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th style={{ padding: '10px 12px', fontSize: 11.5, fontWeight: 600, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: right ? 'right' : 'left' }}>{children}</th>
}
function Td({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <td style={{ padding: '10px 12px', textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap' }}>{children}</td>
}
