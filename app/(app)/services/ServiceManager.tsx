'use client'

import { useState } from 'react'
import { kes, fmtDate, isoDate } from '@/lib/format'
import DataTable from '@/components/DataTable'
import type { Vehicle, VehicleService } from '@/lib/types'
import { saveService, deleteService } from './actions'

const TYPES = ['Full service', 'Oil & filter', 'Brake pads', 'Tyres', 'Suspension', 'Battery', 'Clutch', 'Bodywork', 'Other']

export default function ServiceManager({ services, vehicles }: { services: VehicleService[]; vehicles: Vehicle[] }) {
  const [editing, setEditing] = useState<VehicleService | 'new' | null>(null)
  const plate = (id: string) => vehicles.find((v) => v.id === id)?.plate ?? '—'

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn-primary" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} onClick={() => setEditing(editing === 'new' ? null : 'new')}>
          {editing === 'new' ? 'Close' : '+ Log service'}
        </button>
      </div>

      {editing && (
        <div className="card animate-fadeup" style={{ padding: 20, marginBottom: 18 }}>
          <form action={async (fd) => { await saveService(fd); setEditing(null) }} key={editing === 'new' ? 'new' : editing.id}>
            {editing !== 'new' && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid-form">
              <label className="field"><span>Vehicle *</span>
                <select name="vehicle_id" className="input" required defaultValue={editing === 'new' ? '' : editing.vehicle_id}>
                  <option value="">—</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
                </select>
              </label>
              <label className="field"><span>Date *</span>
                <input name="service_date" type="date" className="input" required defaultValue={editing === 'new' ? today() : editing.service_date} />
              </label>
              <label className="field"><span>Odometer (km)</span>
                <input name="odometer" type="number" className="input" defaultValue={editing === 'new' ? '' : editing.odometer ?? ''} />
              </label>
              <label className="field"><span>Type</span>
                <select name="service_type" className="input" defaultValue={editing === 'new' ? '' : editing.service_type ?? ''}>
                  <option value="">—</option>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="field" style={{ gridColumn: 'span 2' }}><span>What was changed / done</span>
                <input name="description" className="input" defaultValue={editing === 'new' ? '' : editing.description ?? ''} placeholder="Engine oil, oil filter, air filter…" />
              </label>
              <label className="field"><span>Cost (KES)</span>
                <input name="cost" type="number" step="1" className="input" defaultValue={editing === 'new' ? '' : editing.cost} />
              </label>
              <label className="field"><span>Garage</span>
                <input name="garage" className="input" defaultValue={editing === 'new' ? '' : editing.garage ?? ''} />
              </label>
              <label className="field"><span>Next service date</span>
                <input name="next_service_date" type="date" className="input" defaultValue={editing === 'new' ? '' : editing.next_service_date ?? ''} />
              </label>
              <label className="field"><span>Next service at (km)</span>
                <input name="next_service_odometer" type="number" className="input" defaultValue={editing === 'new' ? '' : editing.next_service_odometer ?? ''} />
              </label>
              <label className="field" style={{ gridColumn: 'span 2' }}><span>Notes</span>
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

      <DataTable rows={services} rowKey={(s) => s.id} minWidth={900} empty="No services are logged yet." columns={[
        { label: 'Date', nowrap: true, render: (s) => fmtDate(s.service_date) },
        { label: 'Vehicle', role: 'primary', render: (s) => <strong>{plate(s.vehicle_id)}</strong> },
        { label: 'Type', render: (s) => s.service_type ?? '—' },
        { label: 'What was done', render: (s) => s.description ?? '—' },
        { label: 'Garage', render: (s) => s.garage ?? '—' },
        { label: 'Odometer', align: 'right', render: (s) => s.odometer?.toLocaleString() ?? '—' },
        { label: 'Cost', align: 'right', render: (s) => <strong>{kes(s.cost)}</strong> },
        { label: 'Next due', nowrap: true, render: (s) => (s.next_service_date ? fmtDate(s.next_service_date) : (s.next_service_odometer ? `${s.next_service_odometer.toLocaleString()} km` : '—')) },
        { label: '', role: 'actions', render: (s) => (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(s)} style={linkBtn}>Edit</button>
            <form action={deleteService} onSubmit={(e) => { if (!confirm('Delete this service record?')) e.preventDefault() }}>
              <input type="hidden" name="id" value={s.id} />
              <button type="submit" style={{ ...linkBtn, color: 'var(--danger)' }}>Delete</button>
            </form>
          </div>
        ) },
      ]} />
    </>
  )
}

function today() { return isoDate(new Date()) }
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--accent-mid)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }
