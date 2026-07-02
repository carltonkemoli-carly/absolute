'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { kes } from '@/lib/format'

export type QuoteRoute = { id: string; pickup: string; dropoff: string; saloon: number; wagon: number; van: number; bus: number }
const CLASSES = [
  { key: 'saloon', label: 'Saloon (4)' },
  { key: 'wagon', label: 'Wagon (5)' },
  { key: 'van', label: 'Van (7)' },
  { key: 'bus', label: 'Bus / Coaster' },
] as const
type ClassKey = typeof CLASSES[number]['key']
const TOLLS = [0, 250, 330, 410]

export default function QuoteCalculator({ routes, companyName }: { routes: QuoteRoute[]; companyName: string }) {
  const [routeId, setRouteId] = useState(routes[0]?.id ?? '')
  const [cls, setCls] = useState<ClassKey>('saloon')
  const [toll, setToll] = useState(0)
  const [extras, setExtras] = useState(0)
  const [extraLabel, setExtraLabel] = useState('')

  const route = useMemo(() => routes.find((r) => r.id === routeId) ?? null, [routes, routeId])
  const base = route ? route[cls] : 0
  const total = base + toll + extras
  const routeLabel = route ? `${route.pickup} → ${route.dropoff}` : ''

  const quoteText = route
    ? `${companyName}\nQuote: ${routeLabel}\nVehicle: ${CLASSES.find((c) => c.key === cls)!.label}\nFare: ${kes(base)}${toll ? `\nExpressway: ${kes(toll)}` : ''}${extras ? `\n${extraLabel || 'Extra'}: ${kes(extras)}` : ''}\nTotal: ${kes(total)}`
    : ''

  function copy() { navigator.clipboard?.writeText(quoteText); toast.success('Quote copied') }

  if (routes.length === 0) {
    return <div className="card" style={{ padding: 24, color: 'var(--ink3)' }}>No routes on your rate card yet. Add some on Routes &amp; rates to quote fares.</div>
  }

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      {/* Inputs */}
      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label className="field"><span>Route</span>
          <select className="input" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            {routes.map((r) => <option key={r.id} value={r.id}>{r.pickup} → {r.dropoff}</option>)}
          </select>
        </label>

        <div className="field">
          <span>Vehicle class</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CLASSES.map((c) => {
              const price = route?.[c.key] ?? 0
              const active = cls === c.key
              return (
                <button key={c.key} onClick={() => setCls(c.key)} disabled={price <= 0} style={{
                  padding: '8px 12px', fontSize: 13, cursor: price > 0 ? 'pointer' : 'not-allowed', borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border-med)'}`,
                  background: active ? 'var(--accent)' : 'transparent', color: active ? 'var(--on-accent)' : price > 0 ? 'var(--ink)' : 'var(--ink3)', opacity: price > 0 ? 1 : 0.5,
                }}>{c.label}{price > 0 ? ` · ${kes(price)}` : ' · —'}</button>
              )
            })}
          </div>
        </div>

        <div className="field">
          <span>Expressway toll</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TOLLS.map((t) => (
              <button key={t} onClick={() => setToll(t)} style={{
                padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${toll === t ? 'var(--gold)' : 'var(--border-med)'}`,
                background: toll === t ? 'var(--gold-light)' : 'transparent', color: toll === t ? 'var(--gold)' : 'var(--ink)',
              }}>{t === 0 ? 'None' : kes(t)}</button>
            ))}
          </div>
        </div>

        <div className="grid-2" style={{ gap: 10 }}>
          <label className="field"><span>Extra charge (KES)</span>
            <input type="number" className="input" value={extras || ''} onChange={(e) => setExtras(Number(e.target.value) || 0)} placeholder="e.g. waiting" />
          </label>
          <label className="field"><span>Extra label</span>
            <input className="input" value={extraLabel} onChange={(e) => setExtraLabel(e.target.value)} placeholder="Waiting time" />
          </label>
        </div>
      </div>

      {/* Quote output */}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Quote</div>
        <div className="font-display" style={{ fontSize: 16, fontWeight: 700, margin: '6px 0 14px' }}>{routeLabel}</div>

        <Line label={`Fare · ${CLASSES.find((c) => c.key === cls)!.label}`} value={kes(base)} />
        {toll > 0 && <Line label="Expressway" value={kes(toll)} />}
        {extras > 0 && <Line label={extraLabel || 'Extra'} value={kes(extras)} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12, paddingTop: 12, borderTop: '2px solid var(--ink)' }}>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 16 }}>Total</span>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 26 }}>{kes(total)}</span>
        </div>
        {base <= 0 && <p style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 10 }}>No rate set for this class on this route — pick another class or add the rate on Routes &amp; rates.</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          <button className="btn-primary" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} onClick={copy}>Copy quote</button>
          <a className="btn-ghost" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} href={`https://wa.me/?text=${encodeURIComponent(quoteText)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
        </div>
      </div>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 14, color: 'var(--ink2)' }}>
      <span>{label}</span><span>{value}</span>
    </div>
  )
}
