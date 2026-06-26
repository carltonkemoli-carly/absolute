// Builds the list of things needing attention: documents expiring/expired and
// services coming due. Shared by the dashboard Attention panel and Compliance page.
import type { ComplianceDoc, Driver, Vehicle, VehicleService } from '@/lib/types'

export type Severity = 'expired' | 'soon' | 'ok'
export interface AttentionItem {
  kind: 'document' | 'service'
  severity: Severity
  subject: string      // e.g. "KCD196X" or "David Matista"
  label: string        // e.g. "Insurance" or "Service due"
  detail: string       // e.g. "expired 5 days ago" / "in 12 days"
  date: string | null
  days: number | null  // days until (negative = past)
}

const DAY = 86400000
const SOON_DAYS = 30
const SERVICE_SOON_DAYS = 21

function daysUntil(date: string): number {
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime()
  return Math.round((new Date(date).getTime() - today) / DAY)
}

function relative(days: number): string {
  if (days < 0) return `expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
  if (days === 0) return 'expires today'
  return `in ${days} day${days === 1 ? '' : 's'}`
}

export function buildAttention(
  documents: ComplianceDoc[],
  services: VehicleService[],
  vehicles: Vehicle[],
  drivers: Driver[],
): AttentionItem[] {
  const items: AttentionItem[] = []
  const plate = (id: string | null) => vehicles.find((v) => v.id === id)?.plate ?? 'Vehicle'
  const dname = (id: string | null) => drivers.find((d) => d.id === id)?.name ?? 'Driver'

  for (const doc of documents) {
    if (!doc.expiry_date) continue
    if (doc.attended) continue // already followed up — stop nagging
    const days = daysUntil(doc.expiry_date)
    if (days > SOON_DAYS) continue
    items.push({
      kind: 'document',
      severity: days < 0 ? 'expired' : 'soon',
      subject: doc.owner_kind === 'vehicle' ? plate(doc.vehicle_id) : dname(doc.driver_id),
      label: doc.doc_type,
      detail: relative(days),
      date: doc.expiry_date,
      days,
    })
  }

  // Latest next-service-due per vehicle
  const latestByVehicle = new Map<string, VehicleService>()
  for (const s of services) {
    if (!s.next_service_date) continue
    const cur = latestByVehicle.get(s.vehicle_id)
    if (!cur || s.service_date > cur.service_date) latestByVehicle.set(s.vehicle_id, s)
  }
  for (const [vehicleId, s] of latestByVehicle) {
    const days = daysUntil(s.next_service_date!)
    if (days > SERVICE_SOON_DAYS) continue
    items.push({
      kind: 'service',
      severity: days < 0 ? 'expired' : 'soon',
      subject: plate(vehicleId),
      label: 'Service due',
      detail: relative(days),
      date: s.next_service_date,
      days,
    })
  }

  // Soonest / most overdue first
  return items.sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
}
