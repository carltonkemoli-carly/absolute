# Local security and integrity review — 9 November 2026

Base: `carltonkemoli-carly/absolute`, `claude/design-rollout-crud-pages`, `fb57a51`.
Read `CLOUD_SESSION.md`, prior audit files, and the current conversation. The earlier shared ChatGPT URL did not expose its conversation text; no claim is made to have read that inaccessible history.

No live Supabase configuration is present. Findings concern tracked schema/migrations and source, not an inspection of production policies or users. All SQL verification uses a disposable PostgreSQL 17 database with synthetic identities and a minimal emulation of Supabase `auth.uid()`; verify actual Supabase grants/configuration in staging before rollout.

## Role audit

| Area | Finding | Change / remaining work |
| --- | --- | --- |
| Missing profile | App previously fabricated an office profile | Fail closed when staff profile is missing |
| Profiles | Self-update policy permits changing `role` | Trigger rejects non-owner role changes; self name changes remain allowed |
| Finance | Any authenticated user can query or mutate invoices, expenses, targets despite page guards | Replace all policies on these tables with owner/accountant RLS |
| Operational tables | Driver role has global read/write access; no authenticated-user → driver mapping | RLS limits operational access to owner/accountant/office; trip/dispatch actions also check staff role |
| Company | Any staff member can change company details directly | Staff read, owner write |
| Mixed records | Office can see wages, purchase prices, trip fares, fuel/service costs in operational records | Still accessible by current workflow design. RLS is row-based; column-level projections/grants or separate finance tables are needed for a finance-blind office role |
| Registration | First signup becomes owner; later signups become office | Disable public registration and verify invite-only settings in Supabase staging. No remote setting was changed. Owner bootstrap must be controlled, never exposed on a fresh public instance |
| Service role | User management uses service-role credentials, bypassing RLS | Keep server-only; review hosting secret access and owner guards in staging |
| Policy history | Historical schema and migrations contain permissive policies | Run integrity migration last; reapplying old policies can weaken access. Fresh installs also require this final migration |

Do not grant driver accounts access until scoped driver ownership and an appropriate driver view exist. Site ChatGPT users and Supabase staff are separate identities; never equate the two by client-supplied email.

## Invoice implementation

`create_invoice_for_trips(jsonb, uuid[])` uses the caller's identity and RLS, requires finance role, validates the complete selection, locks trip rows in ID order, recomputes totals from database rows, creates the invoice, and links every selected trip in one transaction. Invalid, missing, foreign-contractor, out-of-period, or already billed selections fail together. Unique contractor/period index prevents concurrent duplicates. The app fails closed if the RPC is not installed. Invoice deletion uses the existing `ON DELETE SET NULL` foreign key rather than separate unlink/delete requests.

Preview remains advisory. Trips added after an invoice is created are not included automatically. Existing manual invoice edits, deletion of billed trips, and later edits to billed trip amounts are not a versioned accounting ledger; locking/finalizing invoices and immutable issued line-item snapshots remain separate accounting work.

## Dispatch implementation

GiST exclusion constraints enforce driver and vehicle reservation overlaps on every INSERT/UPDATE, including direct API calls, imports, changing dates, status reactivation, and simultaneous requests. Cancelled trips reserve nothing. Completed trips retain their historical window. Booked trips with resource attribution reserve it; unassigning through Dispatch clears resources. Adjacent windows are allowed.

Provisional assumption: known pickup reserves two hours; unknown pickup reserves the whole Nairobi local calendar day. Cross-midnight jobs reserve across dates. This is a conservative first rule, not route duration modelling. Add explicit start/end instants plus turnaround buffers for long hires and real journey lengths before treating availability as comprehensive. Existing route `duration_min` is not a reliable booked journey duration.

Demo data-layer writes mirror the rule, including validating entire batches before insertion. The file-backed demo is for one local process and does not provide cross-process database locking. Production concurrency guarantees come from PostgreSQL, verified independently.

## Staging rollout

1. Back up staging; run `lib/audit-preflight.sql` with an administrative connection. Review roles, RLS, duplicate contractor/period invoices, malformed pickup times, and resource conflicts. Resolve legacy conflicts explicitly; migration never deletes or rewrites history.
2. Apply existing migrations including company and invoice links, then `lib/migration-integrity.sql` once. DDL is transactional and aborts if existing periods or reservations conflict. Do not apply old permissive policies afterward.
3. Use separate synthetic owner/accountant/office/driver accounts and actual Supabase JWTs to repeat role checks through REST and the app, including missing profiles and denied driver access. Check grants, public signup settings, and existing owner list.
4. Deploy the app to staging only after SQL is installed. Check that missing RPC returns failure rather than creating an unlinked invoice. Test concurrent billing/assignment, failures, and visible assignment errors.
5. Review the provisional two-hour window and office access to mixed financial fields before production rollout. No production deployment or SQL was performed in this session.

## Verification

- `python tests/integrity.py`: isolated PostgreSQL integration checks for role escalation, RLS, totals, atomic rollback on link failure, FK release, concurrent billing, driver/vehicle overlaps, date boundaries, cancellation, direct edits, and concurrent dispatch.
- `node tests/demo-integrity.cjs`: actual data-layer demo code with isolated synthetic store, including batch rollback and duplicate billing.
- Browser QA: Chromium on local production build, synthetic overlapping assignment displays a server error; office demo cannot open Receivables.
- `NEXT_PUBLIC_DEV_MODE=true npm run build`: production compilation and TypeScript check. This project's Next build does not automatically run ESLint despite the older handoff claim.

The Python test creates and drops a database in the explicitly named local Docker PostgreSQL container. It takes no remote connection string. Create the local container with `docker run --name absolute-test-db -e POSTGRES_PASSWORD=synthetic-local-only -d postgres:17`; run tests as the normal workspace user.
