create table if not exists public.cancellation_surveys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subscription_id uuid references public.stripe_subscriptions(id) on delete set null,
  email citext not null,
  cancellation_reason text,
  discovery_source text,
  ease_rating smallint check (ease_rating between 1 and 5),
  satisfaction_rating smallint check (satisfaction_rating between 1 and 5),
  used_areas text[] not null default '{}',
  most_useful text,
  improvement text,
  recommendation text check (recommendation in ('sim', 'talvez', 'nao')),
  skipped boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists cancellation_surveys_created_idx on public.cancellation_surveys(created_at desc);
create index if not exists cancellation_surveys_user_idx on public.cancellation_surveys(user_id);

alter table public.cancellation_surveys enable row level security;
grant select on public.cancellation_surveys to authenticated;

drop policy if exists "cancellation_surveys_owner_select" on public.cancellation_surveys;
create policy "cancellation_surveys_owner_select" on public.cancellation_surveys for select to authenticated
using (public.is_platform_owner());
