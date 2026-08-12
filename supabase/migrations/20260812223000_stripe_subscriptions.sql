create table if not exists public.stripe_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email citext not null,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'checkout_pending',
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_event_created bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_subscriptions_customer_idx on public.stripe_subscriptions(stripe_customer_id);
create index if not exists stripe_subscriptions_status_idx on public.stripe_subscriptions(status, current_period_end);

alter table public.stripe_subscriptions enable row level security;

grant select on public.stripe_subscriptions to authenticated;

drop policy if exists "stripe_subscriptions_select" on public.stripe_subscriptions;
create policy "stripe_subscriptions_select" on public.stripe_subscriptions for select to authenticated
using ((select auth.uid()) = user_id or public.is_platform_owner());

create or replace function public.has_active_access()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select public.is_platform_owner()
    or exists (
      select 1
      from public.access_grants
      where lower(access_grants.email::text) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        and access_grants.active
        and access_grants.starts_at <= now()
        and access_grants.expires_at > now()
    )
    or exists (
      select 1
      from public.stripe_subscriptions
      where stripe_subscriptions.user_id = (select auth.uid())
        and stripe_subscriptions.status in ('trialing', 'active')
        and stripe_subscriptions.current_period_end > now()
    );
$$;

drop trigger if exists stripe_subscriptions_set_updated_at on public.stripe_subscriptions;
create trigger stripe_subscriptions_set_updated_at before update on public.stripe_subscriptions
for each row execute procedure public.set_updated_at();
