import { PageHeader } from '@/components/ui'
import { listTrips, listUnassignedTrips, listDrivers, listVehicles, listContractors, listOrganizations } from '@/lib/db'
import { isoDate } from '@/lib/format'
import type { Contractor, Driver, Organization, Trip, Vehicle } from '@/lib/types'
import DispatchBoard from './DispatchBoard'

export const dynamic = 'force-dynamic'

export default async function DispatchPage({
  searchParams,
}: { searchParams: Promise<{ d?: string }> }) {
  const sp = await searchParams
  const day = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : isoDate(new Date())

  const [trips, unassigned, drivers, vehicles, contractors, organizations] = await Promise.all([
    listTrips(day, day), listUnassignedTrips(), listDrivers(), listVehicles(), listContractors(), listOrganizations(),
  ])

  return (
    <>
      <PageHeader title="Dispatch" subtitle="Assign drivers, confirm jobs, and contact the team" />
      <DispatchBoard
        day={day}
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
