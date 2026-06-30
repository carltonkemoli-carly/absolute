'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import type { Company } from '@/lib/types'
import { saveCompanyAction } from './company-actions'

export default function CompanyDetails({ company }: { company: Company }) {
  const [saving, setSaving] = useState(false)
  return (
    <form
      action={async (fd) => { setSaving(true); await saveCompanyAction(fd); setSaving(false); toast.success('Company details saved.') }}
      className="card" style={{ padding: 18 }}
    >
      <div className="grid-form">
        <label className="field" style={{ gridColumn: 'span 2' }}><span>Company name</span><input name="name" className="input" defaultValue={company.name} required /></label>
        <label className="field" style={{ gridColumn: 'span 2' }}><span>Tagline</span><input name="tagline" className="input" defaultValue={company.tagline ?? ''} placeholder="Executive Airport Transfers" /></label>
        <label className="field" style={{ gridColumn: 'span 2' }}><span>Location</span><input name="location" className="input" defaultValue={company.location ?? ''} placeholder="Nairobi, Kenya" /></label>
        <label className="field"><span>Email</span><input name="email" className="input" defaultValue={company.email ?? ''} placeholder="billing@…" /></label>
        <label className="field"><span>Phone</span><input name="phone" className="input" defaultValue={company.phone ?? ''} placeholder="+254 …" /></label>
      </div>
      <div style={{ marginTop: 14 }}>
        <button type="submit" className="btn-primary" style={{ padding: '9px 20px', fontSize: 14, cursor: 'pointer' }} disabled={saving}>
          {saving ? 'Saving…' : 'Save company details'}
        </button>
      </div>
    </form>
  )
}
