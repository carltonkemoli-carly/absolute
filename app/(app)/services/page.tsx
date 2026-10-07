import { PageHeader, StatCard, Card, Section } from '@/components/ui'
import SegmentDonut from '@/components/SegmentDonut'
import { Bars } from '@/components/Bars'
import { topSegments } from '@/lib/chart'
import { listServices, listVehicles } from '@/lib/db'
import { kes, kesPlain, isoDate, addDays } from '@/lib/format'
import ServiceManager from './ServiceManager'

export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  const [services, vehicles] = await Promise.all([listServices(), listVehicles()])

  // Local Y-M-D — toISOString() would shift the day (Kenya is UTC+3).
  const today = isoDate(new Date())
  const ym = today.slice(0, 7)
  const year = today.slice(0, 4)

  const thisYear = services.filter((s) => s.service_date.slice(0, 4) === year)
  const monthCost = services.filter((s) => s.service_date.slice(0, 7) === ym).reduce((a, s) => a + Number(s.cost), 0)
  const ytdCost = thisYear.reduce((a, s) => a + Number(s.cost), 0)

  const in30 = isoDate(addDays(new Date(), 30))
  const dueSoon = services.filter((s) => s.next_service_date && s.next_service_date >= today && s.next_service_date <= in30).length

  const plate = (id: string) => vehicles.find((v) => v.id === id)?.plate ?? 'Unknown vehicle'
  const totalInto = (key: (s: (typeof services)[number]) => string) => {
    const m = new Map<string, number>()
    for (const s of thisYear) m.set(key(s), (m.get(key(s)) ?? 0) + Number(s.cost))
    return [...m].map(([label, value]) => ({ label, value })).filter((i) => i.value > 0)
  }

  // Where the maintenance money actually goes — the part-to-whole worth charting.
  const byType = topSegments(totalInto((s) => s.service_type?.trim() || 'Unspecified'), 6)
  const byVehicle = totalInto((s) => plate(s.vehicle_id)).sort((a, b) => b.value - a.value)

  return (
    <>
      <PageHeader title="Servicing" subtitle="Maintenance log for every vehicle" />

      <Section title="Servicing overview">
        <div className="grid-stats" style={{ marginBottom: ytdCost > 0 ? 16 : 2 }}>
          <StatCard label="Service cost this month" value={kes(monthCost)} />
          <StatCard label="Service cost this year" value={kes(ytdCost)} />
          <StatCard label="Records" value={String(services.length)} hint={`${thisYear.length} this year`} />
          <StatCard label="Due in 30 days" value={String(dueSoon)}
            hint={dueSoon > 0 ? 'booked by next service date' : 'nothing falling due'}
            accent={dueSoon > 0 ? 'var(--gold)' : 'var(--accent)'} />
        </div>

        {ytdCost > 0 && (
          <div className="grid-2">
            <Card title={`Spend by type (${year})`}>
              <SegmentDonut data={byType} centerValue={kesPlain(ytdCost)} centerLabel="Ksh this year" centerSize={18} money />
            </Card>
            <Card title={`Spend by vehicle (${year})`}>
              <Bars
                items={byVehicle.slice(0, 10).map((v) => ({ label: v.label, value: v.value, sub: `${Math.round((v.value / ytdCost) * 100)}%` }))}
                max={Math.max(1, ...byVehicle.map((v) => v.value))} format={kes} accent="var(--accent)" />
            </Card>
          </div>
        )}
      </Section>

      <ServiceManager services={services} vehicles={vehicles} />
    </>
  )
}
