import { PageHeader } from '@/components/ui'
import MonthNav from '@/components/MonthNav'
import { listDrivers, listTrips, listVehicles } from '@/lib/db'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { MONTH_NAMES, monthRange } from '@/lib/format'
import { stickyPeriod } from '@/lib/period'
import DriverManager from './DriverManager'

export const dynamic = 'force-dynamic'

export default async function DriversPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const profile = await requireProfile()
  const { year, month } = await stickyPeriod(await searchParams)
  const { start, end } = monthRange(year, month)
  // Trip counts are operational data; a role without operations access sees none.
  const operations = ['owner', 'accountant', 'office'].includes(profile.role)
  const [drivers, vehicles, trips] = await Promise.all([listDrivers(), listVehicles(), operations ? listTrips(start, end) : Promise.resolve([])])

  let tripCounts: Record<string, number> | null = null
  if (operations) {
    tripCounts = {}
    for (const trip of trips) if (trip.status === 'completed' && trip.driver_id) tripCounts[trip.driver_id] = (tripCounts[trip.driver_id] ?? 0) + 1
  }

  return (
    <>
      <PageHeader
        title="Drivers" subtitle={`${drivers.length} driver${drivers.length === 1 ? '' : 's'}`}
        action={operations ? <MonthNav year={year} month={month} /> : undefined}
      />
      <DriverManager
        drivers={canSeeFinance(profile.role) ? drivers : drivers.map((driver) => ({ ...driver, monthly_wage: 0 }))}
        vehicles={vehicles} canFinance={canSeeFinance(profile.role)}
        tripCounts={tripCounts} monthLabel={`${MONTH_NAMES[month].slice(0, 3)} ${year}`}
      />
    </>
  )
}
