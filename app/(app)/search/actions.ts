'use server'

import { requireOperations, canSeeFinance } from '@/lib/auth'
import { listContractors, listDrivers, listInvoices, listOrganizations, listRoutes, listTrips, listVehicles } from '@/lib/db'
import { nairobiToday } from '@/lib/nairobi-date'
import { searchRecords, shiftCalendarDay, type RecordSearchGroup } from '@/lib/record-search'

// Record lookup for the command palette. Same matching and the same role scope
// as the Find records page: finance records are only searched for finance
// roles, and trips cover the last 90 days. A handful of results per type —
// the palette links to the full page for more.
export async function quickSearch(raw: string): Promise<RecordSearchGroup[]> {
  const profile = await requireOperations()
  const query = String(raw ?? '').trim().slice(0, 100)
  if (query.length < 2) return []

  const finance = canSeeFinance(profile.role)
  const today = nairobiToday()
  const [trips, vehicles, drivers, organizations, contractors, routes, invoices] = await Promise.all([
    listTrips(shiftCalendarDay(today, -89), today), listVehicles(), listDrivers(), listOrganizations(),
    listContractors(), listRoutes(), finance ? listInvoices() : Promise.resolve([]),
  ])
  return searchRecords(query, { trips, vehicles, drivers, organizations, contractors, routes, invoices }, finance, 4)
}
