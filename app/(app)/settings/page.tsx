import { PageHeader, Section } from '@/components/ui'
import { requireProfile } from '@/lib/auth'
import { listContractors, listOrganizations, listProfiles, getCompany } from '@/lib/db'
import ThemeToggle from '@/components/ThemeToggle'
import ChangePassword from '@/components/ChangePassword'
import CompanyDetails from './CompanyDetails'
import SettingsManager from './SettingsManager'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const [profile, contractors, organizations, profiles, company] = await Promise.all([
    requireProfile(), listContractors(), listOrganizations(), listProfiles(), getCompany(),
  ])

  return (
    <>
      <PageHeader title="Settings" />

      <Section title="Appearance">
        <p style={{ fontSize: 13.5, color: 'var(--ink2)', margin: '-2px 0 12px' }}>Choice is remembered on this device.</p>
        <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Theme</div>
            <div style={{ fontSize: 13, color: 'var(--ink2)', marginTop: 2 }}>Light or dark.</div>
          </div>
          <ThemeToggle />
        </div>
      </Section>

      {profile.role === 'owner' && (
        <Section title="Company">
          <p style={{ fontSize: 13.5, color: 'var(--ink2)', margin: '-2px 0 12px' }}>Prints on invoices.</p>
          <CompanyDetails company={company} />
        </Section>
      )}

      <Section title="Account">
        <p style={{ fontSize: 13.5, color: 'var(--ink2)', margin: '-2px 0 12px' }}>Change your own password.</p>
        <div className="card" style={{ padding: 18 }}>
          <ChangePassword />
        </div>
      </Section>

      <SettingsManager
        contractors={contractors}
        organizations={organizations}
        profiles={profiles}
        canManageUsers={profile.role === 'owner'}
      />
    </>
  )
}
