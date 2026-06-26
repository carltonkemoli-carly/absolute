// A target field the importer maps a spreadsheet column onto.
export interface FieldSpec {
  key: string
  label: string
  keywords: string[]
  required?: boolean
}

export interface ParseResult {
  headers: string[]
  rows: Record<string, string>[]
  error?: string
}

export interface ImportResult {
  created: number
  skipped: number
  message: string
}
