import { PageHeader } from '@/components/ui'
import { listDrivers, listVehicles } from '@/lib/db'
import DriverManager from './DriverManager'

export const dynamic = 'force-dynamic'

export default async function DriversPage() {
  const [drivers, vehicles] = await Promise.all([listDrivers(), listVehicles()])

  return (
    <>
      <PageHeader title="Drivers" subtitle={`${drivers.length} driver${drivers.length === 1 ? '' : 's'}`} />
      <DriverManager drivers={drivers} vehicles={vehicles} />
    </>
  )
}
