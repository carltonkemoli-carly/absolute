'use client'

import { useState } from 'react'
import { kes, fmtDate } from '@/lib/format'
import DataTable from '@/components/DataTable'
import type { Driver, FuelEntry, Vehicle } from '@/lib/types'
import { saveFuel, deleteFuel } from './actions'

export default function FuelManager({
  entries, vehicles, drivers, defaultDate,
}: { entries: FuelEntry[]; vehicles: Vehicle[]; drivers: Driver[]; defaultDate: string }) {
  const [editing, setEditing] = useState<FuelEntry | 'new' | null>(null)
  const plate = (id: string | null) => vehicles.find((v) => v.id === id)?.plate ?? '—'
  const dname = (id: string | null) => drivers.find((d) => d.id === id)?.name ?? '—'

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn-primary" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} onClick={() => setEditing(editing === 'new' ? null : 'new')}>
          {editing === 'new' ? 'Close' : '+ Log fuel'}
        </button>
      </div>

      {editing && (
        <div className="card animate-fadeup" style={{ padding: 20, marginBottom: 18 }}>
          <form action={async (fd) => { await saveFuel(fd); setEditing(null) }} key={editing === 'new' ? 'new' : editing.id}>
            {editing !== 'new' && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid-form">
              <label className="field"><span>Date *</span>
                <input name="fuel_date" type="date" className="input" required defaultValue={editing === 'new' ? defaultDate : editing.fuel_date} />
              </label>
              <label className="field"><span>Vehicle</span>
                <select name="vehicle_id" className="input" defaultValue={editing === 'new' ? '' : editing.vehicle_id ?? ''}>
                  <option value="">— not sure / any —</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
                </select>
              </label>
              <label className="field"><span>Driver</span>
                <select name="driver_id" className="input" defaultValue={editing === 'new' ? '' : editing.driver_id ?? ''}>
                  <option value="">—</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label className="field"><span>Amount (KES) *</span>
                <input name="amount" type="number" step="1" className="input" required defaultValue={editing === 'new' ? '' : editing.amount} />
              </label>
              <label className="field"><span>Litres</span>
                <input name="litres" type="number" step="0.01" className="input" defaultValue={editing === 'new' ? '' : editing.litres ?? ''} />
              </label>
              <label className="field"><span>Odometer</span>
                <input name="odometer" type="number" className="input" defaultValue={editing === 'new' ? '' : editing.odometer ?? ''} />
              </label>
              <label className="field"><span>Station</span>
                <input name="station" className="input" defaultValue={editing === 'new' ? '' : editing.station ?? ''} placeholder="Shell, Total…" />
              </label>
              <label className="field"><span>M-Pesa ref</span>
                <input name="mpesa_ref" className="input" defaultValue={editing === 'new' ? '' : editing.mpesa_ref ?? ''} placeholder="e.g. SGH4X…" />
              </label>
              <label className="field"><span>Notes</span>
                <input name="notes" className="input" defaultValue={editing === 'new' ? '' : editing.notes ?? ''} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="btn-primary" style={{ padding: '9px 20px', fontSize: 14, cursor: 'pointer' }}>Save</button>
              <button type="button" className="btn-ghost" style={{ padding: '9px 18px', fontSize: 14, cursor: 'pointer' }} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <DataTable rows={entries} rowKey={(f) => f.id} minWidth={760} empty="No fuel is logged for this month." columns={[
        { label: 'Date', nowrap: true, render: (f) => fmtDate(f.fuel_date) },
        { label: 'Station', role: 'primary', render: (f) => <strong>{f.station ?? 'Fuel'}</strong> },
        { label: 'Vehicle', render: (f) => plate(f.vehicle_id) },
        { label: 'Driver', render: (f) => dname(f.driver_id) },
        { label: 'Litres', align: 'right', render: (f) => f.litres ?? '—' },
        { label: 'Odometer', align: 'right', render: (f) => f.odometer ?? '—' },
        { label: 'Amount', align: 'right', render: (f) => <strong>{kes(f.amount)}</strong> },
        { label: '', role: 'actions', render: (f) => (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(f)} style={linkBtn}>Edit</button>
            <form action={deleteFuel} onSubmit={(e) => { if (!confirm('Delete this fuel entry?')) e.preventDefault() }}>
              <input type="hidden" name="id" value={f.id} />
              <button type="submit" style={{ ...linkBtn, color: 'var(--danger)' }}>Delete</button>
            </form>
          </div>
        ) },
      ]} />
    </>
  )
}

const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--accent-mid)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }
