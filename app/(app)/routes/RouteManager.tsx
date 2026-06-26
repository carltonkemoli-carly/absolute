'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Badge } from '@/components/ui'
import { kes } from '@/lib/format'
import type { Route } from '@/lib/types'
import { saveRoute, deleteRoute } from './actions'

function mapsUrl(pickup: string, dropoff: string): string {
  const o = encodeURIComponent(pickup + ', Nairobi, Kenya')
  const d = encodeURIComponent(dropoff + ', Nairobi, Kenya')
  return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}`
}
function perKm(price: number, km: number | null): string {
  if (!km || km <= 0) return ''
  return `${Math.round(price / km)}/km`
}

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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 880 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <Th>Route</Th><Th right>Distance</Th><Th right>Saloon</Th><Th right>Wagon</Th><Th right>Van</Th><Th right>Coaster</Th><Th>Map</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {routes.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 28, textAlign: 'center', color: 'var(--ink3)' }}>No routes yet. Add your common routes and prices.</td></tr>
            )}
            {routes.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                <Td>
                  <strong>{r.pickup} → {r.dropoff}</strong>
                  {!r.active && <span style={{ marginLeft: 8 }}><Badge>inactive</Badge></span>}
                </Td>
                <Td right>{r.distance_km ? `${r.distance_km} km` : '—'}{r.duration_min ? <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{r.duration_min} min</div> : null}</Td>
                <PriceCell price={r.price_saloon} km={r.distance_km} />
                <PriceCell price={r.price_wagon} km={r.distance_km} />
                <PriceCell price={r.price_van} km={r.distance_km} />
                <PriceCell price={r.price_bus} km={r.distance_km} />
                <Td>
                  <a href={mapsUrl(r.pickup, r.dropoff)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-mid)', fontWeight: 600, fontSize: 13 }}>Open ↗</a>
                </Td>
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
      <p style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 10 }}>
        “/km” shows price per kilometre — a quick check that each route is priced consistently. “Open ↗” shows the route in Google Maps.
      </p>
    </>
  )
}

function PriceCell({ price, km }: { price: number; km: number | null }) {
  return (
    <Td right>
      {kes(price)}
      {km ? <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{perKm(price, km)}</div> : null}
    </Td>
  )
}

function RouteForm({ route, onDone }: { route: Route | null; onDone: () => void }) {
  const [pickup, setPickup] = useState(route?.pickup ?? '')
  const [dropoff, setDropoff] = useState(route?.dropoff ?? '')
  const [distance, setDistance] = useState(route?.distance_km != null ? String(route.distance_km) : '')
  const [duration, setDuration] = useState(route?.duration_min != null ? String(route.duration_min) : '')
  const [calcing, setCalcing] = useState(false)

  async function calculate() {
    if (!pickup || !dropoff) { toast.error('Enter From and To first.'); return }
    setCalcing(true)
    try {
      const res = await fetch(`/api/route-distance?origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(dropoff)}`)
      const data = await res.json()
      if ('error' in data) {
        toast.error(data.error === 'no_key'
          ? 'Google Maps isn’t connected yet — enter the distance manually for now.'
          : data.error)
      } else {
        setDistance(String(data.km)); setDuration(String(data.min))
        toast.success(`${data.km} km · ${data.min} min from Google Maps`)
      }
    } catch {
      toast.error('Could not calculate distance.')
    } finally {
      setCalcing(false)
    }
  }

  return (
    <div className="card animate-fadeup" style={{ padding: 20, marginBottom: 18 }}>
      <form action={async (fd) => { await saveRoute(fd); onDone() }}>
        {route && <input type="hidden" name="id" value={route.id} />}
        <div className="grid-form">
          <label className="field"><span>From *</span>
            <input name="pickup" className="input" required value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Westlands" />
          </label>
          <label className="field"><span>To *</span>
            <input name="dropoff" className="input" required value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="JKIA" />
          </label>
          <label className="field"><span>Distance (km)</span>
            <input name="distance_km" type="number" step="0.1" className="input" value={distance} onChange={(e) => setDistance(e.target.value)} />
          </label>
          <label className="field"><span>Duration (min)</span>
            <input name="duration_min" type="number" className="input" value={duration} onChange={(e) => setDuration(e.target.value)} />
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
          <button type="button" className="btn-ghost" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} onClick={calculate} disabled={calcing}>
            {calcing ? 'Calculating…' : '🗺 Distance from Google Maps'}
          </button>
          <a href={pickup && dropoff ? mapsUrl(pickup, dropoff) : '#'} target="_blank" rel="noopener noreferrer"
            className="btn-ghost" style={{ padding: '9px 16px', fontSize: 14, display: 'inline-flex', alignItems: 'center', opacity: pickup && dropoff ? 1 : 0.5 }}>
            Preview route ↗
          </a>
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
