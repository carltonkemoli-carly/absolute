# Accounting readiness — 12 November 2026

The operations system is useful for dispatch, trip records, quotes, invoicing and
follow-up. Its P&L is a **management estimate based on recorded data**, not an
audited set of company accounts. Do not use it as the sole basis for tax filing,
cash reconciliation or a claim of final net profit.

## Reporting contract now used throughout the app

- A trip enters earned revenue when its status is `completed`. Booked,
  assigned, in-progress and cancelled trips stay operational, outside P&L.
- Gross billings include trip fares and client expressway charges. Fare revenue
  excludes the expressway pass-through. Reported profit equals **fare revenue
  less recorded fuel, wages, other expenses, servicing and partner-vehicle
  hire**. Margin and fuel-to-sales use fare revenue as their denominator.
- An invoice can link only completed, unbilled trips belonging to its
  contractor and period. The database RPC creates the invoice and links its
  trips in one transaction. Payment updates reject overpayment and stale
  concurrent forms. The SQL migration must be applied in staging before these
  guarantees are relied on outside demo mode.
- Dashboard, Insights, Reports and Targets & P&L use the same P&L engine.
  The Targets screen shows the expressway pass-through explicitly so its profit
  total agrees with the other screens. Data Health flags missing fare, missing
  casual-hire cost, invoice anomalies and months with no wages recorded.

## Still required for accounting-grade numbers

1. Restore or connect the live Supabase project, then run the read-only
   preflight audit in staging. The project was reported `INACTIVE` by the
   connected Supabase service on 11 November; live balances and roles were not
   independently verified in this session.
2. Load and reconcile recent trips, invoices and all costs. The prior handoff
   described historical imported trips and fuel but zero expense entries and
   zero recorded wages. Those counts are historical notes, not current verified
   live figures.
3. Record individual payment events with date, method and reference, and
   reconcile them with bank/M-Pesa statements. The current invoice row stores
   only a cumulative `amount_paid`, so it cannot prove every receipt or refund.
4. Preserve issued invoice line amounts or a versioned snapshot. Linked trips
   can be edited later, leaving their current value different from the issued
   invoice total. Decide on credit-note/correction rules before production use.
5. Establish monthly close checks for contractor hire invoices, payroll,
   servicing, insurance, overhead, tolls and cash receipts. The UI labels the
   result as profit *after recorded costs* because no software can infer costs
   that were never entered.

## Verification

Synthetic Node tests cover earned revenue, toll pass-through, repeated monthly
hire, invoice selection, and payment concurrency. The disposable PostgreSQL
suite checks RLS, atomic invoice linking, payment bounds, direct-edit dispatch
protection and concurrent overlap rejection. No production rows were modified.
