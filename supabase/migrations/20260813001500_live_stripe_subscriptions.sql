alter table public.stripe_subscriptions
add column if not exists livemode boolean not null default false;

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
        and stripe_subscriptions.livemode
        and stripe_subscriptions.status in ('trialing', 'active')
        and stripe_subscriptions.current_period_end > now()
    );
$$;
