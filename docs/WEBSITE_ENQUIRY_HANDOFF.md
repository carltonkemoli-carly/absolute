# Website enquiry → quote → dispatch design

Integration design only: no live handoff or production data operation has been performed. The website and its private inbox are evolving separately from this operations app.

## Verified existing components

Website Site: `appgprj_6af1adf782b88191946001ed7287e6a2`, owner-private version 5, source `9b7af47412d667e5eb00389980c0108253efee94`.
Website: https://absolute-comfort-travel.creambluff4.chatgpt.site
Operations: https://absolute-comfort-two.vercel.app

Website source was inspected through its source repository; no real inbox rows were read. `POST /api/enquiries` validates vehicle/corporate requests, limits bodies to 8 KiB, checks same-origin when present, and inserts into D1 with client-generated UUID idempotency. `/team` requires ChatGPT sign-in plus `TEAM_EMAILS`; it now also has private partner-application review with explicit checks and an audit note. The owner-only Site access currently restricts the whole website; public launch is a separate access decision. The new `/plan` route copies a journey brief into the enquiry form, and `/marketplace-preview` is sample-only. Neither sends anything to operations.

D1 enquiry shape: `id`, `created_at`, `type` (vehicle/corporate), `name`, `email`, `phone`, `details` JSON. Vehicle details contain service, preferred website vehicle, passengers, pickup, destination, start/time/end, notes. Corporate details contain company and notes.

Operations `/quote` computes a rate-card fare, tolls, and extras and supports copy/WhatsApp sharing. It does not persist quotes, customer acceptance, or enquiry references. `/dispatch` works on trips and now enforces resource overlaps server-side in demo and through a staged SQL migration for Supabase. The integration needs saved quotes and an explicit acceptance-to-booking transaction; a copied quote alone cannot be an authoritative booking record.

## Boundary and flow

1. Public enquiry writes only to the website D1 inbox. Return the receipt after that local commit. Enquiries do not reserve fleet, create invoices, or prove customer acceptance.
2. Approved website staff select **Send to operations** on an enquiry. Recheck server-side ChatGPT identity and the staff allowlist on every mutation. The browser receives only the result; integration secrets never enter browser code, query strings, redirects, or local storage.
3. The Site server records an immutable handoff event in a D1 outbox in the same transaction as its queued status. A server-side delivery worker sends it over HTTPS to a dedicated operations endpoint. Public enquiry submission cannot choose the destination or invoke arbitrary operations endpoints.
4. Operations authenticates the service request, validates a strict versioned schema, then commits an incoming-enquiry record plus event receipt together. Return `202` only after durable commit. Duplicate identical events return the prior acknowledgement; conflicting reuse returns `409`.
5. Operations staff review the lead, normalize itinerary, pick an existing contractor/customer or create one under current staff controls, and use the existing rate-card calculator to prepare a saved draft quote. Corporate leads require itinerary collection first.
6. Staff issue an immutable quote revision with KES line items, expiry, route, dates and explicit terms. Record acceptance evidence manually at first (actor, time, channel, revision). Do not infer acceptance from a website submit, a quote link click, or a successful handoff.
7. A staff-authorized transaction locks the accepted quote revision and creates its trip(s) once, initially `booked` with no driver or vehicle. Unique conversion keys prevent retries from creating duplicate jobs. Staff then assign through the normal dispatch workflow; the database checks overlaps. Multi-leg conversion must be all-or-nothing. Invoices remain a separate finance-only operation.

## Proposed service contract

`POST /api/integrations/website/enquiries`, JSON, maximum 16 KiB; no browser CORS access. Fixed destination configured server-side.

```json
{
  "schema_version": 1,
  "event_id": "3f597e23-54e7-40fd-ad2f-5883a3fe9451",
  "source_project_id": "appgprj_6af1adf782b88191946001ed7287e6a2",
  "enquiry_id": "048342df-403a-40da-8856-6a8d7a9b2b79",
  "submitted_at": "2026-11-09T12:00:00Z",
  "type": "vehicle",
  "contact": {"name": "Synthetic Customer", "email": "customer@example.invalid", "phone": ""},
  "details": {"service": "airport-transfer", "vehicle": "", "passengers": "2", "pickup": "Synthetic airport", "destination": "Synthetic hotel", "start": "2026-11-15", "time": "10:00", "end": "", "notes": "Synthetic verification only"}
}
```

This illustrates the envelope, not a copied service enum; implementation must copy/validate exact `hireTypes` and fleet identifiers from the website source. Website vehicle preferences are display/catalogue IDs, never operations vehicle UUIDs or guaranteed availability. Date/time is Nairobi local time; preserve missing time rather than guessing. Validate contact fields, type-specific details, field counts, dates and lengths independently on receipt. Reject unknown schema versions and privileged fields (`role`, fare, paid state, driver/vehicle assignment, status). Render notes as text, never trusted HTML.

Headers: `X-ACT-Key-Id`, `X-ACT-Timestamp` (Unix seconds), `X-ACT-Signature` (hex HMAC-SHA256). Sign the exact bytes `timestamp + "\n" + "POST\n/api/integrations/website/enquiries\n" + rawBody`. Verify timestamp within five minutes and compare signatures in constant time before parsing/processing. Signatures are bound to method, path, timestamp and body. The request body contains the event ID and source project; verify the configured source explicitly. Enforce TLS, content type, streaming body limit and rate limits. Use a dedicated staging secret, distinct production secret, and key IDs allowing brief two-key rotation; store in Sites runtime secrets and Vercel environment secrets. Never share Supabase service-role keys with the Site.

HMAC authentication grants only enqueue permission. Use a narrowly scoped PostgreSQL integration role or audited insert-only security-definer RPC behind the receiver; no authenticated staff impersonation or arbitrary table access. If infrastructure initially requires a service-role client, confine it to the server endpoint and a single validated ingest RPC, document that its credential is still broader than the endpoint, and replace with a scoped role before widening the integration.

Replay handling: unique `(source_project_id,event_id)` receipt with body hash; unique `(source_project_id,enquiry_id)` incoming lead; identical retry returns the same opaque receipt. Conflicting payload under the same event ID is rejected. New updates to an enquiry require a separate versioned event type; do not overwrite a quote silently. Bind a stable payload to the outbox event, recomputing only timestamp/signature on retry.

## Storage and permissions

- D1 `handoff_outbox`: event ID, enquiry ID, immutable payload/hash, queued time, attempts, next attempt time, last error code, acknowledged receipt. Unique event ID; use D1 transaction/batch semantics for queueing. Staff sees queued/delivered/needs-attention and can safely retry.
- Operations `incoming_enquiries`: source project/enquiry composite unique, contact/itinerary, status, received time, assigned staff; staff-only RLS. Keep original payload encrypted/controlled if retained; restrict raw payload access.
- Operations `integration_receipts`: source/event unique, payload hash, opaque result ID and processed time; service-ingest only, no public reads.
- `quotes`, `quote_revisions`, `quote_lines`: draft editing by operations staff, immutable issued revision, acceptance metadata, totals derived server-side. Audit every issue/accept/convert transition. Finance-only payment/invoice mutations remain separate.
- `quote_bookings`: unique accepted revision conversion record; trips reference it and leg index. Prevent converting multiple revisions of the same quote by locking quote header and enforcing one booking per quote.

No cross-site cookies or login-token forwarding. ChatGPT inbox access does not grant Supabase operations access; operations users authenticate normally. Avoid PII in deep links, logs, monitoring events and error bodies. Return opaque receipts, not the internal customer or trip record. Agree contact-data retention/deletion rules; propagate authorized deletion through stored leads/outbox according to accounting retention obligations.

## Failure handling and rollout

D1 and PostgreSQL cannot share a transaction. The transactional outbox plus idempotent receiver handles crashes between send and acknowledgement. Retry transient failures/429/5xx with exponential backoff and jitter, honor Retry-After, and retain events for operator retry after bounded attempts. Treat 401/403 as configuration failures and 400/409 as review-required. A receipt means imported lead, never confirmed booking. No reverse synchronisation initially; quote/dispatch status remains authoritative in operations. Add a separate signed minimal status callback later if needed.

First build the receiver, outbox and saved quote path against staging with synthetic data; leave delivery disabled by default. Verify invalid signatures/timestamps, malformed/oversized payloads, forged source, replay/conflicting replay, receiver downtime, lost acknowledgements, concurrent queueing, key rotation, staff/anonymous denial, quote revision acceptance, concurrent single and multi-leg conversion, unknown pickup times, and dispatch collisions. Verify malicious lead text cannot set fare, acceptance or assignment. Enable for one synthetic enquiry, inspect both audit trails, then have staff perform a controlled staging quote-to-dispatch rehearsal before any production enablement.
