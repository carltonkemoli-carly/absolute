import { PageHeader, Badge } from '@/components/ui'
import { listTrips, listDrivers, listVehicles } from '@/lib/db'
import { isoDate, fmtDateTime } from '@/lib/format'
import type { Driver, Trip, Vehicle } from '@/lib/types'

export const dynamic = 'force-dynamic'

const STATUS_TONE: Record<string, 'neutral' | 'gold' | 'green' | 'red'> = {
  booked: 'neutral', assigned: 'gold', dispatched: 'gold', confirmed: 'green', enroute: 'green', completed: 'green', cancelled: 'red',
}

export default async function FlightsPage() {
  const today = new Date()
  const end = new Date(today); end.setDate(end.getDate() + 14)

  const [trips, drivers, vehicles] = await Promise.all([
    listTrips(isoDate(today), isoDate(end)), listDrivers(), listVehicles(),
  ])

  const flights = (trips as Trip[])
    .filter((t) => t.flight_no && t.flight_time)
    .sort((a, b) => (a.flight_time as string).localeCompare(b.flight_time as string))

  const plate = (id: string | null) => (vehicles as Vehicle[]).find((v) => v.id === id)?.plate ?? '—'
  const dname = (id: string | null) => (drivers as Driver[]).find((d) => d.id === id)?.name ?? 'Unassigned'

  return (
    <>
      <PageHeader title="Flights" subtitle="Airport jobs by flight time — next 14 days" />
      {flights.length === 0 ? (
        <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--ink3)' }}>No upcoming flights logged. Add a flight number &amp; time on a trip to see it here.</div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 760 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <Th>Flight</Th><Th>Time</Th><Th>Client</Th><Th>Route</Th><Th>Vehicle</Th><Th>Driver</Th><Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {flights.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <Td><strong>✈ {t.flight_no}</strong></Td>
                  <Td>{fmtDateTime(t.flight_time as string)}</Td>
                  <Td>{t.client_name}</Td>
                  <Td>{(t.pickup || '—')} → {(t.dropoff || '—')}</Td>
                  <Td>{plate(t.vehicle_id)}</Td>
                  <Td>{dname(t.driver_id)}</Td>
                  <Td><Badge tone={STATUS_TONE[t.status] ?? 'neutral'}>{t.status}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</th>
}
function Td({ children }: { children?: React.ReactNode }) {
  return <td style={{ padding: '11px 14px' }}>{children}</td>
}
