# Audit findings — Absolute Comfort Travel

Phase 1 of `AUDIT_BRIEF.md`. Read-only: no application code was changed.
Every finding was traced in the code; the ones marked **demonstrated** were
reproduced in the DEV_MODE preview against data shaped like live.

---

## 1. Verdict

**The operations half of this system is sound. The finance half is not, and the
problem is not presentation — it is that the most prominent number in the app is
wrong in a way that flatters the business.**

What was built well is genuinely well built. The job→assign→dispatch→confirm→
complete chain is real and maps cleanly onto Dispatch. The Trips page puts
vehicle/driver attribution inline, exactly where the gap is visible, which is the
right place for it. Payback refuses to invent numbers when attribution is
missing, and says so in plain words. That is better judgement than most systems
of this kind show.

The finance side tells a different story. There is a documented rule — one P&L,
in `lib/finance.ts` — and three of the four finance screens quietly ignore it,
each reimplementing the same arithmetic slightly differently. On top of that, the
gross/net honesty switch is triggered by the *presence* of any cost rather than
the *completeness* of costs, so a few thousand shillings of casual hire is enough
to make the app announce a net profit margin of 85% while driver wages, insurance
and licensing are not recorded anywhere.

So: the ideas are good and the operational model is right. What is missing is a
single enforced definition of what a number means, and a habit of distinguishing
"this is zero" from "we don't know this yet". Most of the serious findings below
are versions of that one sentence.

---

## 2. Findings

Ranked. Severity is about consequence to the owner, not effort to fix.

### HIGH

---

**C1 · "Net profit" is claimed on the strength of a single incidental cost — demonstrated**

`lib/finance.ts:48` — `hasCosts = expenses + servicing + hire > 0`, and `hire`
includes per-trip casual hire. Any one of those being non-zero flips every
headline from "Gross profit" to "Net profit".

Reproduced with live-shaped data (0 expenses, driver wages 0, no services, all
vehicles owned — the state `CLOUD_SESSION.md` describes). The dashboard headlined:

> **NET PROFIT · Ksh 151,264 · 85.1% margin · after fuel, wages, servicing & hire**

The only thing that flipped the switch was **KES 13,576 of casual trip hire**.
Wages, servicing and expenses were all zero — yet the hint explicitly asserts the
figure is "after fuel, wages, servicing & hire". Goals said the same thing while
displaying "Driver Wages Ksh 0" two lines below it.

An 85% net margin on a transport business is not plausible, and it is the first
number she sees. **Fix:** base the switch on completeness, not presence — require
wages to exist (or an explicit "costs complete for this month" flag) before
claiming net; otherwise keep "Gross profit" and name what is still missing.

---

**C2 · The single source of truth is documented but not enforced**

`CLOUD_SESSION.md` says `monthlyPL()` is the one P&L. Only the dashboard
(`app/(app)/page.tsx:36`) uses it. Three others reimplement it:

| Surface | Implementation | Gross/net switch |
|---|---|---|
| Dashboard | `lib/finance.ts` (canonical) | correct |
| Reports | `app/(app)/reports/page.tsx:29-57` | own copy, correct label |
| Insights | `app/(app)/insights/page.tsx:46-54` | own copy, self-contradictory |
| Targets & P&L | `app/(app)/goals/page.tsx:27-40` | **no switch at all** |

Consequences, all visible on screen:

- **Goals hardcodes "Net profit"** (`goals/GoalsView.tsx:41,59,67,103,127`). For a
  period with no logged costs, Goals says "Net profit" where the dashboard says
  "Gross profit" — for the same money.
- **Insights contradicts itself inside one card**: the heading reads "Revenue &
  net profit — last 6 months" while every row reads "gross Ksh …"
  (`insights/InsightsView.tsx:41` vs `:50`, where "gross" is hardcoded) and the
  footnote reads "net profit (after all logged costs)".
- **Insights' own cost card disagrees with its own profit figure**: "Costs logged
  Ksh 13,000 · fuel + expenses" (`InsightsView.tsx:36`) omits the KES 13,576 of
  hire that the net profit beside it has already subtracted.

**Fix:** delete the three copies, route everything through `monthlyPL`, and let
`profitHeadline()` own the wording.

---

**C3 · Vehicle payback systematically understates every tagged car — demonstrated**

