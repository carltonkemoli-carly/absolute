# Absolute Comfort Travel — Session Handoff

Internal **operations & finance system** for Absolute Comfort Travel, a Nairobi
travel agency (point-A-to-B client transport, mostly JKIA airport transfers).
Built for the owner (the user's mom). This repository is the internal office
tool. A separate owner-private public website project now exists; see section 8.

- **Live app:** https://absolute-comfort-two.vercel.app
- **Stack:** Next.js **16.2.6** (App Router) · React 19.2 · Tailwind **v4** ·
  `@supabase/ssr` + `@supabase/supabase-js` · `exceljs` · `geist` · `react-hot-toast`
- **Node:** 20+ · package manager: npm

---

## 1. Run it (no secrets needed)

The app runs fully in **DEV_MODE** with file-backed demo data — no Supabase, no
auth, no keys. **This is how to develop, preview, and verify in a cloud session.**

```bash
npm install
echo "NEXT_PUBLIC_DEV_MODE=true" > .env.development.local
npm run dev        # http://localhost:3000  (preview tooling here uses 3100)
```

- `DEV_MODE` is on automatically whenever no Supabase URL is set, or when
  `NEXT_PUBLIC_DEV_MODE=true`. It skips auth (you are a demo "CEO" owner) and
  serves sample data from `.devdata.json` (gitignored; **delete it to reseed**
  fresh — do this after any schema/seed change so the demo reflects it).
- Demo persona switch (CEO owner ↔ Rachel office) is in the sidebar footer, to
  test finance gating.
- **Always `npm run build` before deploying.** The build runs ESLint + types.

### Going against the real database
Live Supabase keys live in **`.env.local`** (gitignored, NOT in the repo):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`. A cloud session won't have
these — ask the user to provide them if a live-DB operation is needed. With just
the service-role key you can do REST reads/writes (used for data ops) but **not
DDL** (see migrations below).

---

## 2. Architecture & conventions (read before editing)

- **Single data layer — `lib/db.ts`.** Every read/write goes through it. It
  branches `DEV_MODE` (file store `lib/devstore.ts`) vs Supabase. Adding real
  keys flips to the real DB with no code change.
  - Reads **paginate** past PostgREST's 1000-row cap (`fetchAll`). Don't
    reintroduce single-shot `.select('*')` on `trips`/`fuel`/`expenses`.
  - `saveRecord` **returns `{ error }`** and logs failures — don't swallow it.
- **Auth — `lib/auth.ts`.** `requireProfile()`, `canSeeFinance()`,
  `requireFinance()`, `requireOwner()`. Finance pages redirect non-finance roles.
  **Server Actions are reachable by direct POST**, so every mutating action must
  call a guard itself (not rely on page gating). Roles: `owner`, `accountant`
  (both see finance), `office`, `driver`.
- **Finance — `lib/finance.ts` `monthlyPL()` is the ONE P&L source of truth.**
  It reports **gross profit (revenue − fuel)** until real non-fuel costs exist,
  then **true net profit**. Reuse it; don't recompute P&L ad hoc.
- **Design system — `components/ui.tsx`** (`PageHeader`, `Section`, `StatCard`,
  `Card`, `Badge`, `EmptyState`), **`SegmentDonut.tsx`** (segmented ring + numbered
  badges; `money` prop formats KES), **`Bars.tsx`**. Neutral chrome, colour lives
  in the data. Nav + icons: `components/AppShell.tsx`, `components/NavIcon.tsx`.

### Gotchas (these have bitten before)
- **Tailwind v4 tree-shakes custom CSS classes** that are only referenced from
  `app/(app)/*` route-group files (the `(app)` path trips its scanner). A new
  class added to `globals.css` for one route-group page silently vanishes from
  the built CSS. **Fix: use inline styles** for page-specific styling, or make
  the class used from a scanned location. (`grid-2` survives because many pages
  use it; `grid-3` did not.)
- **Migrations: no DB connection string locally → no remote DDL.** Schema
  changes are `lib/migration-*.sql` files the **user runs in the Supabase SQL
  Editor**. Make dependent writes degrade gracefully (see `saveDriver` retrying
  without `monthly_wage`). `lib/schema.sql` + `lib/seed.sql` are the full schema.
- **Dates:** use local Y-M-D (`lib/format.ts` `isoDate`), never `toISOString()`
  for dates — Kenya is UTC+3 and `toISOString` shifts the day.
- **`MonthNav` month param is 0-indexed** (`m=4` = May).
- **Next 16 rename:** middleware is `proxy.ts`. The repo's `AGENTS.md`/poxi rule:
  *read the relevant guide in `node_modules/next/dist/docs/` before writing
  Next-specific code* — the conventions differ from older Next.

---

## 3. Current state (as of 2026-10-07, commit `b04db24`)

**Deployed & healthy.** Deploy with `npx vercel --prod --yes` (Vercel project
`absolute-comfort`, account `carltonkemoli-5263`; aliased to absolute-comfort-two).
Live Supabase project ref `llnlibisacilgurpjydn` (eu-north-1, FREE/NANO, ~29 MB used).

Live data:
- **1,531 trips**, Jan–Jun 2026 (contractors BCD / FCM / Sandyshores; client orgs).
- **496 real M-Pesa fuel entries** (Jan–Jul); fuel is company-wide, **not** per car.
- **0 expenses**, **7 drivers** (wages all 0), **9 owned vehicles**.
- **Trip→vehicle/driver attribution was CLEARED** (it had been synthetic
  round-robin). So per-vehicle / per-driver views and Vehicle Payback start
  **empty on live** and fill in as trips are tagged. All migrations applied,
  including `drivers.monthly_wage`.

Last major update delivered three tracks: **true profit tracking** (shared P&L +
Expenses wages/“copy last month”/quick-add), **per-vehicle & driver truth**
(inline trip attribution with coverage, Payback re-enabled with fuel allocated by
revenue share), and **unified design** (Section band + SegmentDonuts on
dashboard/expenses/payback/goals).

---

## 4. Good next tasks

1. **Finish the design rollout** (the biggest open item). The new look is on the
   dashboard, Expenses, Payback, Goals. Bring `Section` grouping + `SegmentDonut`
   where a part-to-whole helps onto: **Clients, Fuel, Receivables, Expressway,
   Reports**, then the CRUD pages (Vehicles, Routes, Services, Compliance,
   Dispatch, Data-health, Settings). Verify each in DEV_MODE preview.
2. **Load recent months of trips** (Jul–Oct 2026) when the user supplies the BCD/
   FCM/Sandyshores Excel files. Reusable loader pattern: parse with exceljs,
   contractor = sheet-name prefix, status `completed`, swap out-of-month dates,
   dedupe, batch POST 100/req via the service key. (Data op, needs the key.)
3. **Bulk trip-attribution helper** on the Trips page (e.g. “assign all unassigned
   this month to …”) to speed up building real per-car data.
4. **Recurring-cost templates** on Expenses beyond driver wages (insurance,
   licensing) so monthly net profit needs minimal data entry.
5. Optional, previously deferred: **PWA installability** (add-to-home-screen,
   icon, offline-friendly) for phone use.

## 5. Safety

This is a **production app the owner uses**. Don't break it. Prefer DEV_MODE for
all development. Any destructive live-DB operation (deletes, overwriting
attribution) should be confirmed with the user and **backed up first** (see the
attribution-backup pattern used when clearing synthetic data).

## 6. Cloud integrity continuation (9 November 2026)

Continued locally from `fb57a51`; see `docs/SECURITY_AND_INTEGRITY.md` for the role audit, staging rollout and verification, and `docs/WEBSITE_ENQUIRY_HANDOFF.md` for the separate Site integration design. Run `lib/audit-preflight.sql` and then the new `lib/migration-integrity.sql` in staging before deploying the changed app. No live data or deployed app was changed. The migration must run after historical migrations, including company/invoice links. Tests use only synthetic data.

## 7. Workspace continuation (10 November 2026)

The new Odoo-inspired blue/lime workspace is implemented locally on this branch. The finance Dashboard now has a distinct management view with current month performance, all-date collection position, three work queues, honest empty-month guidance and the same refreshed logo as the public website. It also adds a searchable Apps launcher and module navigation; a Nairobi-time daily workboard; dispatch board/list with status search; trip filters, locally saved filter views and safe filtered CSV export; receivables filters; a role-scoped record finder and attention centre; and connected vehicle/client record pages. The office persona opens on Workday. The fleet page now keeps purchase, hire-fee and loan data out of office-rendered props, and vehicle mutation actions recheck role on the server. `app/operations-depth.css` adds restrained layered cards and reduced-motion support.

Website owner-private version 5 is published separately at https://absolute-comfort-travel.creambluff4.chatgpt.site. It includes a dimensional vehicle stage, comparison, a journey planner with optional tentative calendar download, a searchable travel-guide index, and three **sample-only** interactive marketplace designs at `/marketplace-preview`. There are still no live public partner listings or cross-system handoff. Continue with `docs/WEBSITE_ENQUIRY_HANDOFF.md` and rehearse that design in staging with synthetic enquiries before wiring production.

Validate locally with `NEXT_PUBLIC_DEV_MODE=true npm run build`, `node tests/new-workspaces.cjs`, the other `tests/*.cjs`, and the disposable PostgreSQL integrity suite in `tests/integrity.py`. Browser QA covered desktop/mobile Dashboard, Workday, dispatch conflicts, role visibility and record pages with synthetic data. No production Supabase migration or Vercel deployment has been made for this branch. The live Vercel app still shows the old Dashboard. Apply the pending SQL in staging, inspect role access and existing rows, then deploy the operations app only after the staged database and code agree. This workspace has no usable GitHub token or Vercel CLI authentication, so the internal branch commits are local until deployment access is connected. The local `.devdata.json` is ignored by Git.

## 8. Release continuation (10 November 2026)

The remote `claude/design-rollout-crud-pages` branch advanced to `34e4273` with a `HANDOFF.md`; it was merged locally. A 25-route, two-viewport browser sweep found mobile horizontal overflow on Services, Clients and Goals. The chart legend and responsive grid were corrected; repeat the sweep after a fresh production build and preview restart.

Server-action audit found unguarded direct writes on fuel, route rates/import, servicing, compliance, settings lookups and trip import. Guards now run in those actions; route editing is finance-only in the UI and office users keep a read-only rate card. Driver writes require operations access, and non-finance requests cannot alter monthly wages. Save failures now surface in those actions, expenses and target upserts. Creating a user validates the requested role and rolls back a newly created login if the role update fails. Verify these changes in a fresh demo preview, then stage them before production.

GitHub and Vercel plugins were suggested through the Plugin Management UI on 10 November, but suggestions are not account connections. This workspace still has no usable GitHub push authentication, Vercel deployment authentication or production database credentials. Do not describe the local redesign as live. The public Site is owner-private version 5 at https://absolute-comfort-travel.creambluff4.chatgpt.site. Stage the SQL from `docs/SECURITY_AND_INTEGRITY.md` and verify with synthetic enquiries before enabling the separate website-to-system handoff.

Final synthetic QA: `tests/*.cjs`, `npm run lint` (zero errors and warnings), and `NEXT_PUBLIC_DEV_MODE=true npm run build` all passed. The fresh production preview passed 25 routes at 1440px and 390px with no browser errors or horizontal overflow. Owner sees rate and wage editing, while office sees rates read-only and no wage values. A captured route-save Server Action request was replayed with an office session and returned 500 without creating another route; the demo store was restored after this check. Theme switching persisted through a page reload and returned to light mode cleanly. Rerun checks if code changes after this point.

## 9. Accounting and journey rhythm continuation (12 November 2026)

See `docs/ACCOUNTING_READINESS.md` for the current reporting contract and its
limits. Completed trips alone now earn revenue; pass-through expressway charges
are removed from fare revenue and profit; receipt updates reject stale or
overpaid totals; invoice creation requires completed trips. Dashboard, Insights,
Reports, Fuel and Targets use consistent earned-revenue and margin logic. Data
Health exposes more missing-data checks. The Dashboard adds a linked month-of-
journeys view. Synthetic Node and PostgreSQL tests, lint and build passed. The
Supabase project was reported inactive, so the live database and numbers could
not be verified and no migration was applied there.

The separate Site source at `/workspace/work/website-source` now includes an
interactive journey-brief section for airport, business and group requests.
Its Site remains owner-private; no public marketplace listings were created.
