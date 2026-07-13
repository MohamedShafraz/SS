-- Industry-standard user management helpers for Unified POS
-- Run this in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  email varchar(255) unique not null,
  name varchar(255),
  password_hash text not null,
  role varchar(50) default 'cashier',
  active boolean default true,
  last_login timestamp,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp
);

alter table if exists public.users
  add column if not exists password_reset_token_hash text;

alter table if exists public.users
  add column if not exists password_reset_expires_at timestamptz;

create index if not exists idx_users_email on public.users(email);
create index if not exists idx_users_active on public.users(active);

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email varchar,
  name varchar,
  role varchar,
  active boolean,
  last_login timestamp,
  created_at timestamp,
  updated_at timestamp
)
language sql
security definer
set search_path = public
as $$
  select id, email, name, role, active, last_login, created_at, updated_at
  from public.users
  order by created_at desc;
$$;

create or replace function public.admin_create_user(
  p_email text,
  p_name text,
  p_password text,
  p_role text default 'cashier'
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  created_user public.users;
begin
  insert into public.users (
    email,
    name,
    password_hash,
    role,
    active,
    updated_at
  ) values (
    lower(trim(p_email)),
    nullif(trim(p_name), ''),
    crypt(p_password, gen_salt('bf')),
    coalesce(nullif(trim(p_role), ''), 'cashier'),
    true,
    now()
  )
  on conflict (email) do update set
    name = excluded.name,
    password_hash = excluded.password_hash,
    role = excluded.role,
    active = true,
    updated_at = now()
  returning * into created_user;

  return created_user;
end;
$$;

create or replace function public.admin_reset_user_password(
  p_email text,
  p_password text
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_user public.users;
begin
  update public.users
  set
    password_hash = crypt(p_password, gen_salt('bf')),
    password_reset_token_hash = null,
    password_reset_expires_at = null,
    active = true,
    updated_at = now()
  where email = lower(trim(p_email))
  returning * into updated_user;

  if updated_user.id is null then
    raise exception 'User not found';
  end if;

  return updated_user;
end;
$$;

-- Demo users (replace or delete in production as needed)
insert into public.users (email, name, password_hash, role, active)
values
  ('admin@pos.com', 'Admin User', crypt('admin123', gen_salt('bf')), 'admin', true),
  ('cashier@pos.com', 'Cashier User', crypt('cashier123', gen_salt('bf')), 'cashier', true)
on conflict (email) do nothing;