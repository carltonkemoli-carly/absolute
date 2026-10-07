# Absolute Comfort Travel — Audit & Revamp Brief

A brief for a fresh session. The goal is **not** a feature. It is to find out
whether the system that got built from the owner's ideas is actually coherent:
does information move logically, can a person understand it, are we pulling the
right data, and what are we quietly assuming?

Read `CLOUD_SESSION.md` first for the cold-start context (stack, DEV_MODE,
architecture, gotchas). This brief assumes it.

**Run this in two phases. Do not start Phase 2 until I have read Phase 1 and
told you what to build.**

---

## Phase 1 — Audit (read-only)

Produce `AUDIT_FINDINGS.md`. Change no application code in this phase.

### Ground rules

1. **Evidence, not impressions.** Every finding cites `file:line` and says what
   the code actually does. "This feels cluttered" is not a finding; "the Fleet
   page shows four cost figures that come from three different time windows
   (`app/(app)/vehicles/page.tsx:44-48`)" is.
2. **Separate the finding from the fix.** State what is wrong and why it
   matters to the owner, *then* a proposed change. I decide what gets built.
3. **Demo data lies.** `.devdata.json` is a tidy, complete sample. Live is not:
   per `CLOUD_SESSION.md` it has **0 expenses**, **7 drivers with wages all 0**,
   fuel that is **company-wide rather than per-car**, and **trip→vehicle/driver
   attribution deliberately cleared**. For every screen, ask: *what does this
   look like on live data?* A page that sings in demo and is empty or
   misleading on live is a finding, and probably the most important kind.
4. **Say when you don't know.** Where a question can only be answered by the
   owner (how the business really works), write it as a question for her, not a
   guess. Collect these in a "Questions only the owner can answer" section.
5. **Don't touch live data.** DEV_MODE only. No Supabase keys needed.
6. Verify in the preview as you go; check both demo personas (CEO owner and
   Rachel office) via the sidebar switch, since finance gating changes the app.

### Lens A — Does information move logically?

Trace the real business process end to end and map it onto the screens:

> a job arrives from a contractor (BCD / FCM / direct) → it is assigned a driver
> and vehicle → dispatched and confirmed → driven → completed → invoiced to the
> contractor → paid → it shows up in profit.

For each hop: which screen owns it, what the user must do, how many clicks and
page changes it takes, and where the chain breaks or doubles back. Flag any step
that exists in the data model but has no screen, and any screen that doesn't
serve a step. Specifically check whether the nav grouping
(`components/AppShell.tsx`: Overview / Operations / Fleet / Finance, ~16 items)
matches that flow or cuts across it.

### Lens B — Can someone understand it?

The primary user is the owner — non-technical, runs a Nairobi travel agency, will
often be on a phone. Rachel (office role) and drivers are secondary.

- Does every number say what it means without the reader needing to know the
  code? Where a label is ambiguous ("Outstanding", "Net profit", "Index"), say so.
- Is the vocabulary consistent? The app uses several status vocabularies —
  trip status (`booked/assigned/dispatched/confirmed/enroute/completed/cancelled`)
  vs the 5-stage dispatch `FLOW` labels vs the badges on Trips. Do they agree?
- Empty, loading and error states: what does a brand-new or sparse page say?
- What would confuse someone on their first day with no training?

### Lens C — Are we pulling the wrong data?

For every headline number on every page, verify the query behind it and answer:
does the label match the computation, and is the time window the one implied?

- Is `monthlyPL()` (`lib/finance.ts`) genuinely the single source of truth, or do
  pages recompute revenue/profit their own way?
- Does each page's date range mean what the UI says ("this month", "this year",
  "all-time")? `MonthNav`'s month param is 0-indexed — check every caller.
- Are there all-time scans that will not hold up as trips grow (e.g. the Clients
  page reads `listTrips('2000-01-01', today)`)?
- Does anything double-count — a trip billed twice, expressway counted as both
  revenue and cost, an invoice generated twice for the same contractor-month?

### Lens D — What are we assuming?

This is the heart of it. Hunt for judgements baked into code that were never
stated as decisions, and name each one plainly so the owner can agree or reject.
Seed list — **verify each, don't take any of them as true**:

- **Payback allocates fuel per vehicle by revenue share**, yet fuel is recorded
  company-wide. Is per-vehicle payback meaningful, or is it inventing precision?
- **Profit labelling.** `monthlyPL()` reports gross (revenue − fuel) until real
  costs exist, then switches to net. With live wages at 0 and 0 expenses, is
  anything on screen calling a number "net profit" when it isn't?
- **Expressway charges** are treated as reimbursable and excluded from
  `netRevenue`. Is that consistent on every surface that shows revenue?
- **Data health defines "good data"** (`app/(app)/data-health/page.tsx`). Are
  those the right checks, or do they encode an assumption about how she works?
- **Invoicing is per contractor per month.** Does the business ever bill a client
  org directly, or part-month, or per-trip?
- **The rate card vs what is actually billed.** Nothing appears to reconcile a
  trip's `amount` against the route's price for that vehicle class. Should it?
- **Driver wages are monthly and fixed.** Is that how drivers are really paid?

### Lens E — Look and feel

The current direction is: neutral chrome, colour only in the data, `Section`
bands grouping cards, `StatCard` rows, `SegmentDonut` for part-to-whole
(`components/ui.tsx`, `components/SegmentDonut.tsx`). It is now applied across
every page. Assess it as a system, not page by page:

- Hierarchy: on each page, is the most important thing the most prominent thing?
- Density and rhythm: consistent spacing, type scale, card sizes.
- Phone first: she will use this on a phone. Test at 390px. Tables with 9
  columns are the obvious suspect.
- Dark mode parity, and contrast against WCAG AA.
- Where the design system is being worked around with one-off inline styles that
  should become shared components.
- Note the Tailwind v4 gotcha in `CLOUD_SESSION.md`: custom classes referenced
  only from `app/(app)/*` get tree-shaken out. Propose nothing that depends on
  new global classes without checking they survive the build.

### Deliverable

`AUDIT_FINDINGS.md` containing:

1. **Verdict** — a short, honest paragraph. Is the system coherent or not?
2. **Findings**, grouped by lens, each with: what, where (`file:line`), why it
   matters to the owner, severity (high / medium / low), proposed change.
3. **The flow map** from Lens A — the business process against the screens.
4. **Assumptions register** — every assumption found, stated in one plain line
   each, marked *safe* / *risky* / *needs the owner's call*.
5. **Questions only the owner can answer.**
6. **A revamp proposal, sequenced** — what to change first for the most benefit,
   what is cosmetic, what is structural, and an honest estimate of what each
   would disturb.

Rank ruthlessly. Ten findings that matter beat sixty that are true but trivial.

---

## Phase 2 — Revamp (only after I choose)

I will pick from the proposal. Then: smallest coherent changes first, verified in
the DEV_MODE preview one screen at a time, `npm run build` before finishing, and
`npm run lint` checked separately — the build does **not** run ESLint in Next 16,
contrary to `CLOUD_SESSION.md`. The repo currently has 21 pre-existing lint
problems; don't add to them.

Never rename or restructure a stored field to suit the UI without saying so
first — this is a production app the owner uses daily.
