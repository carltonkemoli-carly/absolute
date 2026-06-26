'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui'
import type { Driver, Vehicle } from '@/lib/types'
import { saveDriver, deleteDriver } from './actions'

export default function DriverManager({ drivers, vehicles }: { drivers: Driver[]; vehicles: Vehicle[] }) {
  const [editing, setEditing] = useState<Driver | 'new' | null>(null)
  const plateOf = (id: string | null) => vehicles.find((v) => v.id === id)?.plate ?? '—'

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn-primary" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} onClick={() => setEditing('new')}>
          + Add driver
        </button>
      </div>

      {editing && (
        <div className="card animate-fadeup" style={{ padding: 20, marginBottom: 18 }}>
          <form action={async (fd) => { await saveDriver(fd); setEditing(null) }}>
            {editing !== 'new' && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid-form">
              <label className="field"><span>Name *</span>
                <input name="name" className="input" required defaultValue={editing === 'new' ? '' : editing.name} />
              </label>
              <label className="field"><span>Phone</span>
                <input name="phone" className="input" defaultValue={editing === 'new' ? '' : editing.phone ?? ''} placeholder="0712 345 678" />
              </label>
              <label className="field"><span>License no.</span>
                <input name="license_no" className="input" defaultValue={editing === 'new' ? '' : editing.license_no ?? ''} />
              </label>
              <label className="field"><span>Default vehicle</span>
                <select name="default_vehicle_id" className="input" defaultValue={editing === 'new' ? '' : editing.default_vehicle_id ?? ''}>
                  <option value="">—</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}{v.model ? ` · ${v.model}` : ''}</option>)}
                </select>
              </label>
              <label className="field"><span>Status</span>
                <select name="status" className="input" defaultValue={editing === 'new' ? 'active' : editing.status}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 680 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <Th>Name</Th><Th>Phone</Th><Th>License</Th><Th>Default vehicle</Th><Th>Status</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {drivers.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 28, textAlign: 'center', color: 'var(--ink3)' }}>No drivers yet.</td></tr>
            )}
            {drivers.map((d) => (
              <tr key={d.id} style={{ borderTop: '1px solid var(--border)' }}>
                <Td><strong>{d.name}</strong></Td>
                <Td>{d.phone ?? '—'}</Td>
                <Td>{d.license_no ?? '—'}</Td>
                <Td>{plateOf(d.default_vehicle_id)}</Td>
                <Td><Badge tone={d.status === 'active' ? 'green' : 'neutral'}>{d.status}</Badge></Td>
                <Td>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditing(d)} style={linkBtn}>Edit</button>
                    <form action={deleteDriver} onSubmit={(e) => { if (!confirm(`Delete ${d.name}?`)) e.preventDefault() }}>
                      <input type="hidden" name="id" value={d.id} />
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
