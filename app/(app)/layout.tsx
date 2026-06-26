import AppShell from '@/components/AppShell'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { DEV_MODE } from '@/lib/devmode'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile()
  const canFinance = canSeeFinance(profile.role)

  return (
    <AppShell profile={profile} canFinance={canFinance} devMode={DEV_MODE}>
      {children}
    </AppShell>
  )
}
