// Gathers every dataset for backup/export. Shared by the /api/export endpoint
// (pull model) and the "Back up to Sheet now" action (push model).
import {
  listTrips, listFuel, listServices, listVehicles, listDrivers,
  listContractors, listOrganizations, listRoutes, listDocuments,
  listExpenses, listTargets,
} from '@/lib/db'

const WIDE_START = '2000-01-01'
const WIDE_END = '2999-12-31'

export async function gatherDatasets() {
  const [trips, fuel, services, vehicles, drivers, contractors, organizations, routes, documents, expenses, targets] = await Promise.all([
    listTrips(WIDE_START, WIDE_END), listFuel(WIDE_START, WIDE_END), listServices(),
    listVehicles(), listDrivers(), listContractors(), listOrganizations(), listRoutes(), listDocuments(),
    listExpenses(), listTargets(),
  ])
  return { trips, fuel, services, vehicles, drivers, contractors, organizations, routes, documents, expenses, targets }
}
