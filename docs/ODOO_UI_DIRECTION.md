# Operations UI direction — 10 November 2026

This is a design review, not a deployed redesign. Operations checkout: branch `claude/design-rollout-crud-pages`, HEAD `10ab6e7`. The separate marketing website and its Sites releases are not the internal operations system.

## Current status

The cloud continuation added role restrictions, an atomic invoice/trip-linking RPC, database-enforced dispatch reservations, and synthetic tests. The only direct UI change was the Dispatch assignment form: pending state, disabled submit and an inline server error (`app/(app)/dispatch/AssignForm.tsx`). The SQL migration and application changes have not been deployed to the live operations application. Staging migration remains a prerequisite.

The existing UI already has grouped persistent navigation (`components/AppShell.tsx`), shared headers/cards/section bands/badges (`components/ui.tsx`), responsive record tables (`components/DataTable.tsx`), trip search and inline attribution (`app/(app)/trips/TripManager.tsx`), a card-based dispatch workflow with a status stepper (`app/(app)/dispatch/DispatchBoard.tsx`), and receivables summaries/charts/forms (`app/(app)/receivables/ReceivablesView.tsx`). These are inherited capabilities, not all newly built in this session.

## Interpreting “Odoo Africa”

Use Odoo's record-focused ERP interaction model, adapted to this Nairobi office. Research found Odoo implementation partners serving African markets and official Odoo interface documentation; it did not establish a distinct official product named “Odoo Africa.” If the user has a particular vendor demo in mind, its URL can refine this direction without blocking the first pass.

The useful reference is a connected workspace with repeated patterns for list, form, search and kanban views. Changing colours alone will not produce that experience. Keep Absolute Comfort's own blue/lime identity rather than copying Odoo's purple or its branding.

Official references:

- https://www.odoo.com/documentation/19.0/applications/essentials/search.html — record search/filter/grouping patterns.
- https://www.odoo.com/documentation/19.0/applications/studio/views.html — list, form, search and kanban view roles.
- https://www.odoo.com/documentation/18.0/applications/studio/views.html — official stable view documentation also found in search results.

The reference facts above come from indexed official documentation. Direct page retrieval timed out during this review; no live Odoo demo was tested.

## Concrete changes

| Area | Current implementation | Proposed office-workspace pattern |
| --- | --- | --- |
| Navigation | More than twenty links in a grouped sidebar; desktop lacks a workspace top bar | Compact app switcher for Operations, Fleet, Finance, Contacts and Settings; persistent local navigation; visible user/role and route breadcrumb |
| Page actions | PageHeader supports title/subtitle/action, but forms each build their own action rows | Reusable control bar: breadcrumb/title, primary New action, search, active filters, view toggle, record count; keep creation and navigation controls in predictable positions |
| Trips | Free-text search plus a long table; no filter/group controls | Filter chips for status, contractor, driver, vehicle and date; clear active filters; list view with consistent column alignment; grouped records or cards when useful |
| Dispatch | Job cards contain a repeated five-step visual and different controls per state | Day-focused operations board with status columns; table view alongside board; one inspectable job detail surface; explicit transition buttons and conflict feedback |
| Receivables | Summary charts plus hand-written wide table; forms appear above the table | Invoice list with overdue/unpaid/part-paid/paid filters, customer grouping and direct open-record navigation; uniform invoice record header with status and finance-only actions |
| Forms | Create/edit forms expand inline, with inconsistent confirmation/pending/error handling | Shared record form surface with clear Save/Cancel, required-field labels, pending protection and visible errors; no silent failure; preserve entered values after rejection |
| Record relationships | IDs resolved into labels, but few connected-record links | Client record links to trips and invoices; vehicle record links to assigned jobs, servicing and compliance; count badges only where calculated from real data |
| Daily work | Finance dashboard redirects office staff to Trips | A proper office landing page: today's jobs, unassigned work, follow-ups and compliance attention; finance summaries remain role-gated |
| Mobile | DataTable changes to cards, but Receivables still uses a separate wide table | Use the same responsive record pattern everywhere; accessible navigation drawer; compact detail pages with actions within reach |

## Smallest useful first UI pass

1. Build the shared operations workspace shell and a reusable record control bar, retaining every existing guard and route.
2. Apply that pattern to Trips: status/contractor/assignment filters, active-filter chips, consistent result count, and a cleaner create/edit form surface.
3. Bring Dispatch and Receivables into the same header/action/form conventions, then add a Dispatch board/list switch once the foundation is coherent.

This provides a concrete first demo without adding a second app or rewriting the database. Start in DEV_MODE using synthetic data, test owner and office roles, and build before any staging deployment. Do not mix this reversible UI pass with applying the pending live SQL migration.

## Kenya-specific details

Keep KES explicit, Nairobi/EAT dates and times, and locally useful phone formatting. Preserve existing M-Pesa fuel receipt references; importing receipts is not an M-Pesa payment integration. Show real balances and coverage gaps rather than sample “success” metrics. Do not imply KRA eTIMS, automated M-Pesa collection, live fleet tracking or tax compliance integrations exist until they are built and verified.
