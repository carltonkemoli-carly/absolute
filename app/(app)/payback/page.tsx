import { redirect } from 'next/navigation'
import { PageHeader, StatCard } from '@/components/ui'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listFuel, listExpenses, listServices, listVehicles } from '@/lib/db'
import { kes, fmtDate, isoDate } from '@/lib/format'
import { OWNERSHIP_LABELS } from '@/lib/types'

export const dynamic = 'force-dynamic'

function addMonths(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + Math.round(n))
  return d.toISOString().slice(0, 10)
}
function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + 'T00:00:00Z'), b = new Date(toIso + 'T00:00:00Z')
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
}

export default async function PaybackPage() {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/trips')

  const today = isoDate(new Date())
  const [trips, fuel, expenses, services, vehicles] = await Promise.all([
    listTrips('2000-01-01', today), listFuel('2000-01-01', today), listExpenses('2000-01-01', today), listServices(), listVehicles(),
  ])
  const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0)

  const owned = vehicles.filter((v) => v.ownership === 'owned')
  const cards = owned.map((v) => {
    const vt = trips.filter((t) => t.vehicle_id === v.id)
    const vf = fuel.filter((f) => f.vehicle_id === v.id)
    const ve = expenses.filter((e) => e.vehicle_id === v.id)
    const vs = services.filter((s) => s.vehicle_id === v.id)
    const revenue = sum(vt, (t) => Number(t.amount) || 0)
    const fuelC = sum(vf, (f) => Number(f.amount) || 0)
    const expC = sum(ve, (e) => Number(e.amount) || 0)
    const svcC = sum(vs, (s) => Number(s.cost) || 0)
    const contribution = revenue - fuelC - expC - svcC
    const dataMonths = new Set(vt.map((t) => t.trip_date.slice(0, 7))).size || 1
    const avgMonthly = contribution / dataMonths
    const tripCount = vt.length
    const price = Number(v.purchase_price) || 0
    const monthsOwned = v.purchase_date ? Math.max(1, monthsBetween(v.purchase_date, today) + 1) : dataMonths

    // Projected lifetime contribution assuming steady performance since purchase
    const projectedToDate = avgMonthly * monthsOwned
    const recoveredPct = price > 0 ? Math.min(999, Math.round((projectedToDate / price) * 100)) : 0
    const monthsToPayback = avgMonthly > 0 && price > 0 ? price / avgMonthly : null
    const paybackDate = v.purchase_date && monthsToPayback !== null ? addMonths(v.purchase_date, monthsToPayback) : null
    const paidBack = price > 0 && projectedToDate >= price

    // Loan
    const loan = Number(v.loan_amount) || 0
    const loanMo = Number(v.loan_monthly) || 0
    const hasLoan = loan > 0 && loanMo > 0
    const termMonths = hasLoan ? Math.ceil(loan / loanMo) : 0
    const elapsed = v.purchase_date ? Math.max(0, monthsBetween(v.purchase_date, today)) : 0
    const paidToDate = hasLoan ? Math.min(loan, elapsed * loanMo) : 0
    const loanBalance = hasLoan ? Math.max(0, loan - paidToDate) : 0
    const monthsLeft = hasLoan ? Math.ceil(loanBalance / loanMo) : 0
    const clearDate = hasLoan && v.purchase_date ? addMonths(v.purchase_date, termMonths) : null
    const surplus = avgMonthly - loanMo // does the car cover its own instalment?

    // Break-even: trips/month needed to cover the loan instalment
    const contribPerTrip = tripCount > 0 ? contribution / tripCount : 0
    const tripsPerMonth = tripCount / dataMonths
    const breakevenTrips = hasLoan && contribPerTrip > 0 ? Math.ceil(loanMo / contribPerTrip) : null

    return { v, revenue, fuelC, expC, svcC, contribution, avgMonthly, price, monthsOwned, dataMonths,
      projectedToDate, recoveredPct, paybackDate, paidBack, monthsToPayback,
      hasLoan, loan, loanMo, loanBalance, monthsLeft, clearDate, surplus,
      tripsPerMonth, breakevenTrips }
  })

  const fleetContribution = sum(cards, (c) => c.contribution)
  const fleetInvested = sum(cards, (c) => c.price)
  const fleetLoanBalance = sum(cards.filter((c) => c.hasLoan), (c) => c.loanBalance)

  return (
    <>
      <PageHeader title="Vehicle payback" subtitle="What each car has truly brought back — and when it clears its loan" />

      <div className="grid-stats" style={{ marginBottom: 18 }}>
        <StatCard label="Capital in fleet" value={kes(fleetInvested)} hint={`${cards.length} owned vehicles`} />
        <StatCard label="Contribution earned" value={kes(fleetContribution)} hint="from recorded trips" accent="var(--accent)" />
        <StatCard label="Outstanding loans" value={kes(fleetLoanBalance)} hint="remaining balance" accent={fleetLoanBalance > 0 ? 'var(--gold)' : 'var(--accent)'} />
        <StatCard label="Data window" value={`${Math.max(1, ...cards.map((c) => c.dataMonths))} mo`} hint="months of trips recorded" />
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--ink3)', margin: '0 0 16px' }}>
        Projections assume each car keeps earning at its recorded monthly average. The more months you log, the sharper these get.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {cards.length === 0 && (
          <div className="card" style={{ padding: 28, color: 'var(--ink3)' }}>
            No owned vehicles have purchase details yet. Add a purchase price (and loan, if financed) on the Fleet page to see payback here.
          </div>
        )}
        {cards.map((c) => (
          <div key={c.v.id} className="card card-hover" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ height: 3, background: c.paidBack ? 'var(--accent)' : c.hasLoan && c.surplus < 0 ? 'var(--danger)' : 'var(--gold)' }} />
            <div style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <div>
                  <div className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>{c.v.plate}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink3)' }}>{c.v.model ?? ''} · {OWNERSHIP_LABELS[c.v.ownership]}</div>
                </div>
                {c.price > 0 && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: c.paidBack ? 'var(--accent)' : 'var(--gold)', background: 'var(--surface2)', padding: '3px 9px', borderRadius: 'var(--radius-pill)' }}>
                    {c.paidBack ? 'Paid back ✓' : `${c.recoveredPct}% recovered`}
                  </span>
                )}
              </div>

              {c.price <= 0 ? (
                <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 14 }}>Add a purchase price on the Fleet page to unlock payback analysis.</p>
              ) : (
                <>
                  {/* recovery bar */}
                  <div style={{ margin: '14px 0 4px' }}>
                    <div style={{ height: 8, borderRadius: 6, background: 'var(--surface2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, c.recoveredPct)}%`, background: c.paidBack ? 'var(--accent)' : 'var(--gold)', borderRadius: 6 }} />
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginTop: 5 }}>
                      {kes(Math.round(c.projectedToDate))} earned of {kes(c.price)}{c.v.purchase_date ? ` · owned ${c.monthsOwned} mo (since ${fmtDate(c.v.purchase_date)})` : ''}
                    </div>
                  </div>

                  <Row label="Revenue (recorded)" value={kes(c.revenue)} />
                  <Row label="Contribution" value={kes(c.contribution)} strong />
                  <Row label="Avg / month" value={kes(Math.round(c.avgMonthly))} />
                  <Row label={c.paidBack ? 'Paid for itself' : 'Projected payback'}
                    value={c.paidBack ? 'Yes ✓' : c.paybackDate ? `${fmtDate(c.paybackDate)}` : '—'}
                    accent={c.paidBack ? 'var(--accent)' : undefined} />

                  {c.hasLoan && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 6 }}>Loan</div>
                      {c.loanBalance > 0 ? (
                        <>
                          <Row label="Balance remaining" value={kes(c.loanBalance)} />
                          <Row label="Clears on" value={c.clearDate ? `${fmtDate(c.clearDate)} (${c.monthsLeft} mo)` : '—'} />
                          <Row label="Instalment / month" value={kes(c.loanMo)} />
                          <div style={{ marginTop: 8, padding: '9px 11px', borderRadius: 'var(--radius-sm)', fontSize: 12.5,
                            background: c.surplus >= 0 ? 'var(--accent-light)' : 'var(--danger-light)', color: c.surplus >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
                            {c.surplus >= 0
                              ? `Self-financing: earns ${kes(Math.round(c.surplus))}/mo after its loan instalment.`
                              : `Shortfall: earns ${kes(Math.round(c.avgMonthly))}/mo but the instalment is ${kes(c.loanMo)} — you top up ${kes(Math.round(-c.surplus))}/mo.`}
                          </div>
                          {c.breakevenTrips !== null && (
                            <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginTop: 8 }}>
                              <strong>Break-even:</strong> needs ~{c.breakevenTrips} trips/mo to cover the instalment · currently doing ~{Math.round(c.tripsPerMonth)}/mo
                              {c.tripsPerMonth < c.breakevenTrips ? <span style={{ color: 'var(--danger)' }}> ({c.breakevenTrips - Math.round(c.tripsPerMonth)} short)</span> : <span style={{ color: 'var(--accent)' }}> ✓ on track</span>}
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ padding: '9px 11px', borderRadius: 'var(--radius-sm)', fontSize: 12.5, background: 'var(--accent-light)', color: 'var(--accent)' }}>
                          Loan cleared ✓{c.clearDate ? ` (${fmtDate(c.clearDate)})` : ''} — full contribution is now yours.
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '3px 0' }}>
      <span style={{ color: 'var(--ink2)' }}>{label}</span>
      <span style={{ fontWeight: strong ? 700 : 500, color: accent }}>{value}</span>
    </div>
  )
}
