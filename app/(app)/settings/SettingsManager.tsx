'use client'

import { useState } from 'react'
import type { Contractor, Organization, Profile } from '@/lib/types'
import { saveContractor, deleteContractor, saveOrganization, deleteOrganization } from './actions'

export default function SettingsManager({
  contractors, organizations, profiles, canManageUsers,
}: {
  contractors: Contractor[]
  organizations: Organization[]
  profiles: Profile[]
  canManageUsers: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <ContractorSection contractors={contractors} />
      <OrganizationSection organizations={organizations} contractors={contractors} />
      {canManageUsers && <UsersSection profiles={profiles} />}
    </div>
  )
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display" style={{ fontSize: 17, fontWeight: 600, margin: '0 0 2px' }}>{title}</h2>
      <p style={{ fontSize: 13.5, color: 'var(--ink2)', margin: '0 0 12px' }}>{desc}</p>
      {children}
    </section>
  )
}

function ContractorSection({ contractors }: { contractors: Contractor[] }) {
  const [adding, setAdding] = useState(false)
  return (
    <Section title="Contractors" desc="The companies that send you jobs (BCD, FCM, direct). Drives billing.">
      <div className="card" style={{ overflow: 'hidden' }}>
        {contractors.map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div><strong>{c.name}</strong>{c.code && <span style={{ color: 'var(--ink3)', marginLeft: 8, fontSize: 13 }}>{c.code}</span>}</div>
            <form action={deleteContractor} onSubmit={(e) => { if (!confirm(`Delete ${c.name}?`)) e.preventDefault() }}>
              <input type="hidden" name="id" value={c.id} />
              <button type="submit" style={delBtn}>Delete</button>
            </form>
          </div>
        ))}
        {adding ? (
          <form action={async (fd) => { await saveContractor(fd); setAdding(false) }} style={{ display: 'flex', gap: 10, padding: 14, alignItems: 'flex-end' }}>
            <label className="field" style={{ flex: 1 }}><span>Name *</span><input name="name" className="input" required autoFocus /></label>
            <label className="field" style={{ width: 120 }}><span>Code</span><input name="code" className="input" /></label>
            <button type="submit" className="btn-primary" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }}>Add</button>
            <button type="button" className="btn-ghost" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} onClick={() => setAdding(false)}>Cancel</button>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} style={{ ...addRow }}>+ Add contractor</button>
        )}
      </div>
    </Section>
  )
}

function OrganizationSection({ organizations, contractors }: { organizations: Organization[]; contractors: Contractor[] }) {
  const [adding, setAdding] = useState(false)
  const cname = (id: string | null) => contractors.find((c) => c.id === id)?.name ?? '—'
  return (
    <Section title="Organizations" desc="The end clients you ferry (World Bank, Safaricom, AATF…). Used as a dropdown when logging trips.">
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ maxHeight: 320, overflowY: 'auto' }} className="scroll-thin">
          {organizations.map((o) => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
              <div><strong>{o.name}</strong><span style={{ color: 'var(--ink3)', marginLeft: 8, fontSize: 13 }}>via {cname(o.contractor_id)}</span></div>
              <form action={deleteOrganization} onSubmit={(e) => { if (!confirm(`Delete ${o.name}?`)) e.preventDefault() }}>
                <input type="hidden" name="id" value={o.id} />
                <button type="submit" style={delBtn}>Delete</button>
              </form>
            </div>
          ))}
        </div>
        {adding ? (
          <form action={async (fd) => { await saveOrganization(fd); setAdding(false) }} style={{ display: 'flex', gap: 10, padding: 14, alignItems: 'flex-end' }}>
            <label className="field" style={{ flex: 1 }}><span>Name *</span><input name="name" className="input" required autoFocus /></label>
            <label className="field" style={{ width: 180 }}><span>Default contractor</span>
              <select name="contractor_id" className="input"><option value="">—</option>{contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </label>
            <button type="submit" className="btn-primary" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }}>Add</button>
            <button type="button" className="btn-ghost" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} onClick={() => setAdding(false)}>Cancel</button>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} style={{ ...addRow }}>+ Add organization</button>
        )}
      </div>
    </Section>
  )
}

function UsersSection({ profiles }: { profiles: Profile[] }) {
  return (
    <Section title="Users" desc="People with a login. Roles control access — owner & accountant see finances.">
      <div className="card" style={{ overflow: 'hidden' }}>
        {profiles.map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div><strong>{p.full_name ?? 'User'}</strong></div>
            <span style={{ fontSize: 13, color: 'var(--ink2)', textTransform: 'capitalize' }}>{p.role}</span>
          </div>
        ))}
        <div style={{ padding: '11px 16px', fontSize: 12.5, color: 'var(--ink3)' }}>
          Role changes are managed in Supabase for now (profiles.role). A role editor can be added next.
        </div>
      </div>
    </Section>
  )
}

const delBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--danger)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }
const addRow: React.CSSProperties = { width: '100%', textAlign: 'left', padding: '13px 16px', background: 'none', border: 'none', color: 'var(--accent-mid)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }
