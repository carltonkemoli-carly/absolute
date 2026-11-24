// Can this month's figures be relied on? The profit shown anywhere in the app is
// only as good as the records behind it, so this lists what is still missing or
// unfinished, with where to fix each. Pure, so it is tested without a database.
import type { Driver, Expense, FuelEntry, Invoice, Trip } from '@/lib/types'
import { WAGES_CATEGORY } from '@/lib/finance'

export type CheckState = 'ok' | 'warn' | 'bad'

export interface CloseCheck {
  key: string
  title: string
  state: CheckState
  detail: string
  href: string
  action: string
}

export interface CloseInput {
  trips: Trip[]        // every trip dated in the month
  fuel: FuelEntry[]    // fuel entries dated in the month
  expenses: Expense[]  // expenses dated in the month
  drivers: Driver[]
  invoices: Invoice[]  // all invoices, for coverage and overdue
  today: string
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`
const money = (n: number) => `KES ${Math.round(n).toLocaleString('en-KE')}`

// An older invoice may cover a trip by its billed date range without the trip
// carrying an invoice link, so either counts as billed.
function isBilled(trip: Trip, invoices: Invoice[]): boolean {
  if (trip.invoice_id) return true
  return invoices.some((invoice) => invoice.contractor_id && invoice.contractor_id === trip.contractor_id
    && invoice.period_start && invoice.period_end && invoice.period_start <= trip.trip_date && trip.trip_date <= invoice.period_end)
}

export function monthCloseChecks(input: CloseInput): CloseCheck[] {
  const { trips, fuel, expenses, drivers, invoices, today } = input
  const completed = trips.filter((trip) => trip.status === 'completed')
  const checks: CloseCheck[] = []

  // 1. Jobs that have happened but were never finished in the system.
  const stuck = trips.filter((trip) => trip.trip_date < today && trip.status !== 'completed' && trip.status !== 'cancelled')
  checks.push({
    key: 'open-trips', title: 'Past trips are completed or cancelled',
    state: stuck.length ? 'bad' : 'ok',
    detail: stuck.length
      ? `${plural(stuck.length, 'trip')} from before today ${stuck.length === 1 ? 'is' : 'are'} still booked, assigned or on the road. Only completed trips count as revenue.`
      : 'Every trip dated before today is either completed or cancelled.',
    href: '/trips', action: 'Open trips',
  })

  // 2. Completed trips that earn nothing once tolls are taken out.
  const noFare = completed.filter((trip) => !(Number(trip.amount) > Number(trip.express_charges || 0)))
  checks.push({
    key: 'no-fare', title: 'Every completed trip has a fare',
    state: noFare.length ? 'bad' : 'ok',
    detail: noFare.length
      ? `${plural(noFare.length, 'completed trip')} ${noFare.length === 1 ? 'has' : 'have'} no fare after expressway tolls. They cannot be invoiced.`
      : 'No completed trip is missing its fare.',
    href: '/data-health', action: 'Open data health',
  })

  // 3. Per-driver and per-vehicle figures depend on tagging.
  const untagged = completed.filter((trip) => !trip.driver_id || !trip.vehicle_id)
  const taggedShare = completed.length ? (completed.length - untagged.length) / completed.length : 1
  checks.push({
    key: 'tagging', title: 'Completed trips have a driver and vehicle',
    state: untagged.length === 0 ? 'ok' : taggedShare >= 0.9 ? 'warn' : 'bad',
    detail: untagged.length === 0
      ? 'Every completed trip is tagged, so per-driver and per-vehicle figures are complete.'
      : `${untagged.length} of ${completed.length} completed trips (${Math.round((1 - taggedShare) * 100)}%) are missing a driver or vehicle, so those figures leave them out.`,
    href: '/trips', action: 'Tag trips',
  })

  // 4. Work done but never billed to its supplier.
  const unbilled = completed.filter((trip) => trip.contractor_id && !isBilled(trip, invoices))
  const unbilledValue = unbilled.reduce((sum, trip) => sum + Number(trip.amount || 0), 0)
  checks.push({
    key: 'invoiced', title: 'Supplier work is invoiced',
    state: unbilled.length ? 'warn' : 'ok',
    detail: unbilled.length
      ? `${plural(unbilled.length, 'completed trip')} for suppliers (${money(unbilledValue)}) ${unbilled.length === 1 ? 'is' : 'are'} not on an invoice yet.`
      : 'Every completed supplier trip is on an invoice.',
    href: '/receivables', action: 'Invoice the month',
  })

  // 5. Wages are the largest cost that is usually left out.
  const paid = drivers.filter((driver) => driver.status === 'active' && Number(driver.monthly_wage) > 0)
  const budget = paid.reduce((sum, driver) => sum + Number(driver.monthly_wage), 0)
  const wages = expenses.filter((expense) => expense.category === WAGES_CATEGORY).reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const wageState: CheckState = budget <= 0 ? 'ok' : wages <= 0 ? 'bad' : wages < budget * 0.9 ? 'warn' : 'ok'
  checks.push({
    key: 'wages', title: 'Driver wages are recorded',
    state: wageState,
    detail: budget <= 0 ? 'No driver has a monthly wage set, so none is expected.'
      : wages <= 0 ? `No wages are recorded. ${plural(paid.length, 'driver')} on a monthly wage ${paid.length === 1 ? 'costs' : 'cost'} ${money(budget)}, so profit is overstated by that much.`
      : `${money(wages)} recorded against ${money(budget)} of monthly wages${wages < budget * 0.9 ? ', so some wages may be missing' : ''}.`,
    href: '/expenses', action: 'Record wages',
  })

  // 6. Fuel is the main running cost.
  checks.push({
    key: 'fuel', title: 'Fuel is recorded',
    state: completed.length > 0 && fuel.length === 0 ? 'bad' : 'ok',
    detail: completed.length > 0 && fuel.length === 0
      ? 'There are completed trips but no fuel is recorded, so the fuel cost is missing.'
      : fuel.length ? `${plural(fuel.length, 'fuel payment')} recorded, ${money(fuel.reduce((sum, entry) => sum + Number(entry.amount || 0), 0))} in total.` : 'No trips, so no fuel is expected.',
    href: '/fuel', action: 'Import fuel',
  })

  // 7. Everything else a business pays: insurance, licences, parking, rent.
  const other = expenses.filter((expense) => expense.category !== WAGES_CATEGORY)
  checks.push({
    key: 'other-costs', title: 'Other running costs are recorded',
    state: other.length === 0 && completed.length > 0 ? 'warn' : 'ok',
    detail: other.length === 0 && completed.length > 0
      ? 'No insurance, licences, parking or other costs are recorded for the month. If there were none, this is fine; if not, profit is overstated.'
      : other.length ? `${plural(other.length, 'other cost')} recorded, ${money(other.reduce((sum, expense) => sum + Number(expense.amount || 0), 0))} in total.` : 'No trips, so no other costs are expected.',
    href: '/expenses', action: 'Add costs',
  })

  // 8. Money already past due is not a data problem, but it is the thing to chase.
  const late = invoices.filter((invoice) => Number(invoice.amount) - Number(invoice.amount_paid) > 0 && invoice.due_date && invoice.due_date < today)
  const lateValue = late.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid)), 0)
  checks.push({
    key: 'overdue', title: 'No invoice is past its due date',
    state: late.length ? 'warn' : 'ok',
    detail: late.length ? `${plural(late.length, 'invoice')} past due, ${money(lateValue)} still owed (all months).` : 'Nothing is past its due date.',
    href: '/receivables', action: 'Chase payment',
  })

  return checks
}

export interface CloseSummary {
  ready: boolean       // nothing red, nothing amber
  bad: number
  warn: number
  monthOver: boolean   // the month has finished; a running month can still change
}

export function closeSummary(checks: CloseCheck[], today: string, monthEnd: string): CloseSummary {
  const bad = checks.filter((check) => check.state === 'bad').length
  const warn = checks.filter((check) => check.state === 'warn').length
  return { ready: bad === 0 && warn === 0, bad, warn, monthOver: today > monthEnd }
}
