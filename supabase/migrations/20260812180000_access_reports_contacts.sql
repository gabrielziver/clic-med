create extension if not exists citext;

alter table public.patients add column if not exists patient_email text;
alter table public.patients add column if not exists guardian_contact text;

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

alter table public.access_grants enable row level security;

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
  select public.is_platform_owner() or exists (
    select 1
    from public.access_grants
    where lower(access_grants.email::text) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      and access_grants.active
      and access_grants.starts_at <= now()
      and access_grants.expires_at > now()
  );
$$;

grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.has_active_access() to authenticated;
grant select, insert, update, delete on public.access_grants to authenticated;

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

drop trigger if exists access_grants_set_updated_at on public.access_grants;
create trigger access_grants_set_updated_at before update on public.access_grants
for each row execute procedure public.set_updated_at();
