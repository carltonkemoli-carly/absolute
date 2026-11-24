// What one driver did in a date range, from the trips tagged with them. Pure,
// so the driver page and the tests share one definition of "a completed trip",
// "fares" and "days worked".
import type { Trip } from '@/lib/types'

export interface DriverMonth {
  completed: number
  fares: number          // fares only: expressway tolls are passed through, not earned
  avgFare: number
  daysWorked: number     // distinct dates with at least one completed trip
  open: number           // booked, assigned or on the road, not yet completed
  vehicles: { id: string; trips: number }[]
}

const inRange = (trip: Trip, start: string, end: string) => trip.trip_date >= start && trip.trip_date <= end
const fareOf = (trip: Trip) => Math.max(0, Number(trip.amount || 0) - Number(trip.express_charges || 0))

export function driverMonth(trips: Trip[], driverId: string, start: string, end: string): DriverMonth {
  const mine = trips.filter((trip) => trip.driver_id === driverId && inRange(trip, start, end))
  const done = mine.filter((trip) => trip.status === 'completed')
  const fares = done.reduce((sum, trip) => sum + fareOf(trip), 0)
  const perVehicle = new Map<string, number>()
  for (const trip of done) if (trip.vehicle_id) perVehicle.set(trip.vehicle_id, (perVehicle.get(trip.vehicle_id) ?? 0) + 1)
  return {
    completed: done.length,
    fares,
    avgFare: done.length ? fares / done.length : 0,
    daysWorked: new Set(done.map((trip) => trip.trip_date)).size,
    open: mine.filter((trip) => trip.status !== 'completed' && trip.status !== 'cancelled').length,
    vehicles: Array.from(perVehicle, ([id, count]) => ({ id, trips: count })).sort((a, b) => b.trips - a.trips),
  }
}

// How much of the month's completed work is tagged with a driver at all. A
// driver's numbers are only as complete as this.
export function driverTagging(trips: Trip[], start: string, end: string): { completed: number; tagged: number } {
  const done = trips.filter((trip) => trip.status === 'completed' && inRange(trip, start, end))
  return { completed: done.length, tagged: done.filter((trip) => trip.driver_id).length }
}

// Average completed trips per driver who did any, to put one driver in context.
export function averageTripsPerDriver(trips: Trip[], start: string, end: string): number {
  const counts = new Map<string, number>()
  for (const trip of trips) {
    if (trip.status === 'completed' && trip.driver_id && inRange(trip, start, end)) counts.set(trip.driver_id, (counts.get(trip.driver_id) ?? 0) + 1)
  }
  if (counts.size === 0) return 0
  return Array.from(counts.values()).reduce((sum, n) => sum + n, 0) / counts.size
}