`app/(app)/payback/page.tsx:48`:

```ts
const fuelC = totalAttrRevenue > 0 ? companyFuel * (revenue / totalAttrRevenue) : 0
```

Fuel is company-wide, so it is shared out by each car's share of **attributed**
revenue. That means **100% of the company fuel bill is loaded onto whatever
fraction of trips has been tagged so far.**

Measured at 25% attribution coverage:

| | KES |
|---|---|
| Company fuel, all time | 349,000 |
| Charged to the two tagged cars | **349,000** |
| Their fair share (25% of revenue) | **69,085** |
| Overstatement of their fuel cost | **279,915 (5×)** |

On screen those cars then showed "38% recovered" and "Projected payback
15 Jul 2031" — a percentage and a date presented as facts, both resting on a
contribution figure understated by roughly 280,000.

This matters most *exactly when she starts tagging trips*, which the app actively
encourages. The coverage banner does warn the data is partial, but frames it as
imprecision — "the more trips you tag, the sharper these get" — when it is a
one-directional understatement that makes cars look unprofitable. A decision to
sell a car could follow from it.

**Fix:** divide by total revenue, not attributed revenue, so unattributed fuel
stays unallocated rather than being pushed onto the tagged cars.

---

**C4 · The same invoice can be raised twice**

`app/(app)/receivables/actions.ts:43` `generateInvoiceFromTrips` has no duplicate
check — it inserts a new invoice on every call. Pressing "Generate from trips"
twice for the same contractor and month produces two invoices for the same work,
and the dashboard's Outstanding and Overdue both double.

**Fix:** look for an existing invoice on (contractor, period) and refuse or offer
to replace.

---

**C5 · Invoices are not linked to the trips they bill**

An invoice stores `contractor_id`, `period_start`, `period_end` and a total —
never which trips it covers. Therefore the system cannot answer "which trips have
been billed?", cannot flag a trip added after its month was invoiced (it is
silently never billed), and cannot detect C4 above.

It also forces guesswork elsewhere: the Expressway page decides whether tolls were
reimbursed by checking whether *any* invoice period overlaps the month
(`app/(app)/expressway/page.tsx:96`) and prints "billed" on that basis.

**Fix:** record the trip ids on the invoice, or stamp `invoice_id` on each trip.
This is the one structural change on the list.

---

**C6 · Last month's profit changes when you hire a vehicle today**

Monthly-hire fees are read from the **current** fleet and applied to **every**
month being displayed (`lib/finance.ts:46`, `reports/page.tsx:26,41`,
`goals/page.tsx:36`). Vehicles have no hire start or end date, so the system has
no way to know when a hired vehicle joined.

Hire a KES 60,000/month vehicle today and all six months on the Reports page
retroactively lose 60,000 of profit. Historical figures are therefore not stable,
which undermines every trend on that page.

**Fix:** give hired vehicles a start (and end) date and only charge the months
they covered.

---

**D1 · Role separation is a UI illusion**

