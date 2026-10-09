'use server'

import { gatherDatasets } from '@/lib/backup'
import { requireOwner } from '@/lib/auth'

export type PushResult = { ok: boolean; message: string }

// Pushes a full snapshot to the Google Sheet Web App (push model).
// Requires GOOGLE_SHEETS_WEBHOOK_URL (the Apps Script deployment URL).
// Optionally BACKUP_WEBHOOK_SECRET, which the script checks.
export async function backupToSheetNow(): Promise<PushResult> {
  // Sends the entire database to an external endpoint — owner only.
  await requireOwner()
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL
  if (!url) {
    return {
      ok: false,
      message: 'Not connected yet. Deploy your Google Sheet script as a Web App and set GOOGLE_SHEETS_WEBHOOK_URL (see GOOGLE_SHEETS_BACKUP.md).',
    }
  }

  try {
    const datasets = await gatherDatasets()
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.BACKUP_WEBHOOK_SECRET ?? '',
        generatedAt: new Date().toISOString(),
        datasets,
      }),
      redirect: 'follow',
    })

    const text = (await res.text()).slice(0, 300)
    if (!res.ok) return { ok: false, message: `Google Sheet rejected the backup (${res.status}). ${text}` }
    if (/unauthorized|invalid secret/i.test(text)) return { ok: false, message: 'The Sheet rejected the secret — check BACKUP_WEBHOOK_SECRET matches the script.' }

    const total = Object.values(datasets).reduce((n, rows) => n + rows.length, 0)
    return { ok: true, message: `Backed up ${total} records to your Google Sheet.` }
  } catch {
    return { ok: false, message: 'Could not reach the Google Sheet Web App. Check the URL and that it is deployed for “Anyone”.' }
  }
}
