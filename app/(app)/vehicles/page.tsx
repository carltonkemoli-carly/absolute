import { PageHeader, StatCard, Card, Section } from '@/components/ui'
import SegmentDonut from '@/components/SegmentDonut'
import { topSegments, type Seg } from '@/lib/chart'
import { listVehicles } from '@/lib/db'
import { OWNERSHIP_LABELS, type VehicleOwnership } from '@/lib/types'
import { kes } from '@/lib/format'
import VehicleManager from './VehicleManager'

export const dynamic = 'force-dynamic'

const GREEN = '#2C7A53', GOLD = '#C9A227', TEAL = '#2F9E8F'

export default async function VehiclesPage() {
  const vehicles = await listVehicles()

  const countBy = (f: (v: (typeof vehicles)[number]) => boolean) => vehicles.filter(f).length
  const sumBy = (f: (v: (typeof vehicles)[number]) => number) => vehicles.reduce((a, v) => a + (Number(f(v)) || 0), 0)

  // Fleet mix by ownership — mirrors the dashboard's Fleet donut.
  const ownershipMix: Seg[] = ([['owned', GREEN], ['monthly_hire', GOLD], ['casual_hire', TEAL]] as const)
    .map(([o, color]) => ({ label: OWNERSHIP_LABELS[o as VehicleOwnership], value: countBy((v) => v.ownership === o), color }))

  // Class mix — what the fleet can actually sell, in the rate card's own classes.
  const classMix: Seg[] = topSegments(
    [...vehicles.reduce((m, v) => {
      const k = v.vehicle_type?.trim() || 'Unspecified'
      return m.set(k, (m.get(k) ?? 0) + 1)
    }, new Map<string, number>())].map(([label, value]) => ({ label, value })),
    6,
  )

  const owned = countBy((v) => v.ownership === 'owned')
  const active = countBy((v) => v.status === 'active')
  const inShop = countBy((v) => v.status === 'in_shop')
  const hireCost = vehicles.filter((v) => v.ownership === 'monthly_hire').reduce((a, v) => a + (Number(v.monthly_fee) || 0), 0)
  const loanMonthly = sumBy((v) => v.loan_monthly)

  return (
    <>
      <PageHeader title="Fleet" subtitle={`${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}`} />

      <Section title="Fleet overview">
        <div className="grid-stats" style={{ marginBottom: 16 }}>
          <StatCard label="Vehicles" value={String(vehicles.length)} hint={`${owned} owned · ${vehicles.length - owned} hired`} />
          <StatCard label="On the road" value={String(active)}
            hint={inShop > 0 ? `${inShop} in the shop` : 'all available'}
            accent={inShop > 0 ? 'var(--gold)' : 'var(--accent)'} />
          <StatCard label="Monthly hire cost" value={kes(hireCost)} hint="fixed, every month" accent={hireCost > 0 ? 'var(--gold)' : undefined} />
          <StatCard label="Loan repayments" value={kes(loanMonthly)} hint="per month" accent={loanMonthly > 0 ? 'var(--gold)' : undefined} />
        </div>

        <div className="grid-2">
          <Card title="Owned vs hired">
            {vehicles.length === 0 ? <Empty /> : (
              <SegmentDonut data={ownershipMix} centerValue={String(vehicles.length)} centerLabel="vehicles" badges />
            )}
          </Card>
          <Card title="By vehicle class">
            {vehicles.length === 0 ? <Empty /> : (
              <SegmentDonut data={classMix} centerValue={String(classMix.length)} centerLabel={`class${classMix.length === 1 ? '' : 'es'}`} badges />
            )}
          </Card>
        </div>
      </Section>

      <VehicleManager vehicles={vehicles} />
    </>
  )
}

function Empty() {
  return <p style={{ fontSize: 13.5, color: 'var(--ink3)' }}>No vehicles yet — add your first one below.</p>
}
