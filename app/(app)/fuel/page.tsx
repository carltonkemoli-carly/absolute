import { PageHeader, StatCard } from '@/components/ui'
import MonthNav from '@/components/MonthNav'
import { Bars, SectionTitle } from '@/components/Bars'
import { listFuel, listTrips, listVehicles, listDrivers } from '@/lib/db'
import { monthRange, isoDate, kes, MONTH_NAMES } from '@/lib/format'
import { stickyPeriod } from '@/lib/period'
import ExcelImport from '@/components/ExcelImport'
import type { FieldSpec } from '@/lib/import-types'
import FuelManager from './FuelManager'
import { importMpesaFuel } from './mpesa-actions'

export const dynamic = 'force-dynamic'

const MPESA_SPEC: FieldSpec[] = [
  { key: 'date', label: 'Date', keywords: ['completion', 'date', 'time'], required: true },
  { key: 'details', label: 'Details / recipient', keywords: ['detail', 'description', 'particular', 'transaction party'], required: true },
  { key: 'amount', label: 'Amount out (Withdrawn)', keywords: ['withdraw', 'paid out', 'debit', 'amount'], required: true },
  { key: 'reference', label: 'Receipt no.', keywords: ['receipt', 'reference', 'ref', 'code'] },
]

export default async function FuelPage({
  searchParams,
}: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const sp = await searchParams
  const { year, month } = await stickyPeriod(sp)
  const { start, end } = monthRange(year, month)
  const today = isoDate(new Date())
  const defaultDate = today >= start && today <= end ? today : start
  const winStart = monthRange(year, month - 5).start

  const [entries, winFuel, winTrips, vlist, drivers] = await Promise.all([
    listFuel(start, end), listFuel(winStart, end), listTrips(winStart, end), listVehicles(), listDrivers(),
  ])
  const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0)

  const monthTrips = winTrips.filter((t) => t.trip_date >= start && t.trip_date <= end)
  const totalFuel = sum(entries, (f) => f.amount)
  const revenue = sum(monthTrips, (t) => t.amount)
  const fuelPct = revenue > 0 ? totalFuel / revenue : null

  // 6-month fuel-to-sales trend (all real: fuel from M-Pesa, revenue from trips)
  const trend: { label: string; fuel: number; pct: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const r = monthRange(year, month - i)
    const mf = sum(winFuel.filter((f) => f.fuel_date >= r.start && f.fuel_date <= r.end), (f) => f.amount)
    const mr = sum(winTrips.filter((t) => t.trip_date >= r.start && t.trip_date <= r.end), (t) => t.amount)
    const d = new Date(r.start + 'T12:00:00Z')
    trend.push({ label: `${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)} ${String(d.getUTCFullYear()).slice(2)}`, fuel: mf, pct: mr > 0 ? mf / mr : 0 })
  }

  // Where the fuel goes — by station (real, from M-Pesa)
  const byStation = new Map<string, { label: string; value: number; count: number }>()
  for (const f of entries) {
    const key = (f.station || 'Unknown station').trim()
    const g = byStation.get(key.toLowerCase()) ?? { label: key, value: 0, count: 0 }
    g.value += Number(f.amount) || 0; g.count++; byStation.set(key.toLowerCase(), g)
  }
  const stations = [...byStation.values()].sort((a, b) => b.value - a.value)

  return (
    <>
      <PageHeader title="Fuel" subtitle="What you spend on fuel — and how it tracks against revenue" action={<MonthNav year={year} month={month} />} />

      <div className="grid-stats" style={{ marginBottom: 18 }}>
        <StatCard label="Fuel this month" value={kes(totalFuel)} hint={`${entries.length} payments`} accent="var(--gold)" />
        <StatCard label="Fuel-to-sales" value={fuelPct === null ? '—' : `${Math.round(fuelPct * 100)}%`}
          hint={fuelPct !== null && fuelPct > 0.32 ? 'High — watch fuel spend' : 'Healthy'}
          accent={fuelPct !== null && fuelPct > 0.32 ? 'var(--danger)' : 'var(--accent)'} />
        <StatCard label="Revenue this month" value={kes(revenue)} hint={`${monthTrips.length} trips`} />
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <SectionTitle>Fuel spend & fuel-to-sales — last 6 months</SectionTitle>
        <Bars items={trend.map((t) => ({ label: t.label, value: t.fuel, sub: `${Math.round(t.pct * 100)}% of sales` }))}
          max={Math.max(1, ...trend.map((t) => t.fuel))} format={kes} accent="var(--gold)" emptyText="No fuel recorded yet." />
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <SectionTitle>Where you fuel — by station ({MONTH_NAMES[month]})</SectionTitle>
        <Bars items={stations.slice(0, 12).map((s) => ({ label: s.label, value: s.value, sub: `${s.count} fill${s.count === 1 ? '' : 's'}` }))}
          max={Math.max(1, ...stations.map((s) => s.value))} format={kes} accent="var(--accent-mid)" emptyText="No fuel payments this month." />
        <p style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 10 }}>
          Fuel is paid straight to the station via M-Pesa, so it isn’t tied to a single car yet. Once drivers log the vehicle at fuelling, per-car fuel will appear here.
        </p>
      </div>

      <div style={{ margin: '18px 0' }}>
        <ExcelImport
          label="Import fuel from M-Pesa statement"
          spec={MPESA_SPEC}
          importAction={importMpesaFuel}
          options={[{
            key: 'detect', label: 'Which payments are fuel?', default: 'stations',
            choices: [
              { value: 'stations', label: 'Only payments to petrol stations (auto-detect)' },
              { value: 'all', label: 'Every payment in this file is fuel' },
            ],
          }]}
          hint="Export your M-Pesa statement to Excel/CSV and upload it. We pick out the petrol-station payments automatically. Re-importing the same statement won't double-count."
        />
      </div>

      <FuelManager entries={entries} vehicles={vlist} drivers={drivers} defaultDate={defaultDate} />
    </>
  )
}
