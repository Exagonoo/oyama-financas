-- Tipos enumerados
create type public.account_type as enum ('checking', 'savings', 'wallet', 'credit_card', 'investment');
create type public.category_kind as enum ('income', 'expense');
create type public.transaction_type as enum ('income', 'expense', 'transfer');
create type public.transaction_status as enum ('pending', 'completed');

-- Perfis
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- Contas
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type public.account_type not null default 'checking',
  initial_balance numeric(14,2) not null default 0,
  color text not null default '#22c55e',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index accounts_user_idx on public.accounts (user_id);
grant select, insert, update, delete on public.accounts to authenticated;
grant all on public.accounts to service_role;

-- Categorias
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind public.category_kind not null,
  color text not null default '#64748b',
  icon text,
  created_at timestamptz not null default now()
);
create index categories_user_idx on public.categories (user_id);
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;

-- Lançamentos
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  type public.transaction_type not null,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  date date not null,
  status public.transaction_status not null default 'completed',
  transfer_account_id uuid references public.accounts(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  constraint transfer_target check (
    (type = 'transfer' and transfer_account_id is not null and transfer_account_id <> account_id)
    or (type <> 'transfer' and transfer_account_id is null)
  )
);
create index transactions_user_date_idx on public.transactions (user_id, date desc);
create index transactions_account_idx on public.transactions (account_id);
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;

-- Orçamentos
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  month date not null,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);
grant select, insert, update, delete on public.budgets to authenticated;
grant all on public.budgets to service_role;

-- RLS
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "accounts_all_own" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories_all_own" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions_all_own" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "budgets_all_own" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trigger de cadastro
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');

  insert into public.categories (user_id, name, kind, color, icon) values
    (new.id, 'Salário',          'income',  '#16a34a', 'banknote'),
    (new.id, 'Freelas',          'income',  '#0ea5e9', 'laptop'),
    (new.id, 'Outras receitas',  'income',  '#14b8a6', 'plus-circle'),
    (new.id, 'Moradia',          'expense', '#f97316', 'home'),
    (new.id, 'Alimentação',      'expense', '#ef4444', 'utensils'),
    (new.id, 'Transporte',       'expense', '#eab308', 'car'),
    (new.id, 'Saúde',            'expense', '#06b6d4', 'heart-pulse'),
    (new.id, 'Educação',         'expense', '#8b5cf6', 'graduation-cap'),
    (new.id, 'Lazer',            'expense', '#a855f7', 'gamepad-2'),
    (new.id, 'Assinaturas',      'expense', '#ec4899', 'repeat'),
    (new.id, 'Outros',           'expense', '#64748b', 'more-horizontal');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- View: saldo por conta
create or replace view public.account_balances
with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  a.name,
  a.type,
  a.color,
  a.archived,
  a.initial_balance
    + coalesce(sum(
        case
          when t.status <> 'completed' then 0
          when t.type = 'income'  and t.account_id = a.id then t.amount
          when t.type = 'expense' and t.account_id = a.id then -t.amount
          when t.type = 'transfer' and t.account_id = a.id then -t.amount
          when t.type = 'transfer' and t.transfer_account_id = a.id then t.amount
          else 0
        end
      ), 0) as current_balance
from public.accounts a
left join public.transactions t
  on t.account_id = a.id or t.transfer_account_id = a.id
group by a.id;

grant select on public.account_balances to authenticated;
grant select on public.account_balances to service_role;