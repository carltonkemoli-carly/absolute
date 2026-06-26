'use server'

import { parseWorkbook } from '@/lib/excel'
import type { ParseResult } from '@/lib/import-types'

// Generic: parse an uploaded spreadsheet into headers + rows for preview.
export async function parseExcelAction(formData: FormData): Promise<ParseResult> {
  const file = formData.get('file')
  if (!(file instanceof File)) return { headers: [], rows: [], error: 'No file received.' }
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const { headers, rows } = await parseWorkbook(buf, file.name)
    if (rows.length === 0) return { headers, rows, error: 'No data rows found in the sheet.' }
    return { headers, rows }
  } catch {
    return { headers: [], rows: [], error: 'Could not read that file. Make sure it is a .xlsx or .csv.' }
  }
}
