import { PageHeader, StatCard, Card, Section } from '@/components/ui'
import AttentionPanel from '@/components/AttentionPanel'
import SegmentDonut from '@/components/SegmentDonut'
import { Bars } from '@/components/Bars'
import type { Seg } from '@/lib/chart'
import { listDocuments, listServices, listVehicles, listDrivers } from '@/lib/db'
import { buildAttention } from '@/lib/attention'
import { isoDate, addDays } from '@/lib/format'
import type { ComplianceDoc } from '@/lib/types'
import ComplianceManager from './ComplianceManager'

export const dynamic = 'force-dynamic'

const GREEN = '#2C7A53', GOLD = '#C9A227', RED = '#BC3E22', TEAL = '#2F9E8F'

type DocState = 'expired' | 'due' | 'attended' | 'valid' | 'undated'

// Same reading of a document as the table below, so the chart and the rows agree.
function stateOf(d: ComplianceDoc, today: string, in30: string): DocState {
  if (d.attended) return 'attended'
  if (!d.expiry_date) return 'undated'
  if (d.expiry_date < today) return 'expired'
  if (d.expiry_date <= in30) return 'due'
  return 'valid'
}

export default async function CompliancePage() {
  const [documents, services, vehicles, drivers] = await Promise.all([
    listDocuments(), listServices(), listVehicles(), listDrivers(),
  ])
  const attention = buildAttention(documents, services, vehicles, drivers)

  const today = isoDate(new Date())
  const in30 = isoDate(addDays(new Date(), 30))
  const states = documents.map((d) => stateOf(d, today, in30))
  const n = (s: DocState) => states.filter((x) => x === s).length

  const statusMix: Seg[] = [
    { label: 'Valid', value: n('valid'), color: GREEN },
    { label: 'Expiring in 30 days', value: n('due'), color: GOLD },
    { label: 'Expired', value: n('expired'), color: RED },
    { label: 'Attended', value: n('attended'), color: TEAL },
    { label: 'No expiry date', value: n('undated'), color: 'var(--ink3)' },
  ]

  // Which kind of paperwork is actually at risk — insurance, inspection, licences.
  const byType = [...documents.reduce((m, d) => {
    const prev = m.get(d.doc_type) ?? { total: 0, risk: 0 }
    const st = stateOf(d, today, in30)
    m.set(d.doc_type, { total: prev.total + 1, risk: prev.risk + (st === 'expired' || st === 'due' ? 1 : 0) })
    return m
  }, new Map<string, { total: number; risk: number }>())]
    // Bar length = how many are actually at risk, so the chart ranks the problem
    // rather than drawing three identical full-width bars.
    .map(([label, v]) => ({ label, value: v.risk, sub: `of ${v.total} tracked` }))
    .sort((a, b) => b.value - a.value)


  return (
    <>
      <PageHeader title="Compliance" subtitle="Insurance, inspection & licence tracking with reminders" />

      <Section title="Compliance overview">
        <div className="grid-stats" style={{ marginBottom: documents.length > 0 ? 16 : 2 }}>
          <StatCard label="Documents tracked" value={String(documents.length)} hint={`${vehicles.length} vehicles · ${drivers.length} drivers`} />
          <StatCard label="Expired" value={String(n('expired'))}
            hint={n('expired') > 0 ? 'renew these first' : 'none overdue'}
            accent={n('expired') > 0 ? 'var(--danger)' : 'var(--accent)'} />
          <StatCard label="Expiring in 30 days" value={String(n('due'))}
            hint={n('due') > 0 ? 'book these now' : 'nothing falling due'}
            accent={n('due') > 0 ? 'var(--gold)' : 'var(--accent)'} />
          <StatCard label="Attended" value={String(n('attended'))} hint="marked as actioned" accent="var(--accent)" />
        </div>

        {documents.length > 0 && (
          <div className="grid-2">
            <Card title="Document status">
              <SegmentDonut data={statusMix} centerValue={String(documents.length)} centerLabel="documents" badges />
            </Card>
            <Card title="Needs attention by document type">
              <Bars
                items={byType} max={Math.max(1, ...byType.map((t) => t.value))}
                format={(v) => `${v} to renew`}
                accent="var(--gold)"
                emptyText="Every document is valid — nothing falling due." />
            </Card>
          </div>
        )}
      </Section>

      <AttentionPanel items={attention} />
      <ComplianceManager documents={documents} vehicles={vehicles} drivers={drivers} />
    </>
  )
}
