-- Invoicing: add billed-period range so trip-generated invoices can list their line items.
-- Run this once in Supabase → SQL Editor → Run.
alter table invoices add column if not exists period_start date;
alter table invoices add column if not exists period_end   date;
