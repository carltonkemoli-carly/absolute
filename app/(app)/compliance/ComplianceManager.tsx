'use client'

import { useState } from 'react'
import { fmtDate } from '@/lib/format'
import {
  VEHICLE_DOC_TYPES, DRIVER_DOC_TYPES,
  type ComplianceDoc, type Driver, type Vehicle, type DocOwnerKind,
} from '@/lib/types'
import { saveDocument, deleteDocument, markAttended, unmarkAttended } from './actions'

function statusOf(d: ComplianceDoc): { label: string; tone: string; bg: string } {
  if (d.attended) return { label: 'attended', tone: 'var(--accent)', bg: 'var(--accent-light)' }
  if (!d.expiry_date) return { label: 'no expiry', tone: 'var(--ink3)', bg: 'var(--surface2)' }
  const days = Math.round((new Date(d.expiry_date).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: `expired ${Math.abs(days)}d ago`, tone: 'var(--danger)', bg: 'var(--danger-light)' }
  if (days <= 30) return { label: `due in ${days}d`, tone: 'var(--gold)', bg: 'var(--gold-light)' }
  return { label: `in ${days}d`, tone: 'var(--accent)', bg: 'var(--accent-light)' }
}

function needsAttention(d: ComplianceDoc): boolean {
  if (d.attended || !d.expiry_date) return false
  const days = Math.round((new Date(d.expiry_date).getTime() - Date.now()) / 86400000)
  return days <= 30
}

export default function ComplianceManager({
  documents, vehicles, drivers,
}: { documents: ComplianceDoc[]; vehicles: Vehicle[]; drivers: Driver[] }) {
  const [editing, setEditing] = useState<ComplianceDoc | 'new' | null>(null)
  const [attending, setAttending] = useState<ComplianceDoc | null>(null)
  const subject = (d: ComplianceDoc) =>
    d.owner_kind === 'vehicle'
      ? vehicles.find((v) => v.id === d.vehicle_id)?.plate ?? '—'
      : drivers.find((x) => x.id === d.driver_id)?.name ?? '—'

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn-primary" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} onClick={() => { setAttending(null); setEditing(editing === 'new' ? null : 'new') }}>
          {editing === 'new' ? 'Close' : '+ Add document'}
        </button>
      </div>

      {editing && (
        <DocForm key={editing === 'new' ? 'new' : editing.id} doc={editing === 'new' ? null : editing} vehicles={vehicles} drivers={drivers} onDone={() => setEditing(null)} />
      )}

      {attending && (
        <div className="card animate-fadeup" style={{ padding: 20, marginBottom: 18, borderColor: 'var(--gold)' }}>
          <div className="font-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            Mark attended — {subject(attending)} · {attending.doc_type}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 14 }}>Record that this overdue/expiring item has been actioned (renewed, booked, paid…).</div>
          <form action={async (fd) => { await markAttended(fd); setAttending(null) }}>
            <input type="hidden" name="id" value={attending.id} />
            <div className="grid-form">
              <label className="field"><span>Attended on *</span>
                <input name="attended_on" type="date" className="input" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </label>
              <label className="field" style={{ gridColumn: 'span 3' }}><span>What was done</span>
                <input name="attended_note" className="input" placeholder="e.g. Renewal booked with Jubilee, awaiting certificate" />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="btn-primary" style={{ padding: '9px 20px', fontSize: 14, cursor: 'pointer' }}>Mark attended</button>
              <button type="button" className="btn-ghost" style={{ padding: '9px 18px', fontSize: 14, cursor: 'pointer' }} onClick={() => setAttending(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 820 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <Th>For</Th><Th>Document</Th><Th>Expiry</Th><Th>Status</Th><Th>Attended</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 28, textAlign: 'center', color: 'var(--ink3)' }}>No documents yet.</td></tr>
            )}
            {documents.map((d) => {
              const st = statusOf(d)
              return (
                <tr key={d.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <Td><strong>{subject(d)}</strong> <span style={{ color: 'var(--ink3)', fontSize: 12 }}>{d.owner_kind}</span></Td>
                  <Td>{d.doc_type}{d.reference && <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{d.reference}</div>}</Td>
                  <Td>{d.expiry_date ? fmtDate(d.expiry_date) : '—'}</Td>
                  <Td><span style={{ fontSize: 12.5, fontWeight: 600, color: st.tone, background: st.bg, padding: '2px 9px', borderRadius: 99 }}>{st.label}</span></Td>
                  <Td>
                    {d.attended ? (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>✓ {d.attended_on ? fmtDate(d.attended_on) : 'done'}</div>
                        {d.attended_note && <div style={{ fontSize: 12, color: 'var(--ink3)', maxWidth: 220 }}>{d.attended_note}</div>}
                      </div>
                    ) : needsAttention(d) ? (
                      <button onClick={() => { setEditing(null); setAttending(d) }} style={{ ...linkBtn, color: 'var(--gold)' }}>Mark attended</button>
                    ) : <span style={{ color: 'var(--ink3)' }}>—</span>}
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                      {d.attended && (
                        <form action={unmarkAttended}>
                          <input type="hidden" name="id" value={d.id} />
                          <button type="submit" style={linkBtn}>Undo</button>
                        </form>
                      )}
                      <button onClick={() => { setAttending(null); setEditing(d) }} style={linkBtn}>Edit</button>
                      <form action={deleteDocument} onSubmit={(e) => { if (!confirm('Delete this document?')) e.preventDefault() }}>
                        <input type="hidden" name="id" value={d.id} />
                        <button type="submit" style={{ ...linkBtn, color: 'var(--danger)' }}>Delete</button>
                      </form>
                    </div>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function DocForm({ doc, vehicles, drivers, onDone }: { doc: ComplianceDoc | null; vehicles: Vehicle[]; drivers: Driver[]; onDone: () => void }) {
  const [kind, setKind] = useState<DocOwnerKind>(doc?.owner_kind ?? 'vehicle')
  const types = kind === 'vehicle' ? VEHICLE_DOC_TYPES : DRIVER_DOC_TYPES

  return (
    <div className="card animate-fadeup" style={{ padding: 20, marginBottom: 18 }}>
      <form action={async (fd) => { await saveDocument(fd); onDone() }}>
        {doc && <input type="hidden" name="id" value={doc.id} />}
        <div className="grid-form">
          <label className="field"><span>For *</span>
            <select name="owner_kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as DocOwnerKind)}>
              <option value="vehicle">Vehicle</option>
              <option value="driver">Driver</option>
            </select>
          </label>
          {kind === 'vehicle' ? (
            <label className="field"><span>Vehicle *</span>
              <select name="vehicle_id" className="input" required defaultValue={doc?.vehicle_id ?? ''}>
                <option value="">—</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
              </select>
            </label>
          ) : (
            <label className="field"><span>Driver *</span>
              <select name="driver_id" className="input" required defaultValue={doc?.driver_id ?? ''}>
                <option value="">—</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          )}
          <label className="field"><span>Document type *</span>
            <select name="doc_type" className="input" required defaultValue={doc?.doc_type ?? ''}>
              <option value="">—</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="field"><span>Reference no.</span>
            <input name="reference" className="input" defaultValue={doc?.reference ?? ''} />
          </label>
          <label className="field"><span>Provider</span>
            <input name="provider" className="input" defaultValue={doc?.provider ?? ''} placeholder="Jubilee, NTSA…" />
          </label>
          <label className="field"><span>Issue date</span>
            <input name="issue_date" type="date" className="input" defaultValue={doc?.issue_date ?? ''} />
          </label>
          <label className="field"><span>Expiry date</span>
            <input name="expiry_date" type="date" className="input" defaultValue={doc?.expiry_date ?? ''} />
          </label>
          <label className="field"><span>Notes</span>
            <input name="notes" className="input" defaultValue={doc?.notes ?? ''} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="submit" className="btn-primary" style={{ padding: '9px 20px', fontSize: 14, cursor: 'pointer' }}>Save</button>
          <button type="button" className="btn-ghost" style={{ padding: '9px 18px', fontSize: 14, cursor: 'pointer' }} onClick={onDone}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--accent-mid)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }
function Th({ children }: { children?: React.ReactNode }) {
  return <th style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</th>
}
function Td({ children }: { children?: React.ReactNode }) {
  return <td style={{ padding: '11px 14px', verticalAlign: 'top' }}>{children}</td>
}
