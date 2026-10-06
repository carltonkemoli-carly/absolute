// Canonical profit-and-loss for a single month. One source of truth so the
// dashboard, Insights, Reports and Goals can never drift apart.
//
// Honesty rule: until real running costs (wages, insurance, servicing, hire)
// are logged, we only know Fuel — so we report "gross profit" (revenue − fuel)
// and flag `hasCosts = false`. Once any of those costs exist for the month we
// switch to true net profit. Callers pass data already filtered to the month.
import type { Trip, FuelEntry, Expense, VehicleService, Vehicle } from '@/lib/types'

export interface PL {
  revenue: number
  express: number
  netRevenue: number // revenue minus pass-through expressway tolls
  fuel: number
  expenses: number
  servicing: number
  hire: number
  costs: number // fuel + expenses + servicing + hire
  gross: number // revenue − fuel
  net: number // revenue − all costs
  margin: number // net / revenue
  grossMargin: number // gross / revenue
  hasCosts: boolean // are any non-fuel costs logged? (controls gross vs net)
}

const sum = <T>(rows: T[], f: (r: T) => number): number =>
  rows.reduce((s, r) => s + Number(f(r) || 0), 0)

export function monthlyPL(args: {
  trips: Trip[]
  fuel: FuelEntry[]
  expenses: Expense[]
  services: VehicleService[]
  vehicles: Vehicle[]
}): PL {
  const revenue = sum(args.trips, (t) => t.amount)
  const express = sum(args.trips, (t) => t.express_charges)
  const fuel = sum(args.fuel, (f) => f.amount)
  const expenses = sum(args.expenses, (e) => e.amount)
  const servicing = sum(args.services, (s) => s.cost)
  // Monthly-hire vehicles cost a flat fee each month; casual hire is per trip.
  const monthlyHire = sum(args.vehicles.filter((v) => v.ownership === 'monthly_hire'), (v) => v.monthly_fee)
  const hire = monthlyHire + sum(args.trips, (t) => t.hire_cost)

  const costs = fuel + expenses + servicing + hire
  const gross = revenue - fuel
  const net = revenue - costs
  const hasCosts = expenses + servicing + hire > 0
  return {
    revenue,
    express,
    netRevenue: revenue - express,
    fuel,
    expenses,
    servicing,
    hire,
    costs,
    gross,
    net,
    margin: revenue > 0 ? net / revenue : 0,
    grossMargin: revenue > 0 ? gross / revenue : 0,
    hasCosts,
  }
}

// What to headline on a dashboard/report: net once real costs exist, else gross.
export function profitHeadline(pl: PL): { label: string; value: number; margin: number; hint: string } {
  if (pl.hasCosts) {
    return { label: 'Net profit', value: pl.net, margin: pl.margin, hint: 'after fuel, wages, servicing & hire' }
  }
  return { label: 'Gross profit', value: pl.gross, margin: pl.grossMargin, hint: 'revenue − fuel · before wages & other costs' }
}
