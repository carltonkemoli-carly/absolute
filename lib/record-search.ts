import type { ComplianceDoc, Contractor, Driver, Invoice, Organization, Route, Trip, Vehicle } from '@/lib/types'

export type RecordSearchSource = {
  trips: Trip[]; vehicles: Vehicle[]; drivers: Driver[]; organizations: Organization[]; contractors: Contractor[]; routes: Route[]; invoices?: Invoice[]
}
export type RecordSearchItem = { id: string; title: string; summary: string; href: string; badge?: string }
export type RecordSearchGroup = { key: string; label: string; total: number; items: RecordSearchItem[] }
export function normalizedRecordQuery(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
export function shiftCalendarDay(value: string, offset: number): string {
  const [year, month, day] = value.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + offset))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`
}
export function tripMonthHref(date: string): string {
  const [year, month] = date.split('-').map(Number)
  return `/trips?y=${year}&m=${month - 1}`
}
export function searchRecords(query: string, source: RecordSearchSource, allowFinance: boolean, limit = 20): RecordSearchGroup[] {
  if (query.trim().length < 2 || query.trim().length > 100) return []
  const tokens = normalizedRecordQuery(query).split(' ').filter(Boolean)
  if (!tokens.length) return []
  const cap = Math.max(1, Math.min(20, Math.trunc(limit) || 20))
  const driverNames = new Map(source.drivers.map(driver => [driver.id, driver.name]))
  const vehicleNames = new Map(source.vehicles.map(vehicle => [vehicle.id, vehicle.plate]))
  const organizationNames = new Map(source.organizations.map(organization => [organization.id, organization.name]))
  const contractorNames = new Map(source.contractors.map(contractor => [contractor.id, contractor.name]))
  const match = (fields: (string | null | undefined)[]) => {
    const searchable = normalizedRecordQuery(fields.filter(Boolean).join(' '))
    return tokens.every(token => searchable.includes(token))
  }
  const group = <T,>(key: string, label: string, records: T[], fields: (record: T) => (string | null | undefined)[], result: (record: T) => RecordSearchItem): RecordSearchGroup => {
    const found = records.filter(record => match(fields(record)))
    return { key, label, total: found.length, items: found.slice(0, cap).map(result) }
  }
  const groups: RecordSearchGroup[] = [
    group('trips', 'Trips · last 90 days', [...source.trips].sort((a, b) => b.trip_date.localeCompare(a.trip_date)), trip => [trip.client_name, trip.slip_no, trip.voucher_no, trip.flight_no, trip.pickup, trip.dropoff, trip.organization_id ? organizationNames.get(trip.organization_id) : '', trip.contractor_id ? contractorNames.get(trip.contractor_id) : '', trip.driver_id ? driverNames.get(trip.driver_id) : '', trip.vehicle_id ? vehicleNames.get(trip.vehicle_id) : ''], trip => ({ id: trip.id, title: trip.client_name, summary: [trip.trip_date, trip.pickup || 'Pickup to confirm', trip.dropoff || 'Destination to confirm', trip.slip_no ? `Slip ${trip.slip_no}` : ''].filter(Boolean).join(' · '), href: tripMonthHref(trip.trip_date), badge: trip.status })),
    group('vehicles', 'Vehicles', source.vehicles, vehicle => [vehicle.plate, vehicle.plate.replace(/[^a-z0-9]/gi, ''), vehicle.model, vehicle.vehicle_type, vehicle.owner_name], vehicle => ({ id: vehicle.id, title: vehicle.plate, summary: [vehicle.model, vehicle.vehicle_type].filter(Boolean).join(' · ') || 'Vehicle record', href: `/vehicles/${encodeURIComponent(vehicle.id)}`, badge: vehicle.status })),
    group('drivers', 'Drivers', source.drivers, driver => [driver.name, driver.phone, driver.phone?.replace(/\D/g, ''), driver.license_no], driver => ({ id: driver.id, title: driver.name, summary: [driver.phone, driver.default_vehicle_id ? vehicleNames.get(driver.default_vehicle_id) : 'No default vehicle'].filter(Boolean).join(' · '), href: '/drivers', badge: driver.status })),
    group('routes', 'Routes', source.routes, route => [route.pickup, route.dropoff], route => ({ id: route.id, title: `${route.pickup} → ${route.dropoff}`, summary: route.distance_km ? `${route.distance_km} km recorded` : 'Route and rate-card record', href: '/routes', badge: route.active ? 'active' : 'inactive' })),
  ]
  if (allowFinance) {
    groups.push(group('clients', 'Client organizations', source.organizations, organization => [organization.name, organization.contractor_id ? contractorNames.get(organization.contractor_id) : ''], organization => ({ id: organization.id, title: organization.name, summary: organization.contractor_id ? contractorNames.get(organization.contractor_id) || 'Client organization' : 'Client organization', href: `/clients/${encodeURIComponent(organization.id)}`, badge: organization.active ? 'active' : 'inactive' })))
    groups.push(group('contractors', 'Contractors', source.contractors, contractor => [contractor.name, contractor.code], contractor => ({ id: contractor.id, title: contractor.name, summary: contractor.code || 'Transport contractor', href: '/suppliers', badge: contractor.active ? 'active' : 'inactive' })))
    groups.push(group('invoices', 'Invoices', source.invoices ?? [], invoice => [invoice.invoice_no, invoice.period_label, invoice.contractor_id ? contractorNames.get(invoice.contractor_id) : ''], invoice => ({ id: invoice.id, title: invoice.invoice_no || 'Invoice without a number', summary: [invoice.contractor_id ? contractorNames.get(invoice.contractor_id) : 'Contractor not recorded', invoice.period_label, invoice.due_date ? `Due ${invoice.due_date}` : 'No due date'].filter(Boolean).join(' · '), href: `/receivables/${encodeURIComponent(invoice.id)}`, badge: Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid)) === 0 ? 'paid' : 'outstanding' })))
  }
  return groups.filter(result => result.total > 0)
}

export function deriveAttention(trips: Trip[], documents: ComplianceDoc[], invoices: Invoice[], today: string, allowFinance: boolean) {
  const lastDay = shiftCalendarDay(today, 6)
  return {
    missingAssignments: trips.filter(trip => trip.trip_date >= today && trip.trip_date <= lastDay && !['completed', 'cancelled'].includes(trip.status) && (!trip.driver_id || !trip.vehicle_id))
      .sort((a, b) => a.trip_date.localeCompare(b.trip_date) || (a.pickup_time || '99:99').localeCompare(b.pickup_time || '99:99')),
    expiredDocuments: documents.filter(document => document.expiry_date && /^\d{4}-\d{2}-\d{2}$/.test(document.expiry_date) && document.expiry_date < today)
      .sort((a, b) => (a.expiry_date || '').localeCompare(b.expiry_date || '')),
    overdueInvoices: allowFinance ? invoices.filter(invoice => invoice.due_date && invoice.due_date < today && Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid)) > 0)
      .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')) : [],
  }
}
