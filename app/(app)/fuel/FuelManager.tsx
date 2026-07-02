'use client'

import { useState } from 'react'
import { kes, fmtDate } from '@/lib/format'
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

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <Th>Date</Th><Th>Vehicle</Th><Th>Driver</Th><Th>Station</Th><Th right>Litres</Th><Th right>Odometer</Th><Th right>Amount</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 28, textAlign: 'center', color: 'var(--ink3)' }}>No fuel logged this month.</td></tr>
            )}
            {entries.map((f) => (
              <tr key={f.id} style={{ borderTop: '1px solid var(--border)' }}>
                <Td>{fmtDate(f.fuel_date)}</Td>
                <Td><strong>{plate(f.vehicle_id)}</strong></Td>
                <Td>{dname(f.driver_id)}</Td>
                <Td>{f.station ?? '—'}</Td>
                <Td right>{f.litres ?? '—'}</Td>
                <Td right>{f.odometer ?? '—'}</Td>
                <Td right><strong>{kes(f.amount)}</strong></Td>
                <Td>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditing(f)} style={linkBtn}>Edit</button>
                    <form action={deleteFuel} onSubmit={(e) => { if (!confirm('Delete this fuel entry?')) e.preventDefault() }}>
                      <input type="hidden" name="id" value={f.id} />
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
function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: right ? 'right' : 'left' }}>{children}</th>
}
function Td({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <td style={{ padding: '11px 14px', textAlign: right ? 'right' : 'left' }}>{children}</td>
}
