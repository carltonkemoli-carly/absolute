'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui'
import { kes } from '@/lib/format'
import type { Route } from '@/lib/types'
import { saveRoute, deleteRoute } from './actions'

export default function RouteManager({ routes }: { routes: Route[] }) {
  const [editing, setEditing] = useState<Route | 'new' | null>(null)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn-primary" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} onClick={() => setEditing(editing === 'new' ? null : 'new')}>
          {editing === 'new' ? 'Close' : '+ Add route'}
        </button>
      </div>

      {editing && <RouteForm key={editing === 'new' ? 'new' : editing.id} route={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 640 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <Th>Route</Th><Th right>Saloon</Th><Th right>Wagon</Th><Th right>Van</Th><Th right>Coaster</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {routes.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 28, textAlign: 'center', color: 'var(--ink3)' }}>No routes yet. Add your common routes and prices.</td></tr>
            )}
            {routes.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                <Td>
                  <strong>{r.pickup} → {r.dropoff}</strong>
                  {!r.active && <span style={{ marginLeft: 8 }}><Badge>inactive</Badge></span>}
                </Td>
                <Td right>{kes(r.price_saloon)}</Td>
                <Td right>{kes(r.price_wagon)}</Td>
                <Td right>{kes(r.price_van)}</Td>
                <Td right>{kes(r.price_bus)}</Td>
                <Td>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditing(r)} style={linkBtn}>Edit</button>
                    <form action={deleteRoute} onSubmit={(e) => { if (!confirm(`Delete ${r.pickup} → ${r.dropoff}?`)) e.preventDefault() }}>
                      <input type="hidden" name="id" value={r.id} />
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

function RouteForm({ route, onDone }: { route: Route | null; onDone: () => void }) {
  return (
    <div className="card animate-fadeup" style={{ padding: 20, marginBottom: 18 }}>
      <form action={async (fd) => { await saveRoute(fd); onDone() }}>
        {route && <input type="hidden" name="id" value={route.id} />}
        <div className="grid-form">
          <label className="field"><span>From *</span>
            <input name="pickup" className="input" required defaultValue={route?.pickup ?? ''} placeholder="Westlands" />
          </label>
          <label className="field"><span>To *</span>
            <input name="dropoff" className="input" required defaultValue={route?.dropoff ?? ''} placeholder="JKIA" />
          </label>
          <label className="field"><span>Saloon (Sedan) KES</span>
            <input name="price_saloon" type="number" step="1" className="input" defaultValue={route?.price_saloon ?? ''} />
          </label>
          <label className="field"><span>Wagon KES</span>
            <input name="price_wagon" type="number" step="1" className="input" defaultValue={route?.price_wagon ?? ''} />
          </label>
          <label className="field"><span>Van KES</span>
            <input name="price_van" type="number" step="1" className="input" defaultValue={route?.price_van ?? ''} />
          </label>
          <label className="field"><span>Coaster / Bus KES</span>
            <input name="price_bus" type="number" step="1" className="input" defaultValue={route?.price_bus ?? ''} />
          </label>
          <label className="field" style={{ gridColumn: 'span 2' }}><span>Notes</span>
            <input name="notes" className="input" defaultValue={route?.notes ?? ''} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, alignSelf: 'end', paddingBottom: 9 }}>
            <input name="active" type="checkbox" defaultChecked={route ? route.active : true} /> Active
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button type="submit" className="btn-primary" style={{ padding: '9px 20px', fontSize: 14, cursor: 'pointer' }}>Save</button>
          <button type="button" className="btn-ghost" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} onClick={onDone}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--accent-mid)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }
function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: right ? 'right' : 'left' }}>{children}</th>
}
function Td({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <td style={{ padding: '11px 14px', textAlign: right ? 'right' : 'left', verticalAlign: 'top' }}>{children}</td>
}
