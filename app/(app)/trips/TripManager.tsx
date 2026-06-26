'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui'
import { kes, fmtDate } from '@/lib/format'
import type { Contractor, Driver, Organization, Trip, Vehicle } from '@/lib/types'
import { saveTrip, deleteTrip } from './actions'

type Lookups = {
  contractors: Contractor[]
  organizations: Organization[]
  vehicles: Vehicle[]
  drivers: Driver[]
}

export default function TripManager({
  trips, lookups, defaultDate,
}: { trips: Trip[]; lookups: Lookups; defaultDate: string }) {
  const [editing, setEditing] = useState<Trip | 'new' | null>(null)
  const [q, setQ] = useState('')

  const { contractors, organizations, vehicles, drivers } = lookups
  const name = (arr: { id: string; name?: string; plate?: string }[], id: string | null) => {
    const f = arr.find((x) => x.id === id)
    return f ? (f.name ?? f.plate ?? '—') : '—'
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return trips
    return trips.filter((t) =>
      [t.client_name, t.slip_no, t.voucher_no, t.pickup, t.dropoff,
       name(organizations, t.organization_id), name(vehicles, t.vehicle_id)]
        .filter(Boolean).join(' ').toLowerCase().includes(s))
  }, [q, trips, organizations, vehicles])

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input className="input" placeholder="Search client, slip, voucher, route…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 360 }} />
        <div style={{ flex: 1 }} />
        <button className="btn-primary" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => setEditing(editing === 'new' ? null : 'new')}>
          {editing === 'new' ? 'Close' : '+ Log trip'}
        </button>
      </div>

      {editing && (
        <TripForm
          key={editing === 'new' ? 'new' : editing.id}
          trip={editing === 'new' ? null : editing}
          lookups={lookups}
          defaultDate={defaultDate}
          onDone={() => setEditing(null)}
        />
      )}

      <div className="card" style={{ overflowX: 'auto' }} >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 980 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <Th>Date</Th><Th>Client</Th><Th>Route</Th><Th>Organization</Th><Th>Via</Th>
              <Th>Vehicle</Th><Th>Driver</Th><Th right>Express</Th><Th right>Amount</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 28, textAlign: 'center', color: 'var(--ink3)' }}>No trips for this month.</td></tr>
            )}
            {filtered.map((t) => {
              const isNew = isRecent(t.created_at)
              return (
              <tr key={t.id} className={isNew ? 'row-new' : undefined} style={{ borderTop: '1px solid var(--border)' }}>
                <Td>{fmtDate(t.trip_date)}</Td>
                <Td>
                  <strong>{t.client_name}</strong>
                  {isNew && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: 'var(--gold)', background: 'var(--gold-light)', padding: '1px 6px', borderRadius: 99, verticalAlign: 'middle' }}>NEW</span>}
                  {t.slip_no && <div style={{ fontSize: 12, color: 'var(--ink3)' }}>#{t.slip_no}</div>}
                </Td>
                <Td>{(t.pickup || '—')} → {(t.dropoff || '—')}{t.notes && <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{t.notes}</div>}</Td>
                <Td>{name(organizations, t.organization_id)}</Td>
                <Td>{name(contractors, t.contractor_id)}</Td>
                <Td>{name(vehicles, t.vehicle_id)}</Td>
                <Td>{name(drivers, t.driver_id)}</Td>
                <Td right>{t.express_charges ? kes(t.express_charges) : '—'}</Td>
                <Td right>
                  <strong>{kes(t.amount)}</strong>
                  {t.express_charges > 0 && <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>fare {kes(t.amount - t.express_charges)} + exp {kes(t.express_charges)}</div>}
                  {t.payment === 'cash' && <div><Badge tone="gold">cash</Badge></div>}
                </Td>
                <Td>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditing(t)} style={linkBtn}>Edit</button>
                    <form action={deleteTrip} onSubmit={(e) => { if (!confirm('Delete this trip?')) e.preventDefault() }}>
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" style={{ ...linkBtn, color: 'var(--danger)' }}>Delete</button>
                    </form>
                  </div>
                </Td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </>
  )
}