`lib/schema.sql:349-351` grants every table to any signed-in user:
`for all to authenticated using (true) with check (true)`. So the only real
access control is the app-level guard in each server action — and
`CLOUD_SESSION.md` states that rule explicitly ("Server Actions are reachable by
direct POST… every mutating action must call a guard itself").

It is followed in one place and skipped in roughly fifteen:

- **Properly guarded:** `expenses/actions.ts` (all four, `requireFinance`),
  `settings/user-actions.ts` and `settings/company-actions.ts` (owner checks),
  `trips/actions.ts` and `drivers/actions.ts` (`requireProfile`, deliberate).
- **No guard at all:** every action in `receivables/actions.ts` — including
  `markPaid`, `recordPayment` and `deleteInvoice` — plus `goals/saveTargets`,
  `dispatch/setTripStatus`, and all of services, compliance, fuel, vehicles,
  routes, settings contractors/orgs, both importers, and `backup/actions.ts`
  (which pushes the whole database to an external webhook).
- **Under-guarded:** `dispatch/clearPendingTrips` deletes *every* unassigned trip
  in the database and asks only for `requireProfile()` — a driver account can
  wipe the import backlog.

Receivables is the sharp end: an office user is redirected away from the page in
the UI but can still mark invoices paid or delete them by posting to the action
directly. **Fix:** `requireFinance()` on everything in receivables and goals,
`requireOwner()` on `clearPendingTrips` and `backupToSheetNow`, `requireProfile()`
on the rest.

---

### MEDIUM

**C7 · Mixed time windows in one row.** The dashboard's stat row is five
month-scoped cards plus "Outstanding", which sums **all invoices ever**
(`app/(app)/page.tsx:45-46`). Changing the month changes five of the six.

**C8 · A partial month is compared against a full one, in red.** Insights shows
"▼71% vs last month" because 7 days of October are being measured against all of
September. This will be alarming and wrong for most of every month.

**C9 · Silent 1000-row truncation.** `trips`, `fuel` and `expenses` page properly
via `fetchAll`, but `listServices`, `listInvoices`, `listDocuments` and
`listRoutes` use single-shot `.select('*')` (`lib/db.ts:140-172`). PostgREST caps
at 1000 and the truncation is invisible — the data just quietly goes missing.

**C10 · All-time scans on every page load.** Clients and Payback each read every
trip ever (`listTrips('2000-01-01', today)`) with `force-dynamic` and no caching.
Fine at 1,531 trips; it degrades steadily from here.

**D2 · The office role sees the money it is blocked from analysing.** Rachel is
redirected off Receivables and Insights, yet the Trips page header greets her with
"Ksh 177,840 billed · Ksh 162,720 net fare" and every individual fare. Either the
role is meant to be finance-blind (and this leaks) or it is not (and the redirects
are theatre). Needs your decision — see §5.

**B1 · Eight finance pages with overlapping jobs.** Insights, Clients,
Receivables, Expressway, Expenses, Targets & P&L, Vehicle payback, Reports. At
least three answer "how are we doing?" in different shapes. Nineteen nav items in
total.

**B2 · Zero reads as achievement.** Goals shows "Driver Wages Ksh 0 / Ksh 150,000
· 0%" with a green bar — indistinguishable from genuinely controlling costs, when
in fact nothing is recorded. The same confusion drives C1.

**A1 · Quote is a dead end.** `Quote a fare` produces copyable text with no path
to create a booking, so the first step of the business chain doesn't connect to
the second.

**A3 · Invoicing isn't part of the chain.** Nothing on a trip records that it has
been billed, so "which work is still unbilled?" can't be answered from the system
— a direct consequence of C5.

---

### LOW

- **B3** Payback shows "0% recovered" on untagged cars, which reads as a verdict
  on the vehicle rather than absent data.
- **B4** Payback's "Data window 1 mo" when 1,218 trips exist but none are tagged —
  it is reporting the fallback, not the data.
- **B5** Two status vocabularies: the stored trip status
  (`booked/assigned/dispatched/confirmed/enroute/completed/cancelled`) and the
  5-stage dispatch `FLOW` labels, which don't map one-to-one.
- **A2** Vehicle/driver assignment exists on both Dispatch and Trips.
- **A4** The office role has no landing page — `/` redirects it to Trips.
- **E1** Look and feel is now consistent after the recent rollout. Remaining gaps:
  tables of up to 9 columns on a 390px phone, `StatCard` clipping long values at
  narrow widths (visible on the dashboard as "Ksh 1,770,00C"), and the 19-item nav.

---

## 3. The flow map

How the business actually runs, against what the system does:

| Step | Screen | State |
|---|---|---|
| Job arrives (contractor sheet or phone) | Trips import · Dispatch queue | Works. Excel import is strong. |
| Quote a fare | Quote | **Dead end** — no path to a booking (A1) |
| Assign driver + vehicle | Dispatch · also Trips | Works; duplicated in two places (A2) |
| Dispatch & confirm with driver | Dispatch | Works — WhatsApp/SMS/call built in |
| Trip runs, completes | Dispatch | Works |
| Attribute trip to car/driver | Trips (inline) | Works, and well placed |
| **Invoice the contractor** | Receivables | **Weakest link** — unlinked to trips (C5), duplicable (C4) |
| Record payment | Receivables | Works |
| Know the profit | Dashboard / Insights / Reports / Goals | **Four answers, not one** (C2), mislabelled (C1) |

The chain is whole from job to cash *except* at invoicing, which is where it
stops being a system and becomes bookkeeping by memory.

---

## 4. Assumptions register

| # | Assumption | Where | Verdict |
|---|---|---|---|
| 1 | A trip's `amount` **includes** the expressway toll | `trips/page.tsx:40`, `finance.ts:57` | **Needs your call** — depends on the contractor's sheet |
| 2 | Any logged cost means all costs are logged | `finance.ts:48` | **Risky** — drives C1 |
| 3 | Company fuel divides fairly by attributed revenue | `payback/page.tsx:48` | **Risky** — wrong denominator (C3) |
| 4 | Today's hired fleet was hired all year | `finance.ts:46` + others | **Risky** (C6) |
| 5 | A car keeps earning at its recorded monthly average, forever | `payback/page.tsx:57` | **Needs your call** — drives payback dates from as little as one month of data |
| 6 | Loan repayments started at purchase and were never missed | `payback/page.tsx:72` | **Needs your call** |
| 7 | An overlapping invoice period means the tolls were reimbursed | `expressway/page.tsx:96` | **Risky** (C5) |
| 8 | A trip is to/from the airport if the text matches `/jkia/i` | `expressway/page.tsx:79` | **Safe-ish** — fails on "Airport", "J.K.I.A" |
| 9 | Each distinct toll amount is a station band | `expressway/page.tsx:106` | **Safe** — labelled as a proxy |
| 10 | One invoice = one contractor, one whole month | `receivables/actions.ts:43` | **Needs your call** |
| 11 | Drivers are paid a fixed monthly wage | `expenses` wage posting | **Needs your call** |
| 12 | Every signed-in user may read and write everything | `schema.sql:349` | **Risky** (D1) |

---

## 5. Questions only you can answer

1. **Does the "Amount" on a contractor's sheet already include the expressway
   toll?** Every "net fare" figure in the app depends on this, and it cannot be
   checked from the code. If some contractors include it and others don't, the
   import needs to know which.
2. **What should "office" mean?** Should Rachel be unable to see revenue at all,
   or just not have the analysis pages? Today she sees every fare on Trips.
3. **Is an invoice always one contractor for one whole month?** Or do you ever
   bill part of a month, a single trip, or a client organisation directly?
4. **How are drivers actually paid** — fixed monthly, per trip, per day, or a mix?
   The wage feature assumes fixed monthly.
5. **Which costs do you want counted as "real" before the app says "net profit"?**
   Wages only? Wages + insurance + licensing? This decides the C1 fix.
6. **Do you want per-car profitability at all**, given fuel is paid company-wide
   and can never be attributed to a car from an M-Pesa record? An honest
   alternative is per-car *revenue and utilisation*, with fuel kept at company
   level.
7. **Is anything reconciled against the rate card?** Nothing currently compares a
   trip's billed amount to the route's price for that vehicle class.

---

## 6. Proposed sequence

Ranked by benefit per unit of disturbance. Nothing here is started until you say so.

**First — make the numbers honest (small changes, highest value)**
1. C1 — stop claiming "net profit" until costs are actually complete.
2. C2 — route Reports, Insights and Goals through `monthlyPL`; delete the three
   copies. Fixes the self-contradicting Insights card as a side effect.
3. C3 — one-line denominator fix in Payback, and reword the coverage banner to say
   the figures understate rather than merely blur.
4. C7, C8 — scope Outstanding to the selected month; stop comparing a part-month
   to a whole one.

**Second — close the invoicing gap (structural, do it deliberately)**
5. C4 — duplicate guard on invoice generation.
6. C5 — link invoices to trips. Unlocks "what's unbilled?", kills the Expressway
   guess, and makes C4 impossible by construction.

**Third — lock the doors**
7. D1 — add the missing guards. Mechanical, about an hour, no visible change.
8. D2 — after you answer Q2, make the office role consistent.

**Fourth — correctness under growth**
9. C6 — hire start/end dates so history stops moving.
10. C9 — page the four unpaged reads.
11. C10 — stop scanning all trips on Clients and Payback.

**Fifth — the revamp proper (after the above, because it changes what pages exist)**
12. B1/A1/A2/A4 — consolidate eight finance pages into fewer, connect Quote to
    booking, pick one home for assignment, give office a landing page.
13. E1 — phone-first pass on the wide tables, fix `StatCard` clipping.

My recommendation: do **1–4 first**. They are small, they are contained, and until
they are done every other number in the system is being read against a headline
that isn't true.
