import { PageHeader } from '@/components/ui'
import AttentionPanel from '@/components/AttentionPanel'
import { listDocuments, listServices, listVehicles, listDrivers } from '@/lib/db'
import { buildAttention } from '@/lib/attention'
import ComplianceManager from './ComplianceManager'

export const dynamic = 'force-dynamic'

export default async function CompliancePage() {
  const [documents, services, vehicles, drivers] = await Promise.all([
    listDocuments(), listServices(), listVehicles(), listDrivers(),
  ])
  const attention = buildAttention(documents, services, vehicles, drivers)

  return (
    <>
      <PageHeader title="Compliance" subtitle="Insurance, inspection & licence tracking with reminders" />
      <AttentionPanel items={attention} />
      <ComplianceManager documents={documents} vehicles={vehicles} drivers={drivers} />
    </>
  )
}
