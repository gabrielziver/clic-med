alter table public.stripe_subscriptions
  alter column user_id drop not null;

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
      where (
          stripe_subscriptions.user_id = (select auth.uid())
          or lower(stripe_subscriptions.email::text) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        )
        and stripe_subscriptions.livemode
        and stripe_subscriptions.status in ('trialing', 'active')
        and stripe_subscriptions.current_period_end > now()
    );
$$;

drop policy if exists "stripe_subscriptions_select" on public.stripe_subscriptions;
create policy "stripe_subscriptions_select" on public.stripe_subscriptions for select to authenticated
using (
  (select auth.uid()) = user_id
  or lower(email::text) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  or public.is_platform_owner()
);
