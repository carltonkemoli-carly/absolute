'use client'

type Dataset = { name: string; label: string; rows: Record<string, unknown>[] }

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => cell(r[h])).join(','))].join('\n')
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function BackupView({ datasets }: { datasets: Dataset[] }) {
  const stamp = new Date().toISOString().slice(0, 10)

  function downloadOne(d: Dataset) {
    download(`absolute-${d.name}-${stamp}.csv`, toCsv(d.rows))
  }
  function downloadAll() {
    // One combined workbook-style file with a section per dataset.
    const parts = datasets.map((d) => `# ${d.label} (${d.rows.length})\n${toCsv(d.rows)}`)
    download(`absolute-comfort-backup-${stamp}.csv`, parts.join('\n\n\n'))
    // Also drop each table as its own file for clean re-import.
    datasets.forEach((d) => { if (d.rows.length) downloadOne(d) })
  }

  return (
    <>
      <div className="card" style={{ padding: 18, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="font-display" style={{ fontSize: 15, fontWeight: 600 }}>Download a full backup</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink2)', marginTop: 3 }}>
            Saves every record as CSV files (open in Excel or Google Sheets). Keep these as your offline copies.
          </div>
        </div>
        <button className="btn-primary" style={{ padding: '11px 20px', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={downloadAll}>
          ⬇ Download everything
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {datasets.map((d, i) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <div><strong>{d.label}</strong> <span style={{ color: 'var(--ink3)', fontSize: 13 }}>· {d.rows.length} record{d.rows.length === 1 ? '' : 's'}</span></div>
            <button className="btn-ghost" style={{ padding: '7px 14px', fontSize: 13, cursor: 'pointer' }} disabled={d.rows.length === 0} onClick={() => downloadOne(d)}>
              Download CSV
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
