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
function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + 'T00:00:00Z'), b = new Date(toIso + 'T00:00:00Z')
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
}

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
  const { vehicles, trips, fuel, expenses, services = [], invoices, contractors, today, monthLabel, monthStart, monthEnd } = input
  const alerts: BusinessAlert[] = []
  const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0)

  const totalRev = sum(trips, (t) => num(t.amount))
  const totalFuel = sum(fuel, (f) => num(f.amount))
  const fleetFuelPct = totalRev > 0 ? totalFuel / totalRev : 0

  // ---- per-vehicle checks ----
  for (const v of vehicles) {
    const vt = trips.filter((t) => t.vehicle_id === v.id)
    if (vt.length === 0) continue
    const rev = sum(vt, (t) => num(t.amount))
    const fu = sum(fuel.filter((f) => f.vehicle_id === v.id), (f) => num(f.amount))
    const vex = sum(expenses.filter((e) => e.vehicle_id === v.id), (e) => num(e.amount))
    const vsc = sum(services.filter((s) => s.vehicle_id === v.id), (s) => num(s.cost))
    const contribution = rev - fu - vex - vsc
    const loan = num(v.loan_amount), loanMo = num(v.loan_monthly)

    if (contribution < 0) {
      alerts.push({ level: 'critical', title: `${v.plate} ran at a loss in ${monthLabel}`, detail: `Contribution ${kes(contribution)} (revenue ${kes(rev)} − fuel & costs). Review pricing, utilisation or costs.`, href: '/insights' })
    } else if (loan > 0 && loanMo > 0 && contribution < loanMo) {
      alerts.push({ level: 'warning', title: `${v.plate} isn't covering its loan`, detail: `Earns ${kes(contribution)}/mo but the instalment is ${kes(loanMo)} — you subsidise ${kes(loanMo - contribution)}/mo.`, href: '/payback' })
    }

    // fuel efficiency outlier
    if (rev > 0 && fleetFuelPct > 0) {
      const pct = fu / rev
      if (pct > fleetFuelPct * 1.25) {
        alerts.push({ level: 'warning', title: `${v.plate} fuel looks high`, detail: `Fuel is ${Math.round(pct * 100)}% of its revenue vs ${Math.round(fleetFuelPct * 100)}% fleet average — check for waste or theft.`, href: '/insights' })
      }
    }

    // loan clearing soon
    if (loan > 0 && loanMo > 0 && v.purchase_date) {
      const term = Math.ceil(loan / loanMo)
      const elapsed = Math.max(0, monthsBetween(v.purchase_date, today))
      const left = Math.max(0, term - elapsed)
      if (left >= 1 && left <= 2) {
        alerts.push({ level: 'info', title: `${v.plate} loan almost cleared`, detail: `About ${left} month${left === 1 ? '' : 's'} of instalments left — that ${kes(loanMo)}/mo will soon be pure profit.`, href: '/payback' })
      }
    }
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