function isRecent(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false
  const t = new Date(createdAt).getTime()
  return Number.isFinite(t) && Date.now() - t < 12 * 60 * 60 * 1000
}

function TripForm({ trip, lookups, defaultDate, onDone }: { trip: Trip | null; lookups: Lookups; defaultDate: string; onDone: () => void }) {
  const { contractors, organizations, vehicles, drivers } = lookups
  return (
    <div className="card animate-fadeup" style={{ padding: 20, marginBottom: 18 }}>
      <form action={async (fd) => { await saveTrip(fd); onDone() }}>
        {trip && <input type="hidden" name="id" value={trip.id} />}
        <div className="grid-form">
          <label className="field"><span>Date *</span>
            <input name="trip_date" type="date" className="input" required defaultValue={trip?.trip_date ?? defaultDate} />
          </label>
          <label className="field" style={{ gridColumn: 'span 2' }}><span>Client name *</span>
            <input name="client_name" className="input" required defaultValue={trip?.client_name ?? ''} />
          </label>
          <label className="field"><span>Slip / ticket no.</span>
            <input name="slip_no" className="input" defaultValue={trip?.slip_no ?? ''} />
          </label>
          <label className="field"><span>From</span>
            <input name="pickup" className="input" defaultValue={trip?.pickup ?? ''} placeholder="JKIA" />
          </label>
          <label className="field"><span>To</span>
            <input name="dropoff" className="input" defaultValue={trip?.dropoff ?? ''} placeholder="Westlands" />
          </label>
          <label className="field"><span>Organization</span>
            <select name="organization_id" className="input" defaultValue={trip?.organization_id ?? ''}>
              <option value="">—</option>{organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Via (contractor)</span>
            <select name="contractor_id" className="input" defaultValue={trip?.contractor_id ?? ''}>
              <option value="">—</option>{contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Vehicle</span>
            <select name="vehicle_id" className="input" defaultValue={trip?.vehicle_id ?? ''}>
              <option value="">—</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
            </select>
          </label>
          <label className="field"><span>Driver</span>
            <select name="driver_id" className="input" defaultValue={trip?.driver_id ?? ''}>
              <option value="">—</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Express charges (KES)</span>
            <input name="express_charges" type="number" step="1" className="input" defaultValue={trip?.express_charges ?? 0} />
          </label>
          <label className="field"><span>Voucher no.</span>
            <input name="voucher_no" className="input" defaultValue={trip?.voucher_no ?? ''} />
          </label>
          <label className="field"><span>Distance (km)</span>
            <input name="distance_km" type="number" step="0.1" className="input" defaultValue={trip?.distance_km ?? ''} />
          </label>
          <label className="field"><span>Hire cost (KES, casual hire)</span>
            <input name="hire_cost" type="number" step="1" className="input" defaultValue={trip?.hire_cost || ''} placeholder="paid to vehicle owner" />
          </label>
          <label className="field"><span>Flight no. (airport jobs)</span>
            <input name="flight_no" className="input" defaultValue={trip?.flight_no ?? ''} placeholder="KQ101" />
          </label>
          <label className="field"><span>Flight time</span>
            <input name="flight_time" type="datetime-local" className="input" defaultValue={trip?.flight_time ? trip.flight_time.slice(0, 16) : ''} />
          </label>
          <label className="field"><span>Amount (KES) *</span>
            <input name="amount" type="number" step="1" className="input" required defaultValue={trip?.amount ?? ''} />
          </label>
          <label className="field"><span>Payment</span>
            <select name="payment" className="input" defaultValue={trip?.payment ?? 'account'}>
              <option value="account">On account</option><option value="cash">Cash</option>
            </select>
          </label>
          <label className="field"><span>Notes</span>
            <input name="notes" className="input" defaultValue={trip?.notes ?? ''} placeholder="Via Expressway" />
          </label>
          <input type="hidden" name="status" value={trip?.status ?? 'completed'} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="submit" className="btn-primary" style={{ padding: '9px 20px', fontSize: 14, cursor: 'pointer' }}>{trip ? 'Save changes' : 'Save trip'}</button>
          <button type="button" className="btn-ghost" style={{ padding: '9px 18px', fontSize: 14, cursor: 'pointer' }} onClick={onDone}>Cancel</button>
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
