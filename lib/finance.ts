// Canonical profit-and-loss. One source of truth so the dashboard, Insights,
// Reports and Goals can never drift apart. Every finance surface goes through
// monthlyPL() or periodPL() — nothing recomputes revenue or profit by hand.
//
// Honesty rule: we only claim "net profit" once the costs we know are missing
// have actually been logged. Driver wages are the test, because they are the
// largest recurring cost and the one most often left unrecorded — and a profit
// figure that silently omits them flatters the business. Until wages exist for
// the period we report "profit before wages" and name what is still missing.
// Callers pass data already filtered to the period.
import type { Trip, FuelEntry, Expense, VehicleService, Vehicle } from '@/lib/types'

// Expenses posted by the monthly wage run carry this category.
export const WAGES_CATEGORY = 'Driver Wages'

export interface PL {
  revenue: number
  express: number
  netRevenue: number // revenue minus pass-through expressway tolls
  fuel: number
  wages: number
  otherExpenses: number // logged expenses that aren't driver wages
  servicing: number
  hire: number
  costs: number // fuel + wages + otherExpenses + servicing + hire
  net: number // revenue − costs logged so far
  margin: number // net / revenue
  costsComplete: boolean // are wages logged? controls "net" vs "before wages"
  loggedCosts: string[] // which cost kinds actually have figures
}

const sum = <T>(rows: T[], f: (r: T) => number): number =>
  rows.reduce((s, r) => s + Number(f(r) || 0), 0)

export interface PLInput {
  trips: Trip[]
  fuel: FuelEntry[]
  expenses: Expense[]
  services: VehicleService[]
  vehicles: Vehicle[]
}

export function monthlyPL(args: PLInput): PL {
  const revenue = sum(args.trips, (t) => t.amount)
  const express = sum(args.trips, (t) => t.express_charges)
  const fuel = sum(args.fuel, (f) => f.amount)
  const wages = sum(args.expenses.filter((e) => e.category === WAGES_CATEGORY), (e) => e.amount)
  const otherExpenses = sum(args.expenses.filter((e) => e.category !== WAGES_CATEGORY), (e) => e.amount)
  const servicing = sum(args.services, (s) => s.cost)
  // Monthly-hire vehicles cost a flat fee each month; casual hire is per trip.
  const monthlyHire = sum(args.vehicles.filter((v) => v.ownership === 'monthly_hire'), (v) => v.monthly_fee)
  const hire = monthlyHire + sum(args.trips, (t) => t.hire_cost)

  return finalise({ revenue, express, fuel, wages, otherExpenses, servicing, hire })
}

// Sum several months into one P&L — a quarter, a year, any range. Months are
// 'YYYY-MM' keys; each is costed on its own so a monthly hire fee is counted
// once per month rather than once per period.
export function periodPL(args: PLInput, months: string[]): PL {
  const ymOf = (d: string) => d.slice(0, 7)
  const parts = months.map((ym) =>
    monthlyPL({
      trips: args.trips.filter((t) => ymOf(t.trip_date) === ym),
      fuel: args.fuel.filter((f) => ymOf(f.fuel_date) === ym),
      expenses: args.expenses.filter((e) => ymOf(e.expense_date) === ym),
      services: args.services.filter((s) => ymOf(s.service_date) === ym),
      vehicles: args.vehicles,
    }),
  )
  return combinePL(parts)
}

export function combinePL(parts: PL[]): PL {
  const add = (f: (p: PL) => number) => parts.reduce((s, p) => s + f(p), 0)
  const combined = finalise({
    revenue: add((p) => p.revenue),
    express: add((p) => p.express),
    fuel: add((p) => p.fuel),
    wages: add((p) => p.wages),
    otherExpenses: add((p) => p.otherExpenses),
    servicing: add((p) => p.servicing),
    hire: add((p) => p.hire),
  })
  // A period is only "complete" if every month that actually earned has wages;
  // one unpaid month would otherwise be hidden by the others.
  const earning = parts.filter((p) => p.revenue > 0)
  return {
    ...combined,
    costsComplete: earning.length > 0 && earning.every((p) => p.costsComplete),
  }
}

function finalise(v: {
  revenue: number; express: number; fuel: number
  wages: number; otherExpenses: number; servicing: number; hire: number
}): PL {
  const costs = v.fuel + v.wages + v.otherExpenses + v.servicing + v.hire
  const net = v.revenue - costs
  const loggedCosts: string[] = []
  if (v.fuel > 0) loggedCosts.push('fuel')
  if (v.hire > 0) loggedCosts.push('hire')
  if (v.servicing > 0) loggedCosts.push('servicing')
  if (v.otherExpenses > 0) loggedCosts.push('other costs')
  if (v.wages > 0) loggedCosts.push('wages')
  return {
    ...v,
    netRevenue: v.revenue - v.express,
    costs,
    net,
    margin: v.revenue > 0 ? net / v.revenue : 0,
    costsComplete: v.wages > 0,
    loggedCosts,
  }
}

// Join a list the way a person writes one: "fuel, hire & servicing".
export function listCosts(items: string[]): string {
  if (items.length === 0) return 'nothing yet'
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`
}

// What to headline on a dashboard/report. The label never claims more than the
// data supports, and the hint names exactly which costs are behind the number.
export function profitHeadline(pl: PL): { label: string; value: number; margin: number; hint: string } {
  if (pl.costsComplete) {
    return { label: 'Net profit', value: pl.net, margin: pl.margin, hint: `after ${listCosts(pl.loggedCosts)}` }
  }
  return {
    label: 'Profit before wages',
    value: pl.net,
    margin: pl.margin,
    hint: `after ${listCosts(pl.loggedCosts)} · wages not logged yet`,
  }
}
