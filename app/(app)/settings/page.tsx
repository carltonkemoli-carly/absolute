import { PageHeader } from '@/components/ui'
import { requireProfile } from '@/lib/auth'
import { listContractors, listOrganizations, listProfiles } from '@/lib/db'
import ThemeToggle from '@/components/ThemeToggle'
import ChangePassword from '@/components/ChangePassword'
import SettingsManager from './SettingsManager'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const [profile, contractors, organizations, profiles] = await Promise.all([
    requireProfile(), listContractors(), listOrganizations(), listProfiles(),
  ])

  return (
    <>
      <PageHeader title="Settings" subtitle="Appearance, contractors, organizations and users" />

      <section style={{ marginBottom: 26 }}>
        <h2 className="font-display" style={{ fontSize: 17, fontWeight: 600, margin: '0 0 2px' }}>Appearance</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink2)', margin: '0 0 12px' }}>Choose how the console looks. Your choice is remembered on this device.</p>
        <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Theme</div>
            <div style={{ fontSize: 13, color: 'var(--ink2)', marginTop: 2 }}>Light is clean and bright; dark is a focused night console.</div>
          </div>
          <ThemeToggle />
        </div>
      </section>

      <section style={{ marginBottom: 26 }}>
        <h2 className="font-display" style={{ fontSize: 17, fontWeight: 600, margin: '0 0 2px' }}>Account</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink2)', margin: '0 0 12px' }}>Change your own password.</p>
        <div className="card" style={{ padding: 18 }}>
          <ChangePassword />
        </div>
      </section>

      <SettingsManager
        contractors={contractors}
        organizations={organizations}
        profiles={profiles}
        canManageUsers={profile.role === 'owner'}
      />
    </>
  )
}
