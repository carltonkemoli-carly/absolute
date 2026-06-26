import { PageHeader } from '@/components/ui'
import MonthNav from '@/components/MonthNav'
import { listTrips, listContractors, listOrganizations, listVehicles, listDrivers } from '@/lib/db'
import { monthRange, resolvePeriod, isoDate, kes } from '@/lib/format'
import ExcelImport from '@/components/ExcelImport'
import type { FieldSpec } from '@/lib/import-types'
import TripManager from './TripManager'
import { importTrips } from './import-actions'

const TRIP_SPEC: FieldSpec[] = [
  { key: 'trip_date', label: 'Date', keywords: ['date'], required: true },
  { key: 'client_name', label: 'Client', keywords: ['client', 'name', 'passenger'], required: true },
  { key: 'slip_no', label: 'Slip / Ticket', keywords: ['slip', 'ticket'] },
  { key: 'pickup', label: 'From', keywords: ['from', 'pickup'] },
  { key: 'dropoff', label: 'To', keywords: ['to', 'dropoff'] },
  { key: 'express_charges', label: 'Express charges', keywords: ['express'] },
  { key: 'voucher_no', label: 'Voucher', keywords: ['voucher'] },
  { key: 'organization', label: 'Organization', keywords: ['organization', 'organisation', 'org'] },
  { key: 'contractor', label: 'Company / Contractor', keywords: ['company', 'contractor'] },
  { key: 'amount', label: 'Amount', keywords: ['amount', 'fare', 'total', 'cost'] },
  { key: 'notes', label: 'Notes', keywords: ['note', 'remark'] },
]

export default async function TripsPage({
  searchParams,
}: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const sp = await searchParams
  const { year, month } = resolvePeriod(sp.y, sp.m)
  const { start, end } = monthRange(year, month)
  const today = isoDate(new Date())
  const defaultDate = today >= start && today <= end ? today : start

  const [rows, contractors, organizations, vehicles, drivers] = await Promise.all([
    listTrips(start, end), listContractors(), listOrganizations(), listVehicles(), listDrivers(),
  ])
  const total = rows.reduce((s, t) => s + Number(t.amount), 0)
  const expressTotal = rows.reduce((s, t) => s + Number(t.express_charges), 0)
  const netTotal = total - expressTotal

  return (
    <>
      <PageHeader
        title="Trips"
        subtitle={`${rows.length} trip${rows.length === 1 ? '' : 's'} · ${kes(total)} billed · ${kes(netTotal)} net fare · ${kes(expressTotal)} expressway`}
        action={<MonthNav year={year} month={month} />}
      />
      <div style={{ marginBottom: 14 }}>
        <ExcelImport
          label="Import trips from Excel (BCD / FCM / any)"
          spec={TRIP_SPEC}
          importAction={importTrips}
          hint="Upload a contractor's trip sheet (.xlsx or .csv). New trips arrive as bookings — assign drivers in Dispatch. Title/blank rows above the headers are handled automatically."
        />
      </div>
      <TripManager
        trips={rows}
        defaultDate={defaultDate}
        lookups={{ contractors, organizations, vehicles, drivers }}
      />
    </>
  )
}
