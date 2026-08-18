create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.access_grants (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create table if not exists public.stripe_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email citext not null,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  livemode boolean not null default false,
  status text not null default 'checkout_pending',
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_event_created bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  patient_email text,
  guardian text,
  guardian_contact text,
  insurance text not null default 'Particular',
  cid text,
  therapies text not null,
  weekly_sessions integer not null default 1 check (weekly_sessions between 1 and 7),
  session_value numeric(10, 2) not null default 0 check (session_value >= 0),
  schedule text[] not null default '{}',
  status text not null default 'Ativo' check (status in ('Ativo', 'Pausado')),
  administrative_notes text,
  clinical_notes text,
  plan_expires_on date,
  sessions_completed integer not null default 0 check (sessions_completed >= 0),
  sessions_total integer not null default 10 check (sessions_total > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  procedure text not null default 'Psicoterapia individual',
  unit text,
  status text not null default 'presente' check (status in ('presente', 'faltou_assinou', 'nao_compareceu', 'reagendado')),
  payment_status text not null default 'Pendente' check (payment_status in ('Pago', 'Pendente', 'Cancelado')),
  amount numeric(10, 2) not null default 0 check (amount >= 0),
  paid_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((payment_status = 'Pago' and paid_on is not null) or payment_status <> 'Pago')
);

create index if not exists patients_user_id_idx on public.patients(user_id);
create index if not exists appointments_user_starts_idx on public.appointments(user_id, starts_at);
create index if not exists appointments_patient_id_idx on public.appointments(patient_id);
create index if not exists stripe_subscriptions_customer_idx on public.stripe_subscriptions(stripe_customer_id);
create index if not exists stripe_subscriptions_status_idx on public.stripe_subscriptions(status, current_period_end);
create index if not exists cancellation_surveys_created_idx on public.cancellation_surveys(created_at desc);
create index if not exists cancellation_surveys_user_idx on public.cancellation_surveys(user_id);

alter table public.profiles enable row level security;
alter table public.access_grants enable row level security;
alter table public.stripe_subscriptions enable row level security;
alter table public.cancellation_surveys enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'oliverziver@gmail.com';
$$;

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

grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.has_active_access() to authenticated;
grant select, insert, update, delete on public.access_grants to authenticated;
grant select on public.stripe_subscriptions to authenticated;
grant select on public.cancellation_surveys to authenticated;

drop policy if exists "access_grants_select" on public.access_grants;
create policy "access_grants_select" on public.access_grants for select to authenticated
using (
  public.is_platform_owner()
  or lower(email::text) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

drop policy if exists "access_grants_insert_owner" on public.access_grants;
create policy "access_grants_insert_owner" on public.access_grants for insert to authenticated
with check (public.is_platform_owner() and created_by = (select auth.uid()));

drop policy if exists "access_grants_update_owner" on public.access_grants;
create policy "access_grants_update_owner" on public.access_grants for update to authenticated
using (public.is_platform_owner())
with check (public.is_platform_owner());

drop policy if exists "access_grants_delete_owner" on public.access_grants;
create policy "access_grants_delete_owner" on public.access_grants for delete to authenticated
using (public.is_platform_owner());

drop policy if exists "stripe_subscriptions_select" on public.stripe_subscriptions;
create policy "stripe_subscriptions_select" on public.stripe_subscriptions for select to authenticated
using (
  (select auth.uid()) = user_id
  or lower(email::text) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  or public.is_platform_owner()
);

drop policy if exists "cancellation_surveys_owner_select" on public.cancellation_surveys;
create policy "cancellation_surveys_owner_select" on public.cancellation_surveys for select to authenticated
using (public.is_platform_owner());

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "patients_select_own" on public.patients;
create policy "patients_select_own" on public.patients for select to authenticated
using ((select auth.uid()) = user_id and (select public.has_active_access()));

drop policy if exists "patients_insert_own" on public.patients;
create policy "patients_insert_own" on public.patients for insert to authenticated
with check ((select auth.uid()) = user_id and (select public.has_active_access()));

drop policy if exists "patients_update_own" on public.patients;
create policy "patients_update_own" on public.patients for update to authenticated
using ((select auth.uid()) = user_id and (select public.has_active_access()))
with check ((select auth.uid()) = user_id and (select public.has_active_access()));

drop policy if exists "patients_delete_own" on public.patients;
create policy "patients_delete_own" on public.patients for delete to authenticated
using ((select auth.uid()) = user_id and (select public.has_active_access()));

drop policy if exists "appointments_select_own" on public.appointments;
create policy "appointments_select_own" on public.appointments for select to authenticated
using ((select auth.uid()) = user_id and (select public.has_active_access()));

drop policy if exists "appointments_insert_own" on public.appointments;
create policy "appointments_insert_own" on public.appointments for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (select public.has_active_access())
  and exists (
    select 1 from public.patients
    where patients.id = patient_id and patients.user_id = (select auth.uid())
  )
);

drop policy if exists "appointments_update_own" on public.appointments;
create policy "appointments_update_own" on public.appointments for update to authenticated
using ((select auth.uid()) = user_id and (select public.has_active_access()))
with check (
  (select auth.uid()) = user_id
  and (select public.has_active_access())
  and exists (
    select 1 from public.patients
    where patients.id = patient_id and patients.user_id = (select auth.uid())
  )
);

drop policy if exists "appointments_delete_own" on public.appointments;
create policy "appointments_delete_own" on public.appointments for delete to authenticated
using ((select auth.uid()) = user_id and (select public.has_active_access()));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists patients_set_updated_at on public.patients;
create trigger patients_set_updated_at before update on public.patients
for each row execute procedure public.set_updated_at();

drop trigger if exists access_grants_set_updated_at on public.access_grants;
create trigger access_grants_set_updated_at before update on public.access_grants
for each row execute procedure public.set_updated_at();

drop trigger if exists stripe_subscriptions_set_updated_at on public.stripe_subscriptions;
create trigger stripe_subscriptions_set_updated_at before update on public.stripe_subscriptions
for each row execute procedure public.set_updated_at();

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at before update on public.appointments
for each row execute procedure public.set_updated_at();
