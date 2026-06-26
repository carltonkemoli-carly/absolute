# Automatic backup to a Google Sheet

This makes a Google Sheet that mirrors all your data (trips, fuel, servicing,
vehicles, drivers, compliance, routes…) and refreshes itself **every day**. If
the app ever has a problem, the full data still lives in your Google Drive.

It needs **no API keys and no payment** — Google does the scheduling.

## How it works
The app exposes a data endpoint: `https://YOUR-SITE/api/export`
A small script inside your Google Sheet fetches it daily and writes each table
to its own tab (replacing the old contents so it's always current).

---

## One-time setup (~10 minutes)

### 1. (Recommended) Lock the endpoint with a token
So only your Sheet can read the data:
- Add an env var `BACKUP_EXPORT_TOKEN` = some long random string
  (in `.env.local` locally, and in Vercel → Project → Settings → Environment Variables for the live site), then redeploy.
- You'll put the same string in the script below as `TOKEN`.

> In demo mode (no Supabase yet) the endpoint works without a token, so you can
> test this now. Once the real database is connected, the token becomes required.

### 2. Create the Sheet + script
1. Make a new Google Sheet (e.g. "Absolute Comfort — Backup").
2. **Extensions → Apps Script**.
3. Delete the sample code, paste the script below.
4. Set `APP_URL` to your site's export URL, and `TOKEN` if you set one.
5. Click **Save**.

```javascript
// ====== EDIT THESE TWO LINES ======
const APP_URL = 'https://absolute-comfort-two.vercel.app/api/export';
const TOKEN   = ''; // paste your BACKUP_EXPORT_TOKEN here, or leave '' in demo mode
// ==================================

function backupToSheet() {
  const url = TOKEN ? APP_URL + '?token=' + encodeURIComponent(TOKEN) : APP_URL;
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error('Export failed: ' + resp.getResponseCode() + ' ' + resp.getContentText());
  }
  const data = JSON.parse(resp.getContentText());
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(data.datasets).forEach(function (name) {
    const rows = data.datasets[name] || [];
    let sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    sheet.clearContents();
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const values = [headers].concat(rows.map(function (r) {
      return headers.map(function (h) {
        return (r[h] === null || r[h] === undefined) ? '' : r[h];
      });
    }));
    sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  });

  // Record the last backup time on an "Info" tab
  let info = ss.getSheetByName('Info') || ss.insertSheet('Info');
  info.clearContents();
  info.getRange(1, 1, 2, 2).setValues([['Last backup', new Date()], ['Source', APP_URL]]);
}

// Run this ONCE to schedule a daily automatic backup at ~2am
function scheduleDailyBackup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'backupToSheet') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('backupToSheet').timeBased().everyDays(1).atHour(2).create();
}
```

### 3. Run it once (and authorize)
- In the Apps Script toolbar, choose **backupToSheet** in the function dropdown → **Run**.
- Google will ask you to authorize the script (it's your own script) — allow it.
- Check your Sheet: a tab per table should now be filled.

### 4. Turn on the daily schedule
- Choose **scheduleDailyBackup** → **Run** (once). Done — it now backs up every day automatically.

---

## Notes
- The Sheet is a **mirror** (latest full state). For dated snapshots, you can
  duplicate the Sheet, or change `clearContents()` logic to append — ask and I'll adjust.
- This is most valuable once the **real Supabase database** is connected (demo
  data resets). The wiring is identical either way.

---

# Option B: the in-app "Back up to Sheet now" button (push)

The Backup page has a **↗ Back up to Sheet now** button for on-demand snapshots.
For it to work, the same Apps Script must be **deployed as a Web App** so the app
can send data to it.

### 1. Add this function to the SAME Apps Script
```javascript
// Set a secret and put the SAME value in the app's BACKUP_WEBHOOK_SECRET env var.
const PUSH_SECRET = ''; // e.g. 'a-long-random-string' (leave '' to skip the check)

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (PUSH_SECRET && body.secret !== PUSH_SECRET) {
      return ContentService.createTextOutput('Unauthorized: invalid secret');
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Object.keys(body.datasets).forEach(function (name) {
      const rows = body.datasets[name] || [];
      let sheet = ss.getSheetByName(name) || ss.insertSheet(name);
      sheet.clearContents();
      if (!rows.length) return;
      const headers = Object.keys(rows[0]);
      const values = [headers].concat(rows.map(function (r) {
        return headers.map(function (h) {
          return (r[h] === null || r[h] === undefined) ? '' : r[h];
        });
      }));
      sheet.getRange(1, 1, values.length, headers.length).setValues(values);
    });
    let info = ss.getSheetByName('Info') || ss.insertSheet('Info');
    info.clearContents();
    info.getRange(1, 1, 1, 2).setValues([['Last backup (pushed)', new Date()]]);
    return ContentService.createTextOutput('OK');
  } catch (err) {
    return ContentService.createTextOutput('Error: ' + err);
  }
}
```

### 2. Deploy as a Web App
- Apps Script → **Deploy → New deployment** → type **Web app**.
- **Execute as:** Me. **Who has access:** Anyone.
- Click **Deploy**, authorize, and **copy the Web app URL**
  (looks like `https://script.google.com/macros/s/…/exec`).

### 3. Tell the app about it
Set these env vars (in `.env.local` and in Vercel → Settings → Environment Variables), then redeploy:
```
GOOGLE_SHEETS_WEBHOOK_URL=<the /exec URL>
BACKUP_WEBHOOK_SECRET=<same value as PUSH_SECRET, or leave blank>
```

### 4. Use it
Open the **Backup** page → **↗ Back up to Sheet now**. You'll get a toast
confirming how many records were saved. (If you change the script later, create a
**new deployment** or “Manage deployments → edit” to keep the same URL.)

> Pull (Option A, daily auto) and push (Option B, on-demand) can both be on at
> once — they write to the same tabs.
