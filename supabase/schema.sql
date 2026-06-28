-- ============================================================
-- Margin — Supabase schema
-- Run this in the Supabase SQL editor (Project -> SQL -> New query).
-- Every row is owned by auth.uid() and protected by RLS, so each
-- contractor only sees their own data.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- jobs (with embedded cost columns + deposit) ----------
create table if not exists public.jobs (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client      text not null,
  type        text not null default 'Other',
  quoted      numeric not null default 0,
  deposit     numeric not null default 0,
  status      text not null default 'active',   -- active | closed
  materials   numeric not null default 0,
  labor       numeric not null default 0,
  equipment   numeric not null default 0,
  subs        numeric not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- expenses ----------
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        text,
  description text not null,
  category    text not null default 'Other',
  amount      numeric not null default 0,
  job_id      uuid references public.jobs (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------- invoices (deposit + balance billings) ----------
create table if not exists public.invoices (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id      uuid references public.jobs (id) on delete cascade,
  client      text,
  amount      numeric not null default 0,
  kind        text not null default 'balance',  -- deposit | progress | balance
  status      text not null default 'unpaid',   -- unpaid | paid | overdue
  age         int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- bids (saved quotes from the calculator) ----------
create table if not exists public.bids (
  id                uuid primary key default gen_random_uuid(),
  owner             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_type          text,
  materials         numeric default 0,
  labor             numeric default 0,
  equipment         numeric default 0,
  subs              numeric default 0,
  overhead_alloc    numeric default 0,
  total_cost        numeric default 0,
  break_even_price  numeric default 0,
  mode              text default 'forward',      -- forward | reverse
  quoted_price      numeric default 0,
  target_type       text,                         -- profit | margin | takehome
  target_value      numeric default 0,
  recommended_price numeric default 0,
  projected_profit  numeric default 0,
  projected_margin  numeric default 0,
  created_at        timestamptz not null default now()
);

-- ---------- overhead line items ----------
create table if not exists public.overhead_items (
  id      uuid primary key default gen_random_uuid(),
  owner   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label   text not null,
  amount  numeric not null default 0
);

-- ---------- settings (one row per contractor) ----------
create table if not exists public.settings (
  owner        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  company      text default 'Margin',
  labor_rate   numeric default 45,
  reserve_pct  numeric default 28
);

-- ============================================================
-- Row Level Security: each owner can only touch their own rows
-- ============================================================
alter table public.jobs            enable row level security;
alter table public.expenses        enable row level security;
alter table public.invoices        enable row level security;
alter table public.bids            enable row level security;
alter table public.overhead_items  enable row level security;
alter table public.settings        enable row level security;

create policy "own jobs"     on public.jobs           for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own expenses" on public.expenses       for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own invoices" on public.invoices       for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own bids"     on public.bids           for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own overhead" on public.overhead_items for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own settings" on public.settings       for all using (owner = auth.uid()) with check (owner = auth.uid());
