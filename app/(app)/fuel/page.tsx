import { PageHeader, StatCard } from '@/components/ui'
import MonthNav from '@/components/MonthNav'
import { listFuel, listVehicles, listDrivers, listTrips, listExpenses } from '@/lib/db'
import { monthRange, isoDate, kes } from '@/lib/format'
import { stickyPeriod } from '@/lib/period'
import ExcelImport from '@/components/ExcelImport'
import type { FieldSpec } from '@/lib/import-types'
import FuelManager from './FuelManager'
import FuelInsights, { type VehFuel } from './FuelInsights'
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

  const [entries, vlist, drivers, trips, allExpenses] = await Promise.all([
    listFuel(start, end), listVehicles(), listDrivers(), listTrips(start, end), listExpenses(),
  ])
  const totalFuel = entries.reduce((s, f) => s + Number(f.amount), 0)
  const washExp = allExpenses.filter((e) => e.category === 'Car Wash')

  const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0)

  const rows: VehFuel[] = vlist.map((v) => {
    const vt = trips.filter((t) => t.vehicle_id === v.id)
    const vf = entries.filter((f) => f.vehicle_id === v.id)
    const fuelCost = sum(vf, (f) => f.amount)
    const litres = sum(vf, (f) => Number(f.litres) || 0)
    const rev = sum(vt, (t) => t.amount)
    const vWash = washExp.filter((e) => e.vehicle_id === v.id)
    const driverNames = [...new Set(vt.map((t) => t.driver_id).filter(Boolean))]
      .map((id) => drivers.find((d) => d.id === id)?.name).filter(Boolean) as string[]
    return {
      id: v.id, plate: v.plate, model: v.model,
      fuelCost, litres,
      trips: vt.length, rev, fuelPct: rev > 0 ? fuelCost / rev : null,
      driverNames,
      washesMonth: vWash.filter((e) => e.expense_date >= start && e.expense_date <= end).length,
      lastWash: vWash.map((e) => e.expense_date).sort().slice(-1)[0] ?? null,
    }
  }).filter((r) => r.fuelCost > 0 || r.trips > 0).sort((a, b) => b.fuelCost - a.fuelCost)

  const fleetRev = sum(rows, (r) => r.rev)
  const fleetFuel = sum(rows, (r) => r.fuelCost)
  const fleetFuelPct = fleetRev > 0 ? fleetFuel / fleetRev : 0
  const washedThisMonth = rows.filter((r) => r.washesMonth > 0).length

  return (
    <>
      <PageHeader title="Fuel" subtitle="Fuel per vehicle — and what's driving the cost" action={<MonthNav year={year} month={month} />} />
      <div className="grid-stats" style={{ marginBottom: 18 }}>
        <StatCard label="Total fuel this month" value={kes(totalFuel)} hint={`${entries.length} fill-ups`} />
        <StatCard label="Highest fuel vehicle" value={rows[0]?.plate ?? '—'} hint={rows[0] ? kes(rows[0].fuelCost) : undefined} accent="var(--gold)" />
        <StatCard label="Cars washed" value={`${washedThisMonth} / ${rows.length}`} hint={washedThisMonth < rows.length ? `${rows.length - washedThisMonth} not washed` : 'all clean'} accent={washedThisMonth < rows.length ? 'var(--danger)' : 'var(--accent)'} />
      </div>

      <FuelInsights rows={rows} fleetFuelPct={fleetFuelPct} />

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
          hint="Export your M-Pesa statement to Excel/CSV and upload it. We pick out the petrol-station payments automatically and record them as fuel. Re-importing the same statement won't double-count."
        />
      </div>

      <FuelManager entries={entries} vehicles={vlist} drivers={drivers} defaultDate={defaultDate} />
    </>
  )
}
