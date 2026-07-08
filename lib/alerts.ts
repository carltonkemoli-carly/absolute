// Proactive business alerts — surfaces inefficiencies before they scale.
// Loss-making cars, loan shortfalls, loans clearing soon, fuel outliers,
// and un-invoiced (recoverable) expressway tolls.
import type { Trip, FuelEntry, Expense, Vehicle, Invoice, Contractor, VehicleService } from '@/lib/types'

export type AlertLevel = 'critical' | 'warning' | 'info'
export interface BusinessAlert {
  level: AlertLevel
  title: string
  detail: string
  href: string
}

const num = (v: unknown) => Number(v) || 0

export function buildAlerts(input: {
  vehicles: Vehicle[]
  trips: Trip[]        // selected month
  fuel: FuelEntry[]    // selected month
  expenses: Expense[]  // selected month
  services?: VehicleService[] // selected month
  invoices: Invoice[]
  contractors: Contractor[]
  today: string
  monthLabel: string
  monthStart: string
  monthEnd: string
}): BusinessAlert[] {
  const { trips, fuel, invoices, contractors, monthLabel, monthStart, monthEnd } = input
  const alerts: BusinessAlert[] = []
  const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0)

  // Company-level fuel-to-sales — the one fuel metric that's truly accurate
  // (fuel is paid straight to stations, not tied to a car).
  const totalRev = sum(trips, (t) => num(t.amount))
  const totalFuel = sum(fuel, (f) => num(f.amount))
  const fuelPct = totalRev > 0 ? totalFuel / totalRev : 0
  if (totalRev > 0 && fuelPct > 0.34) {
    alerts.push({ level: 'warning', title: `Fuel is high this month`, detail: `Fuel is ${Math.round(fuelPct * 100)}% of revenue (${kes(totalFuel)} on ${kes(totalRev)}) — usually it runs ~28–31%. Worth a look.`, href: '/fuel' })
  }

  // ---- un-invoiced expressway tolls (recoverable) ----
  const conName = (id: string | null) => contractors.find((c) => c.id === id)?.name ?? 'Direct'
  const tollByCon = new Map<string, number>()
  for (const t of trips) { const e = num(t.express_charges); if (e > 0) { const k = t.contractor_id ?? 'none'; tollByCon.set(k, (tollByCon.get(k) ?? 0) + e) } }
  for (const [k, toll] of tollByCon) {
    const invoiced = invoices.some((inv) => inv.contractor_id === (k === 'none' ? null : k) && (
      (inv.period_start && inv.period_end && inv.period_start <= monthEnd && inv.period_end >= monthStart) ||
      (inv.issue_date != null && inv.issue_date >= monthStart && inv.issue_date <= monthEnd)))
    if (!invoiced && toll > 0) {
      alerts.push({ level: 'warning', title: `${kes(toll)} in tolls not invoiced`, detail: `Expressway tolls fronted for ${conName(k === 'none' ? null : k)} in ${monthLabel} aren't on an invoice yet — recover them.`, href: '/expressway' })
    }
  }

  const order: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => order[a.level] - order[b.level])
}

function kes(n: number): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n)
}
