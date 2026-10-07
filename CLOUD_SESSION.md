# Absolute Comfort Travel — Session Handoff

Internal **operations & finance system** for Absolute Comfort Travel, a Nairobi
travel agency (point-A-to-B client transport, mostly JKIA airport transfers).
Built for the owner (the user's mom). It is an internal office tool — **no public
/ booking site**. This file is the cold-start brief for a new (e.g. cloud) session.

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
