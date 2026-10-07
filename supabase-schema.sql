create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 60),
  category text not null,
  type text not null check (type in ('income', 'expense')),
  amount bigint not null check (amount > 0 and amount <= 9007199254740991),
  date date not null,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);

create table if not exists public.budget_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_limit bigint not null default 15000000
    check (monthly_limit > 0 and monthly_limit <= 9007199254740991),
  updated_at timestamptz not null default now()
);

alter table public.transactions enable row level security;
alter table public.budget_settings enable row level security;

grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.budget_settings to authenticated;

drop policy if exists "Users manage their own transactions" on public.transactions;
create policy "Users manage their own transactions"
  on public.transactions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own budget" on public.budget_settings;
create policy "Users manage their own budget"
  on public.budget_settings
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transactions'
  ) then
    alter publication supabase_realtime add table public.transactions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'budget_settings'
  ) then
    alter publication supabase_realtime add table public.budget_settings;
  end if;
end
$$;
