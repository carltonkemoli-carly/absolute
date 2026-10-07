'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Section } from '@/components/ui'
import { fmtTime, fmtDateTime, fmtDate, waNumber } from '@/lib/format'
import type { Contractor, Driver, Organization, Trip, Vehicle } from '@/lib/types'
import { setTripStatus, clearPendingTrips } from './actions'
import AssignForm from './AssignForm'

type Lookups = { drivers: Driver[]; vehicles: Vehicle[]; organizations: Organization[]; contractors: Contractor[] }

// The 5-stage workflow. doneCount = how many stages a status has completed.
const FLOW = ['Assign', 'Dispatch', 'Confirm', 'En route', 'Done'] as const
const DONE: Record<string, number> = {
  booked: 0, assigned: 1, dispatched: 2, confirmed: 3, enroute: 4, completed: 5, cancelled: 0,
}
const STATUS_LABEL: Record<string, string> = {
  booked: 'Unassigned', assigned: 'Assigned', dispatched: 'Dispatched', confirmed: 'Confirmed',
  enroute: 'En route', completed: 'Completed', cancelled: 'Cancelled',
}
const STATUS_COLOR: Record<string, string> = {
  booked: 'var(--danger)', assigned: 'var(--gold)', dispatched: 'var(--accent-mid)',
  confirmed: 'var(--accent)', enroute: 'var(--accent)', completed: 'var(--ink3)', cancelled: 'var(--ink3)',
}

