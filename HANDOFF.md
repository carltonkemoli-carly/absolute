# Absolute Comfort — Handoff

Internal operations and finance system for **Absolute Comfort Travel**, a
Nairobi airport-transfer business. Built for the owner (Carlton's mum) and her
office staff: trips, dispatch, fleet, fuel, servicing, compliance, suppliers,
invoices and payments, and the business figures that come out of them.

Read this first, then `CLOUD_SESSION.md` (session history and live-deploy
notes) and `docs/` (accounting, security, design direction).

## Repo and branch

- GitHub: `https://github.com/carltonkemoli-carly/absolute`
- **All current work is on `claude/design-rollout-crud-pages`** (PR #1).
  `main` is far behind. Nothing on this branch is deployed yet.
- Live app (old version, from `main`): https://absolute-comfort-two.vercel.app

## Run it

```bash
npm install
npm run dev          # http://localhost:3000, demo data, no keys needed
npm test             # 10 Node test files
npm run lint
NEXT_PUBLIC_DEV_MODE=true npm run build
python3 tests/integrity.py local   # PostgreSQL suite (needs a local postgres server;
                                    # or pass a Docker container name instead of `local`)
```

**Demo mode** is on whenever no Supabase URL is set. It skips login and serves
synthetic data from `.devdata.json` (gitignored; delete it to reseed). The
sidebar footer switches between the CEO (owner) and Rachel (office) to check
what each role can see.

**Live mode** needs `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Never commit it.

## Before this branch goes live

Run these in the Supabase SQL Editor, **on a staging copy first**, in order:

1. `lib/audit-preflight.sql` — read-only; shows rows that would block step 2.
2. `lib/migration-integrity.sql` — roles, finance-only policies, atomic
   invoice creation, dispatch overlap constraints.
3. `lib/migration-invoice-payments.sql` — the payment ledger.

The app works before step 3 (payments fall back to adjusting the paid total
and say so), but not before step 2 for invoices. Then deploy the branch.
The Supabase project was reported inactive on 11 November; it may need
restoring first.

## Where things are

| Area | Files |
| --- | --- |
| Data layer (every read/write) | `lib/db.ts`, demo store `lib/devstore.ts` |
| Roles and guards | `lib/auth.ts` — `requireOperations`, `requireFinance`, `requireOwner`. Every server action calls one itself. |
| Profit and loss (one engine) | `lib/finance.ts` — `monthlyPL`, `periodPL`, `profitHeadline`. Only completed trips earn revenue; tolls are pass-through. |
| Dashboard maths | `lib/dashboard.ts` — receivables aging, debtors, like-for-like comparison |
| Payments | `lib/payments.ts` (validation, settlement), `invoice_payments` table |
| Dispatch rules | `lib/dispatch-rules.ts` — only jobs still to be done hold a driver or vehicle |
| Search | `lib/record-search.ts`, command palette `components/CommandPalette.tsx`, server action `app/(app)/search/actions.ts` |
| Shell and navigation | `components/AppShell.tsx` |
| Design system | `components/ui.tsx` (`PageHeader`, `Section`, `KpiCard`, `StatCard`, `Card`, `Badge`), `DataTable.tsx`, `SegmentDonut.tsx`, `Bars.tsx`, `Sparkline.tsx`, `BrandLogo.tsx` |
| Colours | `app/globals.css` (all tokens, light and dark), `lib/chart.ts` (`CHART_COLORS`, `STATUS_COLORS`) |

## Design rules

- **Colour carries meaning.** Blue is the brand and anything you can act on.
  Green (`--ok`) is done or healthy. Amber (`--gold`) needs a look. Red
  (`--danger`) is overdue or broken. Charts use `CHART_COLORS` /
  `STATUS_COLORS`, never hex values in a page.
- **Every list is a `DataTable`.** A table on a laptop, labelled cards below
  860px. Column options: `role: 'primary' | 'actions' | 'select'`,
  `align: 'right'`, `nowrap`, `card: 'hide'`.
- **Plain copy.** No decorative emoji, no em-dashes in interface text, no
  coaching hints that repeat the label. Say what a number is, and when it is
  incomplete (for example "profit before unrecorded wages").
- **Minimum text size 11px** in stylesheets.
- **Tailwind v4 gotcha:** a CSS class referenced only from files under
  `app/(app)/` can be dropped from the built CSS. Reference it from a file in
  `components/` (see `CARD_ONLY` in `DataTable.tsx`) or use inline styles.
- **Dates:** use `nairobiToday()` / `isoDate()`, never `toISOString()` for a
  calendar day.

## What exists now (this branch)

- **Dashboard:** four headline figures with six-month trends and fair
  month-to-date comparisons, trips by day, a "needs a decision" queue,
  where the fares went, money owed by lateness, revenue by supplier and vehicle.
- **Search anywhere:** Ctrl/Cmd+K or `/` — pages and records (passengers,
  plates, routes, invoices), scoped to the user's role.
- **Phone:** bottom tab bar (Today, Dispatch, Trips, Search, Menu); installable
  to the home screen (manifest, icons, theme colour).
- **Trips:** 30 per page, one toolbar, select many and tag them with a driver
  and vehicle, or mark them completed.
- **Receivables:** aging, who owes what, a payment ledger (amount, date,
  M-Pesa / bank / cash / cheque, reference), receipts printed on the invoice.
- From the ChatGPT session: Today's work, Dispatch board/list, attention
  centre, vehicle and client record pages, saved trip views and CSV export.

## Open questions for the owner

- Pricing: distance → zone → per-trip cost model. Needs her decision on zones.
- Trip vs run: one booking can be several runs; the data model treats a trip
  as one run.
- Invoice snapshots and credit notes (see `docs/ACCOUNTING_READINESS.md`).

## Good next steps

1. Stage and apply the three SQL files above, then deploy this branch.
2. Load recent months of trips from the supplier Excel sheets.
3. Recurring monthly costs (insurance, licences) so profit needs less typing.
4. Offline-friendly service worker, if she uses it with poor signal.
