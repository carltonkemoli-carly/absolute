'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { parseExcelAction } from '@/lib/excel-actions'
import type { FieldSpec, ImportResult, ParseResult } from '@/lib/import-types'

export default function ExcelImport({
  label = 'Import from Excel', spec, importAction, hint,
}: {
  label?: string
  spec: FieldSpec[]
  importAction: (rows: Record<string, string>[]) => Promise<ImportResult>
  hint?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})

  function autoMap(headers: string[]) {
    const m: Record<string, string> = {}
    for (const f of spec) {
      const hit = headers.find((h) => f.keywords.some((k) => h.toLowerCase().includes(k)))
      if (hit) m[f.key] = hit
    }
    setMapping(m)
  }

  async function onFile(file: File) {
    setBusy(true)
    setParsed(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await parseExcelAction(fd)
    setBusy(false)
    if (res.error) { toast.error(res.error); return }
    setParsed(res)
    autoMap(res.headers)
  }

  async function doImport() {
    if (!parsed) return
    const missing = spec.filter((f) => f.required && !mapping[f.key])
    if (missing.length) { toast.error(`Map a column for: ${missing.map((f) => f.label).join(', ')}`); return }
    setBusy(true)
    const rows = parsed.rows.map((r) =>
      Object.fromEntries(spec.map((f) => [f.key, mapping[f.key] ? (r[mapping[f.key]] ?? '') : ''])))
    const res: ImportResult = await importAction(rows)
    setBusy(false)
    toast.success(res.message)
    setOpen(false); setParsed(null)
    router.refresh()
  }

  if (!open) {
    return (
      <button className="btn-ghost" style={{ padding: '9px 16px', fontSize: 14, cursor: 'pointer' }} onClick={() => setOpen(true)}>
        ⬆ {label}
      </button>
    )
  }

  return (
    <div className="card animate-fadeup" style={{ padding: 20, marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>{label}</div>
        <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 13, cursor: 'pointer' }} onClick={() => { setOpen(false); setParsed(null) }}>Close</button>
      </div>
      {hint && <p style={{ fontSize: 13.5, color: 'var(--ink2)', margin: '0 0 12px' }}>{hint}</p>}

      <label style={{ display: 'inline-block' }}>
        <span className="btn-primary" style={{ display: 'inline-block', padding: '9px 16px', fontSize: 14, cursor: 'pointer' }}>
          {busy && !parsed ? 'Reading…' : parsed ? 'Choose a different file' : 'Choose .xlsx or .csv'}
        </span>
        <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
      </label>

      {parsed && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13.5, color: 'var(--ink2)', marginBottom: 10 }}>
            <strong>{parsed.rows.length}</strong> rows found. Check the column matches below, then import.
          </div>

          {/* Mapping controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 14 }}>
            {spec.map((f) => (
              <label key={f.key} className="field">
                <span>{f.label}{f.required ? ' *' : ''}</span>
                <select className="input" value={mapping[f.key] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}>
                  <option value="">— not in sheet —</option>
                  {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>

          {/* Preview */}
          <div className="card" style={{ overflowX: 'auto', marginBottom: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  {spec.map((f) => <th key={f.key} style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--ink2)' }}>{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 6).map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    {spec.map((f) => <td key={f.key} style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{mapping[f.key] ? r[mapping[f.key]] : ''}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="btn-primary" style={{ padding: '10px 20px', fontSize: 14, cursor: 'pointer', opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={doImport}>
            {busy ? 'Importing…' : `Import ${parsed.rows.length} rows`}
          </button>
        </div>
      )}
    </div>
  )
}
