# Absolute Comfort — Handoff

Internal operations & finance system for **Absolute Comfort Travel**, a
Nairobi airport-transfer business. Built for the owner (Carlton's mum) to
track trips, drivers, fleet, fuel, receivables, suppliers and vehicle
payback.

## Repo

- GitHub: `https://github.com/carltonkemoli-carly/absolute`
- Default branch: `main`
- **Latest work is on `claude/design-rollout-crud-pages`** — merge or check
  out this branch; `main` is behind.

## Stack

- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4
- Data: Supabase (Postgres + auth via `@supabase/ssr`)
- Extras: `exceljs` (trip-sheet import), `geist` fonts, `react-hot-toast`

## Run it locally

```bash
npm install
npm run dev   # http://localhost:3000
```

### Two data modes

- **DEV_MODE** (no env file needed): file-backed demo store at
  `.devdata.json`, gitignored. Delete to reseed. Auto-enabled when
  `NEXT_PUBLIC_SUPABASE_URL` is missing. Forceable with
  `NEXT_PUBLIC_DEV_MODE=true`.
- **Live Supabase**: set the three keys in `.env.local`
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`). Carlton has these.

## Migrations owed by the user (run in Supabase SQL Editor)

Everything in `lib/migration-*.sql` is runnable SQL. Two from the last
session are not yet applied against live data:

1. `lib/migration-invoice-trips.sql` — adds `invoice_id` column to
   `trips` so a generated invoice can own its billed trips.
2. `lib/migration-supplier-targets.sql` — adds `contractor_id` to
   `targets` so each supplier can carry its own monthly revenue/trip
   target.

Code degrades gracefully when these columns are missing.

## Design system

- `components/ui.tsx` exports `Section`, `PageHeader`, `StatCard`, `Card`,
  `EmptyState`, `Badge` — use these; don't hand-roll.
- `components/SegmentDonut.tsx` for part-to-whole charts.
- `components/Bars.tsx` for ranked bar lists.
- `components/DataTable.tsx` — **new, shared**. Renders a real table on
  desktop, stacks each row as a labelled card below 860px. Columns are a
  typed spec:
  ```ts
  { label, render, align?: 'right', nowrap?: boolean,
    role?: 'primary' | 'actions' }
  ```
  `primary` leads on phone as the card headline. `actions` sits at
  the foot. Use for new tables; ~11 old `Th/Td` pages still remain to
  convert (Services, Fuel, Expenses, Receivables, Drivers, Clients,
  Reports, Vehicles, PricingCheck, Routes, Compliance).

### Tokens

CSS variables in `app/globals.css`:
- `--radius: 14px`, `--radius-sm: 10px`, `--radius-pill`
- `--surface`, `--surface2`, `--border`, `--ink`, `--ink2`, `--ink3`
- `--accent` (green), `--accent-mid`, `--accent-light`
- `--gold`, `--gold-light`, `--danger`, `--danger-light`
- Dark-mode overrides under
  `:root:not([data-theme="light"]) @media (prefers-color-scheme: dark)`
  and `:root[data-theme="dark"]`

### Breakpoint

**860px**, app-wide. Sidebar becomes an off-canvas drawer below it.

### Gotcha: Tailwind v4 tree-shaking

Custom CSS classes referenced only from files under `app/(app)/*` get
silently tree-shaken out of the production CSS. Workarounds:
- Reference the class from a file under `components/` (scanned path).
- Or inline the style.
- `.grid-stats`, `.grid-2`, `.data-table` survive because they're
  referenced from `components/`.

Verify a class survives by grepping the built CSS:
```bash
npm run build
grep "my-class" .next/static/chunks/*.css
```

## P&L — single source of truth

`lib/finance.ts`:
```ts
monthlyPL(args) → PL         // one month
periodPL(args, months)       // several months
combinePL(parts)             // aggregate several PLs
profitHeadline(pl)           // label + hint for a stat card
```
All four finance surfaces (Dashboard, Insights, Payback, Reports) go
through this. Don't recompute P&L anywhere else.

Key field: `costsComplete: boolean` — true only when wages are logged.
Headline label flips from "Net profit" to "Profit before wages" so the
numbers never claim more than the data supports.

## Timezone / date handling

Nairobi runs on UTC+3. The app does its own timezone-safe dates:
- `lib/format.ts` exports `isoDate(Date)` → `YYYY-MM-DD` in local
  calendar, `addDays(Date, n)` which uses date components, not ms.
- Never use `toISOString()` for a user-visible calendar day — it
  reads the UTC day, which is wrong between midnight and 3am in
  Nairobi. Several bugs from this were fixed last session.

## Nav

Sidebar groups in `components/AppShell.tsx`. Currently 22 items, 9
under Finance — this is bloat, flagged as the next big look/feel win.

## Business context Carlton established

- African Bliss (new account) was the trigger: break-even on a vehicle
  works out to ~55 USD per trip ≈ 30km one-way for a van.
- Fleet justified at 4 vehicles on service grounds (0400 starts).
- Competitor band: $50–70 per vehicle per trip.
- See `AUDIT_FINDINGS.md` and `AUDIT_BRIEF.md` on the repo for the
  deeper audit of data flow and finance correctness.

## Audit findings status (from last session)

Closed:
- **C1** honest gross/net distinction
- **C2** one P&L across all four surfaces
- **C3** payback fuel allocation (was biased against tagged cars)
- **C4** duplicate invoice guard
- **C5** invoice↔trip linking
- **C7/C8** time-window clarity (which numbers are "this month" vs
  running positions)
- **D1** finance route guards + authorization

Open / deferred:
- Nav consolidation (22 → ~12 items)
- The remaining 11 hand-rolled `Th`/`Td` tables → DataTable
- Distance → zone → per-trip cost pricing model (business decision
  needed from the owner)
- Trip-vs-run modelling (one booking may be multiple runs)

## Conventions

- Server components by default (App Router). Only add `'use client'`
  when you need state, effects, or an event handler.
- Server actions in `actions.ts` next to the page that uses them.
- Money always in KES, formatted with `kes(n)` or `kesPlain(n)` from
  `lib/format.ts`. Don't use `Intl.NumberFormat` directly.
- Section titles are sentence case source; the CSS uppercases them.
- No em-dashes in user-facing copy. No decorative emoji. No coaching
  hints under stat cards. (The de-AI pass last session was explicit
  about this; keep it clean.)

## Scripts

```bash
npm run dev     # dev server (port 3000 by default)
npm run build   # production build (also useful to catch errors)
npm run lint    # eslint (next 16 doesn't run it during build)
```

Pre-existing lint errors in `components/ThemeToggle.tsx`,
`AppShell.tsx`, `NavProgress.tsx`, `SegmentDonut.tsx`, and
`scripts/apply-db.cjs` — 13 errors, all before this session's work.
Don't let them block you.

## Immediate next task candidates

Pick one; they're ordered by probable impact:

1. **Convert remaining Th/Td tables to `DataTable`** — cosmetic but
   finishes the mobile story. Files listed above.
2. **Nav consolidation** — fold the 9 Finance items into ~3 tabs
   under one page. The sidebar is the loudest remaining tell.
3. **Per-trip cost model** (business + code) — distance → zone →
   fair price, so fares stop being set by vibes.
4. **Trip pagination** — a phone shows about 2 trip cards at a time,
   and October's 79 trips are a 33,000px scroll. "Show 20, load more"
   is the move.

Everything else (migrations, CI, deploy) can wait.
