-- Capture pickup time on trips → unlocks busiest-hours / time-of-day analysis.
-- Run once in Supabase → SQL Editor → Run.
alter table trips add column if not exists pickup_time text;  -- "HH:MM" 24h, nullable
