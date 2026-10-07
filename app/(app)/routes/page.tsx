import { PageHeader, StatCard, Card, Section } from '@/components/ui'
import { listRoutes } from '@/lib/db'
import ExcelImport from '@/components/ExcelImport'
import SegmentDonut from '@/components/SegmentDonut'
import { Bars } from '@/components/Bars'
import type { Seg } from '@/lib/chart'
import { kes } from '@/lib/format'
import type { FieldSpec } from '@/lib/import-types'
import type { Route } from '@/lib/types'
import RouteManager from './RouteManager'
import { importRoutes } from './import-actions'

export const dynamic = 'force-dynamic'

const GREEN = '#2C7A53', GOLD = '#C9A227', RED = '#BC3E22'
const CLASSES = ['price_saloon', 'price_wagon', 'price_van', 'price_bus'] as const

// How many of the four vehicle classes this route is actually priced for.
function pricedClasses(r: Route): number {
  return CLASSES.filter((c) => Number(r[c]) > 0).length
}

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

  const active = routes.filter((r) => r.active)
  const full = routes.filter((r) => pricedClasses(r) === CLASSES.length).length
  const partial = routes.filter((r) => { const n = pricedClasses(r); return n > 0 && n < CLASSES.length }).length
  const none = routes.filter((r) => pricedClasses(r) === 0).length
  const gaps = partial + none

  // A rate card is only as good as its coverage — this is the part-to-whole that
  // actually tells her what's left to price.
  const coverage: Seg[] = [
    { label: 'Priced for all 4 classes', value: full, color: GREEN },
    { label: 'Partly priced', value: partial, color: GOLD },
    { label: 'No prices yet', value: none, color: RED },
  ]

  const vanFares = routes.map((r) => Number(r.price_van)).filter((n) => n > 0)
  const avgVan = vanFares.length ? vanFares.reduce((a, b) => a + b, 0) / vanFares.length : 0

  return (
    <>
      <PageHeader title="Routes & rate card" subtitle="Standard routes priced per vehicle class" />

      <Section title="Rate card overview">
        <div className="grid-stats" style={{ marginBottom: gaps > 0 ? 16 : 2 }}>
          <StatCard label="Routes" value={String(routes.length)} hint={`${active.length} active`} />
          <StatCard label="Fully priced" value={String(full)} hint="all four classes" accent="var(--accent)" />
          <StatCard label="Still to price" value={String(gaps)}
            hint={gaps > 0 ? 'missing at least one class' : 'nothing missing'}
            accent={gaps > 0 ? 'var(--gold)' : 'var(--accent)'} />
          <StatCard label="Average van fare" value={kes(avgVan)} hint="across priced routes" />
        </div>

        {/* Only chart the coverage when something is actually missing — a complete
            rate card draws a single full ring, which tells her nothing. */}
        {gaps > 0 && (
          <div className="grid-2">
            <Card title="Pricing coverage">
              <SegmentDonut data={coverage} centerValue={String(routes.length)} centerLabel="routes" badges />
            </Card>
            <Card title="Where the gaps are">
              <ClassGaps routes={routes} />
            </Card>
          </div>
        )}
      </Section>

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

// Per-class coverage — says which price column is the one with holes in it.
function ClassGaps({ routes }: { routes: Route[] }) {
  const labels: Record<(typeof CLASSES)[number], string> = {
    price_saloon: 'Saloon', price_wagon: 'Wagon', price_van: 'Van', price_bus: 'Coaster / Bus',
  }
  const items = CLASSES.map((c) => {
    const n = routes.filter((r) => Number(r[c]) > 0).length
    return { label: labels[c], value: n, sub: `${Math.round((n / routes.length) * 100)}% of routes` }
  })
  return <Bars items={items} max={routes.length} format={(v) => `${v} route${v === 1 ? '' : 's'}`} accent="var(--accent)" emptyText="No prices set yet." />
}
