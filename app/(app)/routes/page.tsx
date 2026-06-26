import { PageHeader } from '@/components/ui'
import { listRoutes } from '@/lib/db'
import ExcelImport from '@/components/ExcelImport'
import type { FieldSpec } from '@/lib/import-types'
import RouteManager from './RouteManager'
import { importRoutes } from './import-actions'

export const dynamic = 'force-dynamic'

const ROUTE_SPEC: FieldSpec[] = [
  { key: 'pickup', label: 'From', keywords: ['from', 'pickup', 'origin'], required: true },
  { key: 'dropoff', label: 'To', keywords: ['to', 'dropoff', 'destination'], required: true },
  { key: 'price_saloon', label: 'Saloon price', keywords: ['saloon', 'sedan'] },
  { key: 'price_wagon', label: 'Wagon price', keywords: ['wagon', 'estate'] },
  { key: 'price_van', label: 'Van price', keywords: ['van', 'noah', 'hiace'] },
  { key: 'price_bus', label: 'Coaster / Bus price', keywords: ['bus', 'coaster'] },
  { key: 'notes', label: 'Notes', keywords: ['note', 'remark'] },
]

export default async function RoutesPage() {
  const routes = await listRoutes()
  return (
    <>
      <PageHeader title="Routes & rate card" subtitle="Standard routes priced per vehicle class" />
      <div style={{ marginBottom: 14 }}>
        <ExcelImport
          label="Import routes from Excel"
          spec={ROUTE_SPEC}
          importAction={importRoutes}
          hint="Upload a sheet of routes with prices per class. Existing routes (same From → To) get updated."
        />
      </div>
      <RouteManager routes={routes} />
    </>
  )
}
