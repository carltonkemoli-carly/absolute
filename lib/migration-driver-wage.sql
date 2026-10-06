-- Driver monthly wage — powers the one-click "Post this month's wages" button
-- on the Expenses page (generates a Driver Wages expense per driver).
-- Run this once in the Supabase SQL Editor.
alter table drivers add column if not exists monthly_wage numeric(10,2) not null default 0;
