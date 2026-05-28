create table if not exists public.categories (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense', 'savings', 'both')),
  color text not null,
  monthly_budget numeric check (monthly_budget is null or monthly_budget >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.transactions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null,
  type text not null check (type in ('income', 'expense', 'savings')),
  amount numeric not null check (amount > 0),
  date date not null,
  note text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id),
  foreign key (user_id, category_id) references public.categories(user_id, id) on update cascade
);

create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists transactions_user_date_idx on public.transactions(user_id, date desc);

alter table public.categories drop constraint if exists categories_type_check;
alter table public.categories
  add constraint categories_type_check check (type in ('income', 'expense', 'savings', 'both'));

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check check (type in ('income', 'expense', 'savings'));

alter table public.categories enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "Users manage own categories" on public.categories;
create policy "Users manage own categories"
on public.categories
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own transactions" on public.transactions;
create policy "Users manage own transactions"
on public.transactions
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
