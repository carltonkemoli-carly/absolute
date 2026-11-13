import { PageHeader } from '@/components/ui'
import { listTrips, listUnassignedTrips, listDrivers, listVehicles, listContractors, listOrganizations } from '@/lib/db'
import { nairobiToday, isCalendarDate } from '@/lib/nairobi-date'
import { requireOperations } from '@/lib/auth'
import type { Contractor, Driver, Organization, Trip, Vehicle } from '@/lib/types'
import DispatchBoard from './DispatchBoard'

export const dynamic = 'force-dynamic'

export default async function DispatchPage({
  searchParams,
}: { searchParams: Promise<{ d?: string }> }) {
  const profile = await requireOperations()
  const sp = await searchParams
  const day = sp.d && isCalendarDate(sp.d) ? sp.d : nairobiToday()

  const [trips, unassigned, drivers, vehicles, contractors, organizations] = await Promise.all([
    listTrips(day, day), listUnassignedTrips(), listDrivers(), listVehicles(), listContractors(), listOrganizations(),
  ])

  return (
    <>
      <PageHeader title="Dispatch" />
      <DispatchBoard
        day={day}
        canClearPending={profile.role === 'owner'}
        trips={(trips as Trip[])}
        pendingTrips={unassigned.trips}
        pendingTotal={unassigned.total}
        lookups={{
          drivers: drivers as Driver[],
          vehicles: vehicles as Vehicle[],
          organizations: organizations as Organization[],
          contractors: contractors as Contractor[],
        }}
      />
    </>
  )
}
