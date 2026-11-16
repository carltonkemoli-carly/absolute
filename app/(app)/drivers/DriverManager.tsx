'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui'
import { kes } from '@/lib/format'
import DataTable from '@/components/DataTable'
import type { Driver, Vehicle } from '@/lib/types'
import { saveDriver, deleteDriver } from './actions'

export default function DriverManager({ drivers, vehicles, canFinance }: { drivers: Driver[]; vehicles: Vehicle[]; canFinance: boolean }) {
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
              {canFinance && (
                <label className="field"><span>Monthly wage (KES)</span>
                  <input name="monthly_wage" type="number" step="500" min="0" className="input" defaultValue={editing === 'new' ? '' : editing.monthly_wage || ''} placeholder="e.g. 28000" />
                </label>
              )}
              <label className="field"><span>Status</span>
                <select name="status" className="input" defaultValue={editing === 'new' ? 'active' : editing.status}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            {canFinance && <p style={{ fontSize: 12, color: 'var(--ink3)', margin: '10px 0 0' }}>Wage is used by the Expenses page&rsquo;s &ldquo;Post this month&rsquo;s wages&rdquo; button.</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="btn-primary" style={{ padding: '9px 18px', fontSize: 14, cursor: 'pointer' }}>Save</button>
              <button type="button" className="btn-ghost" style={{ padding: '9px 18px', fontSize: 14, cursor: 'pointer' }} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <DataTable rows={drivers} rowKey={(d) => d.id} minWidth={680} empty="No drivers yet." columns={[
        { label: 'Name', role: 'primary', render: (d: Driver) => <strong>{d.name}</strong> },
        { label: 'Phone', render: (d: Driver) => d.phone ?? '—' },
        { label: 'Licence', render: (d: Driver) => d.license_no ?? '—' },
        { label: 'Usual vehicle', render: (d: Driver) => plateOf(d.default_vehicle_id) },
        ...(canFinance ? [{ label: 'Monthly wage', align: 'right' as const, render: (d: Driver) => (d.monthly_wage > 0 ? kes(d.monthly_wage) : <span style={{ color: 'var(--ink3)' }}>—</span>) }] : []),
        { label: 'Status', render: (d: Driver) => <Badge tone={d.status === 'active' ? 'green' : 'neutral'}>{d.status}</Badge> },
        { label: '', role: 'actions', render: (d: Driver) => (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(d)} style={linkBtn}>Edit</button>
            <form action={deleteDriver} onSubmit={(e) => { if (!confirm(`Delete ${d.name}?`)) e.preventDefault() }}>
              <input type="hidden" name="id" value={d.id} />
              <button type="submit" style={{ ...linkBtn, color: 'var(--danger)' }}>Delete</button>
            </form>
          </div>
        ) },
      ]} />
    </>
  )
}

const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--accent-mid)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }
