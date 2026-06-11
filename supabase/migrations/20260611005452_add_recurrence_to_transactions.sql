alter table public.transactions
  add column recurrence_type text not null default 'none'
    check (recurrence_type in ('none', 'fixed', 'until_date', 'installments')),
  add column recurrence_until date,
  add column recurrence_total integer,
  add column recurrence_index integer,
  add column recurrence_group_id uuid;
