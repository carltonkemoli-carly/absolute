import type { Contractor, Driver, Organization, Trip, TripStatus, Vehicle } from './types'

export type TripFilterState = {
  query: string
  status: TripStatus | ''
  contractorId: string
  driverId: string
  vehicleId: string
  assignment: 'all' | 'assigned' | 'unassigned'
}
export type TripFilterLookups = { contractors: Contractor[]; organizations: Organization[]; drivers: Driver[]; vehicles: Vehicle[] }
export const EMPTY_TRIP_FILTERS: TripFilterState = { query: '', status: '', contractorId: '', driverId: '', vehicleId: '', assignment: 'all' }
export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  booked: 'Booked', assigned: 'Assigned', dispatched: 'Dispatched', confirmed: 'Confirmed', enroute: 'En route', completed: 'Completed', cancelled: 'Cancelled',
}
function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}
export function filterTrips(trips: Trip[], filters: TripFilterState, lookups: TripFilterLookups): Trip[] {
  const organizations = new Map(lookups.organizations.map(item => [item.id, item.name]))
  const contractors = new Map(lookups.contractors.map(item => [item.id, item.name]))
  const drivers = new Map(lookups.drivers.map(item => [item.id, item.name]))
  const vehicles = new Map(lookups.vehicles.map(item => [item.id, `${item.plate} ${item.model ?? ''}`]))
  const words = normalize(filters.query).split(' ').filter(Boolean)
  return trips.filter(trip => {
    if (filters.status && trip.status !== filters.status) return false
    if (filters.contractorId && trip.contractor_id !== filters.contractorId) return false
    if (filters.driverId && trip.driver_id !== filters.driverId) return false
    if (filters.vehicleId && trip.vehicle_id !== filters.vehicleId) return false
    const assigned = Boolean(trip.driver_id && trip.vehicle_id)
    if (filters.assignment === 'assigned' && !assigned) return false
    // A partial assignment still needs attention. Do not lose it from the queue.
    if (filters.assignment === 'unassigned' && assigned) return false
    if (!words.length) return true
    const searchable = normalize([
      trip.client_name, trip.trip_date, trip.slip_no, trip.voucher_no, trip.pickup, trip.dropoff,
      trip.notes, TRIP_STATUS_LABELS[trip.status],
      organizations.get(trip.organization_id ?? ''), contractors.get(trip.contractor_id ?? ''),
      drivers.get(trip.driver_id ?? ''), vehicles.get(trip.vehicle_id ?? ''),
    ].filter(Boolean).join(' '))
    return words.every(word => searchable.includes(word))
  })
}
