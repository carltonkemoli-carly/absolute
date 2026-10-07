'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Section } from '@/components/ui'
import type { Contractor, Organization, Profile } from '@/lib/types'
import { saveContractor, deleteContractor, saveOrganization, deleteOrganization } from './actions'
import { setUserRole, createUser } from './user-actions'

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner — full access' },
  { value: 'accountant', label: 'Accountant — sees finance' },
  { value: 'office', label: 'Office — operations only' },
  { value: 'driver', label: 'Driver — limited' },
]

export default function SettingsManager({
  contractors, organizations, profiles, canManageUsers,
}: {
  contractors: Contractor[]
  organizations: Organization[]
  profiles: Profile[]
  canManageUsers: boolean
}) {
  return (
    <div>
      <ContractorSection contractors={contractors} />
      <OrganizationSection organizations={organizations} contractors={contractors} />
      {canManageUsers && <UsersSection profiles={profiles} />}
    </div>
  )
}

// The shared Section band, plus the one-line description these blocks carry.
function SettingsSection({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <Section title={title}>
      <p style={{ fontSize: 13.5, color: 'var(--ink2)', margin: '-2px 0 12px' }}>{desc}</p>
      {children}
    </Section>
  )
}

function ContractorSection({ contractors }: { contractors: Contractor[] }) {
  const [adding, setAdding] = useState(false)
  return (
    <SettingsSection title="Contractors" desc="The companies that send you jobs (BCD, FCM, direct). Drives billing.">
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
    </SettingsSection>
  )
}

function OrganizationSection({ organizations, contractors }: { organizations: Organization[]; contractors: Contractor[] }) {
  const [adding, setAdding] = useState(false)
  const cname = (id: string | null) => contractors.find((c) => c.id === id)?.name ?? '—'
  return (
    <SettingsSection title="Organizations" desc="The end clients you ferry (World Bank, Safaricom, AATF…). Used as a dropdown when logging trips.">
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
    </SettingsSection>
  )
}

function UsersSection({ profiles }: { profiles: Profile[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  async function changeRole(id: string, role: string) {
    setSavingId(id)
    const res = await setUserRole(id, role)
    setSavingId(null)
    if (res.ok) { toast.success(res.message); router.refresh() } else toast.error(res.message)
  }

  return (
    <SettingsSection title="Users" desc="People with a login. Owner & accountant see finances; office is operations only.">
      <div className="card" style={{ overflow: 'hidden' }}>
        {profiles.map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 12 }}>
            <div style={{ fontWeight: 600 }}>{p.full_name ?? 'User'}</div>
            <select className="input" style={{ width: 220, opacity: savingId === p.id ? 0.5 : 1 }} value={p.role} disabled={savingId === p.id}
              onChange={(e) => changeRole(p.id, e.target.value)}>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        ))}
        {adding ? (
          <form action={async (fd) => { const res = await createUser(fd); if (res.ok) { toast.success(res.message); setAdding(false); router.refresh() } else toast.error(res.message) }}
            style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <label className="field"><span>Full name</span><input name="full_name" className="input" placeholder="e.g. Ray Wangari" /></label>
            <label className="field"><span>Email *</span><input name="email" type="email" className="input" required placeholder="name@absolutecomfort.co.ke" /></label>
            <label className="field"><span>Temp password *</span><input name="password" className="input" required placeholder="min 8 characters" /></label>
            <label className="field"><span>Role</span>
              <select name="role" className="input" defaultValue="office">{ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
            </label>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
              <button type="submit" className="btn-primary" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }}>Create login</button>
              <button type="button" className="btn-ghost" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} style={{ width: '100%', textAlign: 'left', padding: '13px 16px', background: 'none', border: 'none', color: 'var(--accent-mid)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>+ Add a staff login</button>
        )}
      </div>
    </SettingsSection>
  )
}

const delBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--danger)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }
const addRow: React.CSSProperties = { width: '100%', textAlign: 'left', padding: '13px 16px', background: 'none', border: 'none', color: 'var(--accent-mid)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }
