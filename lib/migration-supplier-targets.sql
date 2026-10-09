-- Per-supplier (contractor) targets: scope a target to the contractor it applies
-- to, so each account can carry its own monthly revenue and volume goal.
-- A null contractor_id keeps its old meaning: a company-wide target.
-- Run this once in Supabase → SQL Editor → Run.
alter table targets add column if not exists contractor_id uuid references contractors(id) on delete cascade;
create index if not exists targets_contractor_id_idx on targets(contractor_id);