export default function DispatchBoard({ day, trips, pendingTrips = [], pendingTotal = 0, lookups }: { day: string; trips: Trip[]; pendingTrips?: Trip[]; pendingTotal?: number; lookups: Lookups }) {
  const router = useRouter()
  const [showQueue, setShowQueue] = useState(false)
  const { drivers, vehicles, organizations, contractors } = lookups
  const driver = (id: string | null) => drivers.find((d) => d.id === id) ?? null
  const plate = (id: string | null) => vehicles.find((v) => v.id === id)?.plate ?? null
  const orgName = (id: string | null) => organizations.find((o) => o.id === id)?.name ?? ''
  const conName = (id: string | null) => contractors.find((c) => c.id === id)?.name ?? ''

  const active = trips.filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
  const sorted = [...active].sort((a, b) => (DONE[a.status] - DONE[b.status]) || (a.flight_time ?? a.trip_date).localeCompare(b.flight_time ?? b.trip_date))
  const count = (s: string) => trips.filter((t) => t.status === s).length

  // Drivers/vehicles already on another job today → warn to avoid double-booking.
  const assignedActive = active.filter((t) => t.status !== 'booked')
  const busyDrivers = assignedActive.map((t) => t.driver_id).filter(Boolean) as string[]
  const busyVehicles = assignedActive.map((t) => t.vehicle_id).filter(Boolean) as string[]

  const [clearing, startClear] = useTransition()

  // Unassigned trips on OTHER dates — shown above the day view so imports are always visible.
  // Grouped by date so a large import (e.g. a full BCD month) stays readable.
  const otherPending = pendingTrips.filter((t) => t.trip_date !== day)
  const byDate = new Map<string, Trip[]>()
  for (const t of otherPending) {
    const arr = byDate.get(t.trip_date) ?? []
    arr.push(t); byDate.set(t.trip_date, arr)
  }
  const pendingDays = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  function onClearPending() {
    if (!confirm(`Delete all ${pendingTotal} unassigned job(s)? This cannot be undone. Use this to clear out a bad or duplicated import, then re-import cleanly.`)) return
    startClear(async () => {
      const n = await clearPendingTrips()
      toast.success(`Cleared ${n} unassigned job${n === 1 ? '' : 's'}.`)
      router.refresh()
    })
  }

  function shiftDay(delta: number) {
    const d = new Date(day); d.setDate(d.getDate() + delta)
    router.push(`/dispatch?d=${d.toISOString().slice(0, 10)}`)
  }

  return (
    <>
      {/* Compact pending banner — one line so the day's work stays at the top.
          Expand to see the date-grouped queue (e.g. freshly imported BCD jobs). */}
      {pendingTotal > 0 && (
        <div className="card animate-fadeup" style={{ marginBottom: 14, padding: '10px 14px', border: '1.5px solid var(--gold)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>
            📋 {pendingTotal} unassigned job{pendingTotal === 1 ? '' : 's'} waiting
          </span>
          <div style={{ flex: 1 }} />
          <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12.5, cursor: 'pointer' }} onClick={() => setShowQueue((s) => !s)}>
            {showQueue ? 'Hide queue ▴' : 'Show queue by date ▾'}
          </button>
          <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12.5, cursor: 'pointer', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={onClearPending} disabled={clearing}>
            {clearing ? 'Clearing…' : '🗑 Clear all'}
          </button>
        </div>
      )}

      {/* Day navigation — the primary work surface sits right here at the top */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn-ghost" style={navBtn} onClick={() => shiftDay(-1)}>‹</button>
        <input type="date" className="input" value={day} onChange={(e) => router.push(`/dispatch?d=${e.target.value}`)} style={{ width: 168 }} />
        <button className="btn-ghost" style={navBtn} onClick={() => shiftDay(1)}>›</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13.5, color: 'var(--ink2)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {count('booked') > 0 && <Tag color="var(--danger)">{count('booked')} to assign</Tag>}
          {count('assigned') > 0 && <Tag color="var(--gold)">{count('assigned')} to dispatch</Tag>}
          {count('dispatched') > 0 && <Tag color="var(--accent-mid)">{count('dispatched')} awaiting confirm</Tag>}
          {count('completed') > 0 && <Tag color="var(--ink3)">{count('completed')} done</Tag>}
        </div>
      </div>

      {/* Expandable date-grouped pending queue */}
      {showQueue && otherPending.length > 0 && (
        <Section title="Waiting to be assigned">
          <div className="card animate-fadeup" style={{ marginBottom: 18, padding: 14 }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginBottom: 10 }}>
              Click a day to open it above and assign drivers.{pendingTrips.length < pendingTotal ? ` Showing the first ${pendingDays.length} days.` : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {pendingDays.map(([date, jobs]) => (
                <button key={date} className="card card-hover" onClick={() => { router.push(`/dispatch?d=${date}`); setShowQueue(false) }}
                  style={{ padding: 14, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{fmtDate(date)}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', background: 'var(--gold-light)', padding: '2px 8px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap' }}>{jobs.length} job{jobs.length > 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.5 }}>
                    {jobs.slice(0, 3).map((j) => j.client_name).join(', ')}{jobs.length > 3 ? `, +${jobs.length - 3} more` : ''}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>Open & assign →</div>
                </button>
              ))}
            </div>
          </div>
        </Section>
      )}

      <Section title={`Jobs — ${fmtDate(day)}`}>
        {sorted.length === 0 && <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--ink3)' }}>{count('completed') > 0 ? 'All jobs for this day are completed. ✓' : 'No jobs for this day. Pick another date above, or expand the pending queue.'}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
          {sorted.map((t) => {
            const d = driver(t.driver_id)
            const doneCount = DONE[t.status] ?? 0
            const msg = `Hi ${d?.name ?? ''}, trip for ${t.client_name}: ${t.pickup ?? ''} → ${t.dropoff ?? ''}${t.flight_time ? ` at ${fmtTime(t.flight_time)}` : ''}${t.flight_no ? ` (flight ${t.flight_no})` : ''}. Vehicle ${plate(t.vehicle_id) ?? ''}. Please confirm.`

            return (
              <div key={t.id} className="card card-hover animate-fadeup" style={{ padding: 0, overflow: 'hidden' }}>
                {/* status accent bar */}
                <div style={{ height: 3, background: STATUS_COLOR[t.status] }} />
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15.5 }}>{t.client_name}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink2)', marginTop: 2 }}>{(t.pickup || '—')} → {(t.dropoff || '—')}</div>
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: STATUS_COLOR[t.status], background: 'var(--surface2)', padding: '3px 9px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap' }}>{STATUS_LABEL[t.status]}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--ink3)', margin: '9px 0 12px' }}>
                    {t.flight_no && <span>✈ {t.flight_no} · {t.flight_time ? fmtTime(t.flight_time) : ''}</span>}
                    <span>{conName(t.contractor_id)}{orgName(t.organization_id) ? ` · ${orgName(t.organization_id)}` : ''}</span>
                  </div>

                  {/* Stepper */}
                  <Stepper doneCount={doneCount} />

                  {/* Step-specific action area */}
                  <div style={{ marginTop: 14 }}>{renderAction()}</div>
                </div>
              </div>
            )

            function renderAction() {
              if (t.status === 'booked') {
                return (
                  <ActionBlock step="1" title="Assign a driver & vehicle" hint="Pick the driver — their usual vehicle fills in automatically.">
                    <AssignForm tripId={t.id} drivers={drivers} vehicles={vehicles} busyDrivers={busyDrivers} busyVehicles={busyVehicles} />
                  </ActionBlock>
                )
              }
              const who = <div style={{ fontSize: 13.5, marginBottom: 4 }}><strong>{plate(t.vehicle_id) ?? '—'}</strong> · {d?.name ?? 'No driver'}{t.assigned_by ? <span style={{ color: 'var(--ink3)' }}> · by {t.assigned_by}{t.assigned_at ? `, ${fmtDateTime(t.assigned_at)}` : ''}</span> : null}</div>
              const contact = d?.phone ? (
                <div style={{ display: 'flex', gap: 8, margin: '8px 0', flexWrap: 'wrap' }}>
                  <a href={`tel:${d.phone.replace(/\s/g, '')}`} className="btn-ghost" style={contactBtn}>📞 Call</a>
                  <a href={`https://wa.me/${waNumber(d.phone)}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ ...contactBtn, color: '#1DA851', borderColor: '#1DA851' }}>💬 WhatsApp</a>
                  <a href={`sms:${d.phone.replace(/\s/g, '')}?body=${encodeURIComponent(msg)}`} className="btn-ghost" style={contactBtn}>✉ SMS</a>
                </div>
              ) : null

              if (t.status === 'assigned') {
                return (
                  <ActionBlock step="2" title="Dispatch to the driver" hint="Send the trip details, then mark it dispatched.">
                    {who}{contact}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <StatusBtn id={t.id} status="dispatched" label="Mark as dispatched →" primary />
                      <StatusBtn id={t.id} status="booked" label="Unassign" />
                    </div>
                  </ActionBlock>
                )
              }
              if (t.status === 'dispatched') {
                return (
                  <ActionBlock step="3" title={`Awaiting ${d?.name?.split(' ')[0] ?? 'driver'}'s confirmation`} hint="Sent. Mark confirmed once the driver accepts.">
                    {who}{contact}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <StatusBtn id={t.id} status="confirmed" label="✓ Driver confirmed" primary />
                      <StatusBtn id={t.id} status="assigned" label="Back" />
                    </div>
                  </ActionBlock>
                )
              }
              if (t.status === 'confirmed') {
                return (
                  <ActionBlock step="4" title="Ready to go" hint={`${d?.name?.split(' ')[0] ?? 'Driver'} confirmed. Start when the trip begins.`}>
                    {who}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <StatusBtn id={t.id} status="enroute" label="▶ Start trip" primary />
                    </div>
                  </ActionBlock>
                )
              }
              // enroute
              return (
                <ActionBlock step="" title="On the road" hint="Close the job when the passenger is dropped off.">
                  {who}
                  <StatusBtn id={t.id} status="completed" label="✓ Complete trip" primary />
                </ActionBlock>
              )
            }
          })}
        </div>
      </Section>
    </>
  )
}

