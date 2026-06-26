import ExcelJS from 'exceljs'

export interface ParsedSheet {
  headers: string[]
  rows: Record<string, string>[]
}

// Header tokens we expect across route / trip sheets — used to locate the
// header row even when there are title/blank rows above it.
const HEADER_HINTS = [
  'date', 'client', 'name', 'from', 'to', 'pickup', 'dropoff', 'amount', 'voucher',
  'organization', 'organisation', 'company', 'contractor', 'vehicle', 'driver',
  'slip', 'ticket', 'express', 'route', 'saloon', 'sedan', 'wagon', 'van', 'bus',
  'coaster', 'price', 'distance', 'flight', 'notes',
]

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    const v = value as { result?: unknown; text?: unknown; richText?: { text: string }[] }
    if (v.richText) return v.richText.map((r) => r.text).join('')
    if (v.text != null) return String(v.text)
    if (v.result != null) return String(v.result)
    return ''
  }
  return String(value).trim()
}

function rowsFromMatrix(matrix: string[][]): ParsedSheet {
  // Find the header row: the early row with the most header-hint matches.
  let headerIdx = 0
  let best = -1
  for (let i = 0; i < Math.min(matrix.length, 25); i++) {
    const score = matrix[i].filter((c) => {
      const low = c.toLowerCase()
      return low && HEADER_HINTS.some((h) => low.includes(h))
    }).length
    if (score > best && score >= 2) { best = score; headerIdx = i }
  }

  const rawHeaders = matrix[headerIdx] ?? []
  const headers = rawHeaders.map((h, i) => h.trim() || `Column ${i + 1}`)
  const rows: Record<string, string>[] = []
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const cells = matrix[i]
    if (!cells.some((c) => c.trim() !== '')) continue // skip blank rows
    const obj: Record<string, string> = {}
    headers.forEach((h, c) => { obj[h] = (cells[c] ?? '').trim() })
    rows.push(obj)
  }
  return { headers, rows }
}

function parseCsv(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = [], cur = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else inQuotes = false }
      else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(cur); cur = '' }
    else if (ch === '\n') { row.push(cur); out.push(row); row = []; cur = '' }
    else if (ch !== '\r') cur += ch
  }
  if (cur !== '' || row.length) { row.push(cur); out.push(row) }
  return out
}

export async function parseWorkbook(buffer: Buffer, filename: string): Promise<ParsedSheet> {
  if (filename.toLowerCase().endsWith('.csv')) {
    return rowsFromMatrix(parseCsv(buffer.toString('utf8')))
  }
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)
  const ws = wb.worksheets[0]
  if (!ws) return { headers: [], rows: [] }

  const matrix: string[][] = []
  let maxCol = 0
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = []
    row.eachCell({ includeEmpty: true }, (cell, col) => { cells[col - 1] = cellText(cell.value); if (col > maxCol) maxCol = col })
    matrix.push(cells)
  })
  // normalise width
  for (const r of matrix) for (let c = 0; c < maxCol; c++) if (r[c] == null) r[c] = ''
  return rowsFromMatrix(matrix)
}
