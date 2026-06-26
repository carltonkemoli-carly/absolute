import { PageHeader, StatCard } from '@/components/ui'
import { listServices, listVehicles } from '@/lib/db'
import { kes } from '@/lib/format'
import ServiceManager from './ServiceManager'

export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  const [services, vehicles] = await Promise.all([listServices(), listVehicles()])

  const now = new Date()
  const ym = now.toISOString().slice(0, 7)
  const monthCost = services.filter((s) => s.service_date.slice(0, 7) === ym).reduce((a, s) => a + Number(s.cost), 0)
  const ytdCost = services.filter((s) => s.service_date.slice(0, 4) === String(now.getFullYear())).reduce((a, s) => a + Number(s.cost), 0)

  return (
    <>
      <PageHeader title="Servicing" subtitle="Maintenance log for every vehicle" />
      <div className="grid-stats" style={{ marginBottom: 18 }}>
        <StatCard label="Service cost this month" value={kes(monthCost)} />
        <StatCard label="Service cost this year" value={kes(ytdCost)} />
        <StatCard label="Records" value={String(services.length)} />
      </div>
      <ServiceManager services={services} vehicles={vehicles} />
    </>
  )
}
