'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui'
import { OWNERSHIP_LABELS, type Vehicle } from '@/lib/types'
import { saveVehicle, deleteVehicle } from './actions'

const MODELS = ['Toyota Noah', 'Toyota Hiace', 'Toyota Fielder', 'Toyota Alphard', 'Toyota Axio', 'Toyota Coaster']
const TYPES = ['Saloon', 'Wagon', 'Van', 'Bus']
const STATUS_TONE = { active: 'green', in_shop: 'gold', retired: 'red' } as const

export default function VehicleManager({ vehicles }: { vehicles: Vehicle[] }) {
  const [editing, setEditing] = useState<Vehicle | 'new' | null>(null)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn-primary" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} onClick={() => setEditing('new')}>
          + Add vehicle
        </button>
      </div>

      {editing && (
        <div className="card animate-fadeup" style={{ padding: 20, marginBottom: 18 }}>
          <form action={async (fd) => { await saveVehicle(fd); setEditing(null) }}>
            {editing !== 'new' && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid-form">
              <label className="field"><span>Plate *</span>
                <input name="plate" className="input" required defaultValue={editing === 'new' ? '' : editing.plate} placeholder="KCD 196X" />
              </label>
              <label className="field"><span>Model</span>
                <input name="model" className="input" list="models" defaultValue={editing === 'new' ? '' : editing.model ?? ''} placeholder="Toyota Noah" />
                <datalist id="models">{MODELS.map((m) => <option key={m} value={m} />)}</datalist>
              </label>
              <label className="field"><span>Type</span>
                <select name="vehicle_type" className="input" defaultValue={editing === 'new' ? '' : editing.vehicle_type ?? ''}>
                  <option value="">—</option>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="field"><span>Capacity</span>
                <input name="capacity" type="number" className="input" defaultValue={editing === 'new' ? '' : editing.capacity ?? ''} placeholder="7" />
              </label>
              <label className="field"><span>Status</span>
                <select name="status" className="input" defaultValue={editing === 'new' ? 'active' : editing.status}>
                  <option value="active">Active</option>
                  <option value="in_shop">In shop</option>
                  <option value="retired">Retired</option>
                </select>
              </label>
              <label className="field"><span>Ownership</span>
                <select name="ownership" className="input" defaultValue={editing === 'new' ? 'owned' : editing.ownership}>
                  <option value="owned">Owned</option>
                  <option value="monthly_hire">Monthly hire</option>
                  <option value="casual_hire">Casual hire (per trip)</option>
                </select>
              </label>
              <label className="field"><span>Owner (if hired)</span>
                <input name="owner_name" className="input" defaultValue={editing === 'new' ? '' : editing.owner_name ?? ''} placeholder="Vehicle owner's name" />
              </label>
              <label className="field"><span>Monthly fee (KES, if monthly hire)</span>
                <input name="monthly_fee" type="number" step="1" className="input" defaultValue={editing === 'new' ? '' : editing.monthly_fee || ''} />
              </label>
              <label className="field"><span>Notes</span>
                <input name="notes" className="input" defaultValue={editing === 'new' ? '' : editing.notes ?? ''} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="btn-primary" style={{ padding: '9px 18px', fontSize: 14, cursor: 'pointer' }}>Save</button>
              <button type="button" className="btn-ghost" style={{ padding: '9px 18px', fontSize: 14, cursor: 'pointer' }} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 760 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <Th>Plate</Th><Th>Model</Th><Th>Type</Th><Th>Ownership</Th><Th>Status</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {vehicles.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 28, textAlign: 'center', color: 'var(--ink3)' }}>No vehicles yet.</td></tr>
            )}
            {vehicles.map((v) => (
              <tr key={v.id} style={{ borderTop: '1px solid var(--border)' }}>
                <Td><strong>{v.plate}</strong></Td>
                <Td>{v.model ?? '—'}</Td>
                <Td>{v.vehicle_type ?? '—'}</Td>
                <Td>
                  <Badge tone={v.ownership === 'owned' ? 'green' : 'gold'}>{OWNERSHIP_LABELS[v.ownership]}</Badge>
                  {v.ownership === 'monthly_hire' && <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{v.owner_name ?? ''} · {v.monthly_fee ? `KES ${v.monthly_fee.toLocaleString()}/mo` : ''}</div>}
                  {v.ownership === 'casual_hire' && v.owner_name && <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{v.owner_name}</div>}
                </Td>
                <Td><Badge tone={STATUS_TONE[v.status]}>{v.status.replace('_', ' ')}</Badge></Td>
                <Td>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditing(v)} style={linkBtn}>Edit</button>
                    <form action={deleteVehicle} onSubmit={(e) => { if (!confirm(`Delete ${v.plate}?`)) e.preventDefault() }}>
                      <input type="hidden" name="id" value={v.id} />
                      <button type="submit" style={{ ...linkBtn, color: 'var(--danger)' }}>Delete</button>
                    </form>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--accent-mid)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }
function Th({ children }: { children?: React.ReactNode }) {
  return <th style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</th>
}
function Td({ children }: { children?: React.ReactNode }) {
  return <td style={{ padding: '11px 16px' }}>{children}</td>
}
