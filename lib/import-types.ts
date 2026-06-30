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

// Optional dropdowns shown in the import wizard (e.g. "these trips are completed / upcoming").
export interface ImportOption {
  key: string
  label: string
  choices: { value: string; label: string }[]
  default: string
}
export type ImportOptions = Record<string, string>
export type ImportAction = (rows: Record<string, string>[], opts: ImportOptions) => Promise<ImportResult>
