import { PageHeader } from '@/components/ui'
import { requireProfile } from '@/lib/auth'
import { listRoutes, getCompany } from '@/lib/db'
import QuoteCalculator, { type QuoteRoute } from './QuoteCalculator'

export const dynamic = 'force-dynamic'

export default async function QuotePage() {
  await requireProfile()
  const [routes, company] = await Promise.all([listRoutes(), getCompany()])
  const qr: QuoteRoute[] = routes.map((r) => ({
    id: r.id, pickup: r.pickup, dropoff: r.dropoff,
    saloon: Number(r.price_saloon) || 0, wagon: Number(r.price_wagon) || 0,
    van: Number(r.price_van) || 0, bus: Number(r.price_bus) || 0,
  }))

  return (
    <>
      <PageHeader title="Quote a fare" subtitle="Instant, correct pricing from your rate card — for when a client calls" />
      <QuoteCalculator routes={qr} companyName={company.name} />
    </>
  )
}
