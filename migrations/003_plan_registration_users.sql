-- Adds paid registration fields to plan purchases.
-- Run this before using /register in production.

alter table if exists public.plan_purchases
  add column if not exists customer_name varchar(255),
  add column if not exists password_hash text,
  add column if not exists user_role varchar(50) default 'admin',
  add column if not exists user_id uuid references public.users(id);

create index if not exists idx_plan_purchases_customer_email
  on public.plan_purchases(customer_email);

create index if not exists idx_plan_purchases_user_id
  on public.plan_purchases(user_id);