function Stepper({ doneCount }: { doneCount: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {FLOW.map((label, i) => {
        const done = i < doneCount
        const activeStep = i === doneCount
        const color = done ? 'var(--accent)' : activeStep ? 'var(--gold)' : 'var(--ink3)'
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < FLOW.length - 1 ? 1 : '0 0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
                background: done ? 'var(--accent)' : activeStep ? 'var(--gold-light)' : 'transparent',
                color: done ? 'var(--on-accent)' : color,
                border: `1.5px solid ${done ? 'var(--accent)' : color}`,
                transition: 'all .3s var(--ease)',
              }}>{done ? '✓' : i + 1}</div>
              <span style={{ fontSize: 9.5, fontWeight: activeStep ? 700 : 500, color, whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            {i < FLOW.length - 1 && <div style={{ flex: 1, height: 2, background: i < doneCount ? 'var(--accent)' : 'var(--border)', margin: '0 4px', marginBottom: 14, transition: 'background .3s var(--ease)' }} />}
          </div>
        )
      })}
    </div>
  )
}

function ActionBlock({ step, title, hint, children }: { step: string; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{step && <span style={{ color: 'var(--accent)' }}>{step} · </span>}{title}</div>
      <div style={{ fontSize: 12, color: 'var(--ink2)', margin: '2px 0 9px' }}>{hint}</div>
      {children}
    </div>
  )
}

function StatusBtn({ id, status, label, primary }: { id: string; status: string; label: string; primary?: boolean }) {
  return (
    <form action={setTripStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={primary ? 'btn-primary' : 'btn-ghost'} style={actBtn}>{label}</button>
    </form>
  )
}
function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ fontWeight: 600, color }}>{children}</span>
}

const navBtn: React.CSSProperties = { width: 34, height: 34, fontSize: 18, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const contactBtn: React.CSSProperties = { padding: '6px 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center' }
const actBtn: React.CSSProperties = { padding: '8px 14px', fontSize: 13, cursor: 'pointer' }
