'use client'

import { useState } from 'react'
import type { Driver, Vehicle } from '@/lib/types'
import { assignTrip } from './actions'

const sel: React.CSSProperties = { flex: 1, minWidth: 120, padding: '8px 10px' }
const btn: React.CSSProperties = { padding: '8px 16px', fontSize: 13, cursor: 'pointer' }

export default function AssignForm({
  tripId, drivers, vehicles, busyDrivers = [], busyVehicles = [],
}: {
  tripId: string
  drivers: Driver[]
  vehicles: Vehicle[]
  busyDrivers?: string[]
  busyVehicles?: string[]
}) {
  const [driverId, setDriverId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [autofilled, setAutofilled] = useState(false)

  const driverBusy = new Set(busyDrivers)
  const vehicleBusy = new Set(busyVehicles)

  function onDriver(id: string) {
    setDriverId(id)
    const d = drivers.find((x) => x.id === id)
    if (d?.default_vehicle_id && vehicles.some((v) => v.id === d.default_vehicle_id) && !vehicleId) {
      setVehicleId(d.default_vehicle_id)
      setAutofilled(true)
    }
  }

  const warnDriver = driverId && driverBusy.has(driverId)
  const warnVehicle = vehicleId && vehicleBusy.has(vehicleId)

  return (
    <form action={assignTrip} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <input type="hidden" name="id" value={tripId} />
      <select name="driver_id" required value={driverId} onChange={(e) => onDriver(e.target.value)} className="input" style={sel}>
        <option value="" disabled>Driver…</option>
        {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}{driverBusy.has(d.id) ? ' · on a job' : ''}</option>)}
      </select>
      <select name="vehicle_id" required value={vehicleId} onChange={(e) => { setVehicleId(e.target.value); setAutofilled(false) }} className="input" style={sel}>
        <option value="" disabled>Vehicle…</option>
        {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}{vehicleBusy.has(v.id) ? ' · on a job' : ''}</option>)}
      </select>
      <button type="submit" className="btn-primary" style={btn}>Assign →</button>
      {(warnDriver || warnVehicle) && (
        <span style={{ fontSize: 11.5, color: 'var(--danger)', width: '100%' }}>
          ⚠ {warnDriver && warnVehicle ? 'This driver and vehicle are' : warnDriver ? 'This driver is' : 'This vehicle is'} already on another job today — double-check before assigning.
        </span>
      )}
      {autofilled && !warnVehicle && <span style={{ fontSize: 11.5, color: 'var(--accent)', width: '100%' }}>↳ auto-filled their usual vehicle — change it if needed</span>}
    </form>
  )
}
