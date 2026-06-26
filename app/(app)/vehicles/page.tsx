import { PageHeader } from '@/components/ui'
import { listVehicles } from '@/lib/db'
import VehicleManager from './VehicleManager'

export const dynamic = 'force-dynamic'

export default async function VehiclesPage() {
  const vehicles = await listVehicles()

  return (
    <>
      <PageHeader title="Fleet" subtitle={`${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}`} />
      <VehicleManager vehicles={vehicles} />
    </>
  )
}
