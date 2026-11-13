import type { Contractor, Driver, Trip, Vehicle } from './types'
import { TRIP_STATUS_LABELS, type TripFilterState } from './trip-filters'

export type SavedTripFilters = Omit<TripFilterState, 'query'>
export type SavedTripView = { id: string; name: string; filters: SavedTripFilters }
const FILTER_KEYS = ['status', 'contractorId', 'driverId', 'vehicleId', 'assignment'] as const
const VIEW_KEYS = ['id', 'name', 'filters']
const MAX_VIEWS = 8
function plainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every(key => keys.includes(key))
}
function identifier(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 128 && !/[\u0000-\u001f\u007f]/.test(value)
}
export function savedTripFilters(filters: TripFilterState): SavedTripFilters {
  // Search may contain a passenger/client name. It is deliberately never saved.
  return { status: filters.status, contractorId: filters.contractorId, driverId: filters.driverId, vehicleId: filters.vehicleId, assignment: filters.assignment }
}
export function sameSavedTripFilters(a: SavedTripFilters, b: SavedTripFilters): boolean {
  return FILTER_KEYS.every(key => a[key] === b[key])
}
export function validSavedTripView(value: unknown): value is SavedTripView {
  if (!plainObject(value) || !exactKeys(value, VIEW_KEYS)) return false
  if (typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value.id)) return false
  if (typeof value.name !== 'string' || value.name.trim().length < 1 || value.name.length > 40 || /[\u0000-\u001f\u007f]/.test(value.name)) return false
  if (!plainObject(value.filters) || !exactKeys(value.filters, FILTER_KEYS)) return false
  const filters = value.filters
  if (typeof filters.status !== 'string' || (filters.status !== '' && !Object.prototype.hasOwnProperty.call(TRIP_STATUS_LABELS, filters.status))) return false
  if (!['all', 'assigned', 'unassigned'].includes(String(filters.assignment))) return false
  return identifier(filters.contractorId) && identifier(filters.driverId) && identifier(filters.vehicleId)
}
export function decodeSavedTripViews(raw: string | null): { views: SavedTripView[]; invalid: boolean } {
  if (raw === null) return { views: [], invalid: false }
  if (raw.length > 20000) return { views: [], invalid: true }
  try {
    const value: unknown = JSON.parse(raw)
    if (!plainObject(value) || !exactKeys(value, ['version', 'views']) || value.version !== 1 || !Array.isArray(value.views) || value.views.length > MAX_VIEWS || !value.views.every(validSavedTripView)) return { views: [], invalid: true }
    const ids = value.views.map(view => view.id)
    if (new Set(ids).size !== ids.length) return { views: [], invalid: true }
    return { views: value.views, invalid: false }
  } catch { return { views: [], invalid: true } }
}
export function encodeSavedTripViews(views: SavedTripView[]): string {
  if (views.length > MAX_VIEWS || !views.every(validSavedTripView) || new Set(views.map(view => view.id)).size !== views.length) throw new Error('Saved views could not be stored.')
  return JSON.stringify({ version: 1, views })
}

// Quote every cell and protect text that spreadsheet software could execute as
// a formula, including values with a whitespace/control-character prefix.
export function tripCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  const protectedText = /^[\s\u0000-\u001f]*[=+\-@]/u.test(text) ? `'${text}` : text
  return `"${protectedText.replace(/"/g, '""')}"`
}
export function exportTripsCsv(trips: readonly Trip[], lookups: { contractors: readonly Contractor[]; drivers: readonly Driver[]; vehicles: readonly Vehicle[] }): string {
  const contractorNames = new Map(lookups.contractors.map(item => [item.id, item.name]))
  const driverNames = new Map(lookups.drivers.map(item => [item.id, item.name]))
  const vehiclePlates = new Map(lookups.vehicles.map(item => [item.id, item.plate]))
  const records: unknown[][] = [['Trip date', 'Client', 'Pickup', 'Drop-off', 'Contractor', 'Driver', 'Vehicle', 'Status', 'Amount (KES)']]
  for (const trip of trips) records.push([
    trip.trip_date, trip.client_name, trip.pickup, trip.dropoff,
    contractorNames.get(trip.contractor_id ?? '') ?? '', driverNames.get(trip.driver_id ?? '') ?? '', vehiclePlates.get(trip.vehicle_id ?? '') ?? '',
    TRIP_STATUS_LABELS[trip.status], Number.isFinite(Number(trip.amount)) ? Number(trip.amount) : '',
  ])
  return records.map(record => record.map(tripCsvCell).join(',')).join('\r\n') + '\r\n'
}
