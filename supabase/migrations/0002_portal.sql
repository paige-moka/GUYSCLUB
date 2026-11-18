-- ============================================================================
-- GUYS&CO Member Lounge: database, roles and Row Level Security
-- Run once in Supabase > SQL Editor, after 0001_inquiries.sql.
-- Every table has Row Level Security switched on. Permissions are enforced
-- here in the database, never by hiding things in the interface.
-- Money is stored as whole cents (bigint). "goal" = the amount being raised.
-- ============================================================================

create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

do $$ begin
  create type public.user_role as enum ('admin', 'team', 'specialist', 'member');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 1. Members (the client business) and profiles (one per login)
-- ----------------------------------------------------------------------------
create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 160),
  serial      text unique,
  status      text not null default 'active' check (status in ('active', 'paused', 'alumni')),
  joined_on   date,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text,
  full_name            text,
  role                 public.user_role not null default 'member',
  member_id            uuid references public.members (id) on delete set null,
  can_view_financials  boolean not null default false,
  created_at           timestamptz not null default now()
);
create index if not exists profiles_member_idx on public.profiles (member_id);

-- A new login always starts as a "member" attached to nothing, so it can see nothing
-- until an administrator assigns it.
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. Permission helpers (used by every policy below)
-- ----------------------------------------------------------------------------
create or replace function app.user_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = (select auth.uid())), false)
$$;

create or replace function app.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('admin', 'team') from public.profiles where id = (select auth.uid())), false)
$$;

-- The member business this login belongs to (member logins only).
create or replace function app.my_member_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select member_id from public.profiles where id = (select auth.uid()) and role = 'member'
$$;

-- Any signed in person who has been given a place in the Lounge.
create or replace function app.is_insider() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('admin', 'team', 'specialist') or member_id is not null
                   from public.profiles where id = (select auth.uid())), false)
$$;

-- Financial records need an extra permission on top of the role.
create or replace function app.is_finance_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' or (role = 'team' and can_view_financials)
                   from public.profiles where id = (select auth.uid())), false)
$$;

create or replace function app.can_read_member_financials(m uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin'
                       or (role = 'team' and can_view_financials)
                       or (role = 'member' and can_view_financials and member_id is not null and member_id = m)
                   from public.profiles where id = (select auth.uid())), false)
$$;

create or replace function app.try_uuid(t text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin return t::uuid; exception when others then return null; end $$;

-- The server's service key and the Supabase SQL editor may change protected fields; app logins may not.
-- (Decided from the request's verified token, not from current_user, because the guard
--  triggers run as their owner and current_user would always look privileged there.)
create or replace function app.is_privileged_session() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
      or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
      or (session_user in ('postgres', 'supabase_admin')
          and coalesce(nullif(current_setting('request.jwt.claims', true), ''), '') = ''
          and coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') = '')
$$;

-- ----------------------------------------------------------------------------
-- 3. Blueprint
-- ----------------------------------------------------------------------------
create table if not exists public.blueprints (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null unique references public.members (id) on delete cascade,
  title       text not null default 'Business Blueprint',
  summary     text,
  updated_at  timestamptz not null default now()
);

create table if not exists public.blueprint_versions (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid not null references public.members (id) on delete cascade,
  version_label     text not null,
  notes             text,
  storage_path      text not null unique,
  file_name         text not null,
  size_bytes        bigint,
  uploaded_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  uploaded_by_name  text,
  created_at        timestamptz not null default now()
);
create index if not exists blueprint_versions_member_idx on public.blueprint_versions (member_id, created_at desc);

create table if not exists public.objectives (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members (id) on delete cascade,
  title        text not null,
  detail       text,
  status       text not null default 'active' check (status in ('active', 'achieved', 'parked')),
  goal_date    date,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists objectives_member_idx on public.objectives (member_id);

create table if not exists public.recommendations (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members (id) on delete cascade,
  title        text not null,
  detail       text,
  built_stage  text check (built_stage in ('Blueprint', 'Uptime', 'Ignition', 'Leverage', 'Traction')),
  status       text not null default 'open' check (status in ('open', 'in_progress', 'done', 'declined')),
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists recommendations_member_idx on public.recommendations (member_id);

-- ----------------------------------------------------------------------------
-- 4. Projects, assignments, milestones, tasks, updates, documents
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id                 uuid primary key default gen_random_uuid(),
  member_id          uuid not null references public.members (id) on delete cascade,
  name               text not null,
  description        text,
  objectives         text,
  status             text not null default 'planning' check (status in ('planning', 'active', 'on_hold', 'complete', 'cancelled')),
  start_date         date,
  due_date           date,
  progress_override  int check (progress_override between 0 and 100),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists projects_member_idx on public.projects (member_id);

create table if not exists public.project_assignments (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  role_label    text not null default 'Specialist',
  display_name  text,
  created_at    timestamptz not null default now(),
  unique (project_id, profile_id)
);
create index if not exists project_assignments_profile_idx on public.project_assignments (profile_id);

create or replace function app.is_assigned(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.project_assignments a where a.project_id = p and a.profile_id = (select auth.uid()))
$$;

create or replace function app.project_member(p uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select member_id from public.projects where id = p
$$;

-- Staff, the member who owns it, or a specialist assigned to it.
create or replace function app.can_read_project(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_staff()
      or exists (select 1 from public.projects x where x.id = p and x.member_id = app.my_member_id())
      or app.is_assigned(p)
$$;

create or replace function app.works_for_member(m uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.project_assignments a join public.projects x on x.id = a.project_id
                 where a.profile_id = (select auth.uid()) and x.member_id = m)
$$;

create table if not exists public.milestones (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.members (id) on delete cascade,
  project_id    uuid references public.projects (id) on delete cascade,  -- empty = a Blueprint milestone
  title         text not null,
  detail        text,
  due_date      date,
  status        text not null default 'upcoming' check (status in ('upcoming', 'in_progress', 'done', 'missed')),
  completed_at  timestamptz,
  sort          int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists milestones_member_idx on public.milestones (member_id);
create index if not exists milestones_project_idx on public.milestones (project_id);

create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.members (id) on delete cascade,
  project_id    uuid references public.projects (id) on delete cascade,  -- empty = a Blueprint action
  title         text not null,
  detail        text,
  owner_type    text not null default 'guysco' check (owner_type in ('member', 'guysco', 'specialist')),
  assignee_id   uuid references public.profiles (id) on delete set null,
  due_date      date,
  status        text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  completed_at  timestamptz,
  completed_by  uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists tasks_member_idx on public.tasks (member_id);
create index if not exists tasks_project_idx on public.tasks (project_id);

create table if not exists public.project_updates (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete cascade,
  body         text not null,
  author_id    uuid default auth.uid() references public.profiles (id) on delete set null,
  author_name  text,
  created_at   timestamptz not null default now()
);
create index if not exists project_updates_project_idx on public.project_updates (project_id, created_at desc);

create table if not exists public.documents (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid not null references public.members (id) on delete cascade,
  project_id        uuid references public.projects (id) on delete cascade,
  title             text not null,
  storage_path      text not null unique,
  file_name         text not null,
  mime              text,
  size_bytes        bigint,
  uploaded_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  uploaded_by_name  text,
  created_at        timestamptz not null default now()
);
create index if not exists documents_member_idx on public.documents (member_id);

-- ----------------------------------------------------------------------------
-- 5. The Library
-- ----------------------------------------------------------------------------
create table if not exists public.member_groups (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique
);
create table if not exists public.member_group_members (
  group_id   uuid not null references public.member_groups (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete cascade,
  primary key (group_id, member_id)
);

create table if not exists public.library_resources (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  category      text not null default 'General',
  kind          text not null default 'guide' check (kind in ('document', 'template', 'guide', 'resource', 'training')),
  storage_path  text unique,
  file_name     text,
  size_bytes    bigint,
  external_url  text check (external_url is null or external_url ~ '^https://'),
  audience      text not null default 'all' check (audience in ('all', 'restricted')),
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.library_access (
  id           uuid primary key default gen_random_uuid(),
  resource_id  uuid not null references public.library_resources (id) on delete cascade,
  member_id    uuid references public.members (id) on delete cascade,
  group_id     uuid references public.member_groups (id) on delete cascade,
  check ((member_id is null) <> (group_id is null))
);
create index if not exists library_access_resource_idx on public.library_access (resource_id);

create or replace function app.can_read_resource(r uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_staff() or exists (
    select 1 from public.library_resources x
    where x.id = r and x.published and (
      (x.audience = 'all' and app.is_insider())
      or exists (select 1 from public.library_access a
                 where a.resource_id = x.id and app.my_member_id() is not null
                   and (a.member_id = app.my_member_id()
                        or a.group_id in (select g.group_id from public.member_group_members g where g.member_id = app.my_member_id())))))
$$;

-- ----------------------------------------------------------------------------
-- 6. Fundraising campaigns (Reconciliation) and the Ledger
-- ----------------------------------------------------------------------------
create table if not exists public.fundraising_campaigns (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  kind         text not null default 'reconciliation' check (kind in ('reconciliation', 'project')),
  goal_cents   bigint not null check (goal_cents > 0),
  starts_on    date,
  ends_on      date,
  status       text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now()
);

create or replace function app.can_read_campaign(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_staff() or (app.is_insider() and exists (
    select 1 from public.fundraising_campaigns x where x.id = c and x.status <> 'draft'))
$$;

create table if not exists public.campaign_milestones (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.fundraising_campaigns (id) on delete cascade,
  title         text not null,
  amount_cents  bigint not null check (amount_cents > 0),
  note          text
);

create table if not exists public.campaign_updates (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.fundraising_campaigns (id) on delete cascade,
  title         text not null,
  body          text,
  storage_path  text unique,
  file_name     text,
  created_at    timestamptz not null default now()
);

create table if not exists public.project_funding (
  project_id  uuid primary key references public.projects (id) on delete cascade,
  goal_cents  bigint not null check (goal_cents > 0),
  note        text,
  updated_at  timestamptz not null default now()
);

-- One row per money movement. Rows are never deleted: a mistake is voided, with a reason.
--   pledged   = promised, no money received
--   pending   = payment started, not yet verified
--   confirmed = funds verified as received (needs a reference: Stripe ID, e-transfer or cheque number)
--   void      = cancelled entry, kept for the record
create table if not exists public.financial_transactions (
  id               uuid primary key default gen_random_uuid(),
  member_id        uuid references public.members (id) on delete restrict,
  project_id       uuid references public.projects (id) on delete restrict,
  campaign_id      uuid references public.fundraising_campaigns (id) on delete restrict,
  kind             text not null check (kind in ('contribution', 'project_funding', 'fee', 'refund')),
  amount_cents     bigint not null check (amount_cents > 0),
  currency         text not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  status           text not null default 'pledged' check (status in ('pledged', 'pending', 'confirmed', 'void')),
  source           text not null default 'manual' check (source in ('manual', 'stripe')),
  reference        text,
  stripe_event_id  text unique,
  description      text,
  occurred_on      date not null default current_date,
  confirmed_at     timestamptz,
  confirmed_by     uuid references public.profiles (id) on delete set null,
  void_reason      text,
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint confirmed_needs_proof check (status <> 'confirmed' or (confirmed_at is not null and nullif(btrim(reference), '') is not null)),
  constraint void_needs_reason check (status <> 'void' or nullif(btrim(void_reason), '') is not null)
);
create index if not exists ft_member_idx on public.financial_transactions (member_id, occurred_on desc);
create index if not exists ft_campaign_idx on public.financial_transactions (campaign_id);
create index if not exists ft_project_idx on public.financial_transactions (project_id);

create table if not exists public.financial_audit (
  id              bigint generated always as identity primary key,
  transaction_id  uuid not null,
  action          text not null,
  actor_id        uuid,
  before          jsonb,
  after           jsonb,
  at              timestamptz not null default now()
);

create or replace function app.guard_transaction() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'confirmed' then
      new.confirmed_at := coalesce(new.confirmed_at, now());
      new.confirmed_by := coalesce(new.confirmed_by, (select auth.uid()));
    else
      new.confirmed_at := null; new.confirmed_by := null;
    end if;
    return new;
  end if;
  -- once money is confirmed or an entry is voided, the facts cannot be edited
  if old.status = 'void' then raise exception 'A voided entry cannot be changed.'; end if;
  if old.status = 'confirmed' and new.status <> 'void' then
    raise exception 'A confirmed entry cannot be edited. Void it with a reason and enter a new one.';
  end if;
  if old.status = 'confirmed' and (new.amount_cents, new.currency, new.kind, new.reference)
       is distinct from (old.amount_cents, old.currency, old.kind, old.reference) then
    raise exception 'A confirmed entry cannot be edited. Void it with a reason and enter a new one.';
  end if;
  if new.status = 'confirmed' and old.status <> 'confirmed' then
    new.confirmed_at := now(); new.confirmed_by := (select auth.uid());
  end if;
  new.created_by := old.created_by; new.created_at := old.created_at; new.source := old.source;
  new.stripe_event_id := old.stripe_event_id;
  return new;
end $$;
drop trigger if exists guard_transaction on public.financial_transactions;
create trigger guard_transaction before insert or update on public.financial_transactions
  for each row execute function app.guard_transaction();

create or replace function app.audit_transaction() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.financial_audit (transaction_id, action, actor_id, before, after)
  values (new.id, lower(tg_op), (select auth.uid()),
          case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return new;
end $$;
drop trigger if exists audit_transaction on public.financial_transactions;
create trigger audit_transaction after insert or update on public.financial_transactions
  for each row execute function app.audit_transaction();

-- Campaign totals for people who may see the campaign but not other members' entries.
-- Confirmed and pledged are always reported separately. Refunds reduce confirmed.
create or replace function public.campaign_totals(c uuid)
returns table (confirmed_cents bigint, pledged_cents bigint, pending_cents bigint, confirmed_count bigint)
language sql stable security definer set search_path = '' as $$
  select
    coalesce(sum(case when t.status = 'confirmed' and t.kind <> 'refund' then t.amount_cents
                      when t.status = 'confirmed' and t.kind = 'refund' then -t.amount_cents else 0 end), 0)::bigint,
    coalesce(sum(case when t.status = 'pledged' and t.kind <> 'refund' then t.amount_cents else 0 end), 0)::bigint,
    coalesce(sum(case when t.status = 'pending' and t.kind <> 'refund' then t.amount_cents else 0 end), 0)::bigint,
    count(*) filter (where t.status = 'confirmed' and t.kind <> 'refund')
  from public.financial_transactions t
  where t.campaign_id = c and app.can_read_campaign(c)
$$;

create table if not exists public.payment_links (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,
  url          text not null check (url ~ '^https://'),
  placement    text not null default 'ledger' check (placement in ('ledger', 'reconciliation')),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Verified Stripe events, written only by the server webhook (service key).
create table if not exists public.stripe_events (
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now(),
  result       text,
  payload      jsonb
);

-- ----------------------------------------------------------------------------
-- 7. Three for Three (rules are configured by an administrator, never assumed)
-- ----------------------------------------------------------------------------
create table if not exists public.tft_program (
  id              int primary key default 1 check (id = 1),
  label           text not null default 'Three for Three',
  description     text,
  required_count  int not null default 3 check (required_count between 1 and 50),
  period_note     text,
  is_configured   boolean not null default false,
  updated_at      timestamptz not null default now()
);
insert into public.tft_program (id) values (1) on conflict (id) do nothing;

create table if not exists public.tft_criteria (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  active       boolean not null default true,
  sort         int not null default 0
);

create table if not exists public.tft_records (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references public.members (id) on delete cascade,
  criterion_id   uuid references public.tft_criteria (id) on delete set null,
  title          text not null,
  detail         text,
  status         text not null default 'outstanding' check (status in ('outstanding', 'submitted', 'approved', 'declined')),
  due_date       date,
  submitted_at   timestamptz,
  decided_at     timestamptz,
  decided_by     uuid references public.profiles (id) on delete set null,
  decision_note  text,
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists tft_records_member_idx on public.tft_records (member_id);

create table if not exists public.tft_history (
  id           bigint generated always as identity primary key,
  record_id    uuid not null references public.tft_records (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete cascade,
  from_status  text,
  to_status    text not null,
  actor_name   text,
  at           timestamptz not null default now()
);

create or replace function app.guard_tft() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actor text := (select coalesce(nullif(full_name, ''), email) from public.profiles where id = (select auth.uid()));
begin
  if tg_op = 'UPDATE' and not app.is_staff() and not app.is_privileged_session() then
    -- a member may only hand in an outstanding item (and add their note)
    if not (old.status = 'outstanding' and new.status = 'submitted') then
      raise exception 'Only the GUYS&CO team can change this status.';
    end if;
    if (to_jsonb(new) - array['status', 'detail', 'submitted_at']) is distinct from (to_jsonb(old) - array['status', 'detail', 'submitted_at']) then
      raise exception 'Only the note and status can be changed here.';
    end if;
  end if;
  if tg_op = 'INSERT' and not app.is_staff() and not app.is_privileged_session() then
    new.status := 'submitted'; new.decided_at := null; new.decided_by := null; new.decision_note := null;
  end if;
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then new.submitted_at := now(); end if;
  if new.status in ('approved', 'declined') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.decided_at := now(); new.decided_by := (select auth.uid());
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;
  return new;
end $$;
drop trigger if exists guard_tft on public.tft_records;
create trigger guard_tft before insert or update on public.tft_records
  for each row execute function app.guard_tft();

create or replace function app.log_tft() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.tft_history (record_id, member_id, from_status, to_status, actor_name)
    values (new.id, new.member_id, case when tg_op = 'UPDATE' then old.status end, new.status,
            (select coalesce(nullif(full_name, ''), email) from public.profiles where id = (select auth.uid())));
  end if;
  return new;
end $$;
drop trigger if exists log_tft on public.tft_records;
create trigger log_tft after insert or update on public.tft_records
  for each row execute function app.log_tft();

-- ----------------------------------------------------------------------------
-- 8. Announcements and activity history
-- ----------------------------------------------------------------------------
create table if not exists public.announcements (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  body          text,
  member_id     uuid references public.members (id) on delete cascade,  -- empty = everyone
  published     boolean not null default true,
  author_id     uuid default auth.uid() references public.profiles (id) on delete set null,
  author_name   text,
  created_at    timestamptz not null default now()
);

create table if not exists public.activity_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,
  actor_name  text,
  member_id   uuid,
  action      text not null,
  entity      text not null,
  entity_id   text,
  summary     text
);
create index if not exists activity_log_at_idx on public.activity_log (at desc);
create index if not exists activity_log_member_idx on public.activity_log (member_id, at desc);

create or replace function app.log_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
        who uuid := (select auth.uid());
begin
  insert into public.activity_log (actor_id, actor_name, member_id, action, entity, entity_id, summary)
  values (who,
          (select coalesce(nullif(full_name, ''), email) from public.profiles where id = who),
          case when tg_table_name = 'members' then app.try_uuid(r ->> 'id') else app.try_uuid(r ->> 'member_id') end,
          lower(tg_op), tg_table_name, coalesce(r ->> 'id', r ->> 'project_id'),
          left(coalesce(r ->> 'title', r ->> 'name', r ->> 'file_name', r ->> 'version_label', r ->> 'description', r ->> 'body', ''), 160)
            || case when tg_op = 'UPDATE' and r ? 'status' and (to_jsonb(old) ->> 'status') is distinct from (r ->> 'status')
                    then ' (' || coalesce(to_jsonb(old) ->> 'status', '') || ' → ' || (r ->> 'status') || ')' else '' end);
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['members', 'blueprints', 'blueprint_versions', 'objectives', 'recommendations', 'projects',
                           'project_assignments', 'milestones', 'tasks', 'project_updates', 'documents',
                           'financial_transactions', 'tft_records', 'announcements', 'library_resources',
                           'fundraising_campaigns', 'project_funding'] loop
    execute format('drop trigger if exists log_activity on public.%I', t);
    execute format('create trigger log_activity after insert or update or delete on public.%I for each row execute function app.log_activity()', t);
  end loop;
end $$;

-- Stamps the display name of whoever did something, so members never need to read staff profiles.
create or replace function app.stamp_name() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n text;
begin
  if tg_table_name = 'project_assignments' then
    select coalesce(nullif(full_name, ''), email) into n from public.profiles where id = new.profile_id;
    new.display_name := coalesce(nullif(new.display_name, ''), n);
    return new;
  end if;
  select coalesce(nullif(full_name, ''), email) into n from public.profiles where id = (select auth.uid());
  if tg_table_name in ('documents', 'blueprint_versions') then
    if tg_op = 'INSERT' then new.uploaded_by := coalesce((select auth.uid()), new.uploaded_by); new.uploaded_by_name := coalesce(n, new.uploaded_by_name); end if;
  else
    if tg_op = 'INSERT' then new.author_id := coalesce((select auth.uid()), new.author_id); new.author_name := coalesce(n, new.author_name); end if;
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['project_assignments', 'documents', 'blueprint_versions', 'project_updates', 'announcements'] loop
    execute format('drop trigger if exists stamp_name on public.%I', t);
    execute format('create trigger stamp_name before insert or update on public.%I for each row execute function app.stamp_name()', t);
  end loop;
end $$;

-- Only an administrator may change someone's role, member or financial permission.
create or replace function app.guard_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if app.is_admin() or app.is_privileged_session() then return new; end if;
  if (new.id, new.role, new.member_id, new.can_view_financials, new.email)
       is distinct from (old.id, old.role, old.member_id, old.can_view_financials, old.email) then
    raise exception 'Only an administrator can change roles and permissions.';
  end if;
  return new;
end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles
  for each row execute function app.guard_profile();

-- Members and specialists may tick work off; only staff may rewrite it.
create or replace function app.guard_progress() returns trigger
language plpgsql security definer set search_path = '' as $$
declare keep text[] := array['status', 'completed_at', 'completed_by'];
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := now();
    if tg_table_name = 'tasks' then new.completed_by := (select auth.uid()); end if;
  elsif new.status <> 'done' then
    new.completed_at := null;
    if tg_table_name = 'tasks' then new.completed_by := null; end if;
  end if;
  if app.is_staff() or app.is_privileged_session() then return new; end if;
  if (to_jsonb(new) - keep) is distinct from (to_jsonb(old) - keep) then
    raise exception 'Only the status can be changed here.';
  end if;
  return new;
end $$;
drop trigger if exists guard_progress on public.tasks;
create trigger guard_progress before update on public.tasks for each row execute function app.guard_progress();
drop trigger if exists guard_progress on public.milestones;
create trigger guard_progress before update on public.milestones for each row execute function app.guard_progress();

create or replace function app.touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['blueprints', 'projects', 'library_resources', 'project_funding', 'tft_program'] loop
    execute format('drop trigger if exists touch on public.%I', t);
    execute format('create trigger touch before update on public.%I for each row execute function app.touch()', t);
  end loop;
end $$;

grant execute on all functions in schema app to anon, authenticated, service_role;
revoke execute on function public.campaign_totals(uuid) from public, anon;
grant execute on function public.campaign_totals(uuid) to authenticated, service_role;

-- ============================================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================================
do $$ declare t text; begin
  foreach t in array array['members', 'profiles', 'blueprints', 'blueprint_versions', 'objectives', 'recommendations',
      'projects', 'project_assignments', 'milestones', 'tasks', 'project_updates', 'documents', 'member_groups',
      'member_group_members', 'library_resources', 'library_access', 'fundraising_campaigns', 'campaign_milestones',
      'campaign_updates', 'project_funding', 'financial_transactions', 'financial_audit', 'payment_links',
      'stripe_events', 'tft_program', 'tft_criteria', 'tft_records', 'tft_history', 'announcements', 'activity_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);                      -- visitors who are not signed in get nothing
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
-- Financial history is permanent: nobody signed in through the app can delete it.
revoke delete on public.financial_transactions, public.financial_audit, public.activity_log, public.tft_history from authenticated;
revoke insert, update on public.financial_audit, public.activity_log, public.tft_history, public.stripe_events from authenticated;

-- Drop then create, so this file can be run again safely.
do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' and policyname like 'gc %' loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- members
create policy "gc members read" on public.members for select to authenticated
  using (app.is_staff() or id = app.my_member_id() or app.works_for_member(id));
create policy "gc members insert" on public.members for insert to authenticated with check (app.is_staff());
create policy "gc members update" on public.members for update to authenticated using (app.is_staff()) with check (app.is_staff());
create policy "gc members delete" on public.members for delete to authenticated using (app.is_admin());

-- profiles
create policy "gc profiles read" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or app.is_staff());
create policy "gc profiles update" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or app.is_admin()) with check (id = (select auth.uid()) or app.is_admin());
create policy "gc profiles delete" on public.profiles for delete to authenticated using (app.is_admin());

-- blueprint: staff manage, the member reads their own
create policy "gc blueprints read" on public.blueprints for select to authenticated using (app.is_staff() or member_id = app.my_member_id());
create policy "gc blueprints write" on public.blueprints for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy "gc bpv read" on public.blueprint_versions for select to authenticated using (app.is_staff() or member_id = app.my_member_id());
create policy "gc bpv insert" on public.blueprint_versions for insert to authenticated
  with check (app.is_staff() or (member_id = app.my_member_id() and storage_path like member_id::text || '/%'));
create policy "gc bpv update" on public.blueprint_versions for update to authenticated using (app.is_staff()) with check (app.is_staff());
create policy "gc bpv delete" on public.blueprint_versions for delete to authenticated using (app.is_staff());

create policy "gc objectives read" on public.objectives for select to authenticated using (app.is_staff() or member_id = app.my_member_id());
create policy "gc objectives write" on public.objectives for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy "gc recommendations read" on public.recommendations for select to authenticated using (app.is_staff() or member_id = app.my_member_id());
create policy "gc recommendations write" on public.recommendations for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- projects
create policy "gc projects read" on public.projects for select to authenticated
  using (app.is_staff() or member_id = app.my_member_id() or app.is_assigned(id));
create policy "gc projects write" on public.projects for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy "gc assignments read" on public.project_assignments for select to authenticated
  using (app.is_staff() or profile_id = (select auth.uid()) or app.project_member(project_id) = app.my_member_id());
create policy "gc assignments write" on public.project_assignments for all to authenticated using (app.is_staff()) with check (app.is_staff());

create policy "gc milestones read" on public.milestones for select to authenticated
  using (app.is_staff() or member_id = app.my_member_id() or (project_id is not null and app.is_assigned(project_id)));
create policy "gc milestones insert" on public.milestones for insert to authenticated with check (app.is_staff());
create policy "gc milestones update" on public.milestones for update to authenticated
  using (app.is_staff() or (project_id is not null and app.is_assigned(project_id)))
  with check (app.is_staff() or (project_id is not null and app.is_assigned(project_id)));
create policy "gc milestones delete" on public.milestones for delete to authenticated using (app.is_staff());

create policy "gc tasks read" on public.tasks for select to authenticated
  using (app.is_staff() or member_id = app.my_member_id() or (project_id is not null and app.is_assigned(project_id)));
create policy "gc tasks insert" on public.tasks for insert to authenticated with check (app.is_staff());
create policy "gc tasks update" on public.tasks for update to authenticated
  using (app.is_staff()
         or (member_id = app.my_member_id() and owner_type = 'member')
         or (project_id is not null and app.is_assigned(project_id) and owner_type = 'specialist'))
  with check (app.is_staff()
         or (member_id = app.my_member_id() and owner_type = 'member')
         or (project_id is not null and app.is_assigned(project_id) and owner_type = 'specialist'));
create policy "gc tasks delete" on public.tasks for delete to authenticated using (app.is_staff());

create policy "gc updates read" on public.project_updates for select to authenticated
  using (app.is_staff() or member_id = app.my_member_id() or app.is_assigned(project_id));
create policy "gc updates insert" on public.project_updates for insert to authenticated
  with check ((app.is_staff() or app.is_assigned(project_id)) and member_id = app.project_member(project_id));
create policy "gc updates change" on public.project_updates for update to authenticated using (app.is_staff()) with check (app.is_staff());
create policy "gc updates delete" on public.project_updates for delete to authenticated using (app.is_staff());

create policy "gc documents read" on public.documents for select to authenticated
  using (app.is_staff() or member_id = app.my_member_id() or (project_id is not null and app.is_assigned(project_id)));
create policy "gc documents insert" on public.documents for insert to authenticated
  with check (storage_path like member_id::text || '/%' and (
       app.is_staff()
    or (member_id = app.my_member_id() and (project_id is null or app.project_member(project_id) = member_id))
    or (project_id is not null and app.is_assigned(project_id) and app.project_member(project_id) = member_id)));
create policy "gc documents update" on public.documents for update to authenticated using (app.is_staff()) with check (app.is_staff());
create policy "gc documents delete" on public.documents for delete to authenticated using (app.is_staff());

-- library
create policy "gc library read" on public.library_resources for select to authenticated using (app.can_read_resource(id));
create policy "gc library write" on public.library_resources for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy "gc library access" on public.library_access for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy "gc groups" on public.member_groups for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy "gc group members" on public.member_group_members for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- campaigns: insiders see active and closed campaigns; only finance staff manage them
create policy "gc campaigns read" on public.fundraising_campaigns for select to authenticated using (app.can_read_campaign(id));
create policy "gc campaigns write" on public.fundraising_campaigns for all to authenticated using (app.is_finance_staff()) with check (app.is_finance_staff());
create policy "gc camp milestones read" on public.campaign_milestones for select to authenticated using (app.can_read_campaign(campaign_id));
create policy "gc camp milestones write" on public.campaign_milestones for all to authenticated using (app.is_finance_staff()) with check (app.is_finance_staff());
create policy "gc camp updates read" on public.campaign_updates for select to authenticated using (app.can_read_campaign(campaign_id));
create policy "gc camp updates write" on public.campaign_updates for all to authenticated using (app.is_finance_staff()) with check (app.is_finance_staff());

-- money: extra permission on top of the role. Specialists never see it.
create policy "gc funding read" on public.project_funding for select to authenticated
  using (app.can_read_member_financials(app.project_member(project_id)));
create policy "gc funding write" on public.project_funding for all to authenticated using (app.is_finance_staff()) with check (app.is_finance_staff());

create policy "gc ledger read" on public.financial_transactions for select to authenticated
  using (app.is_finance_staff() or (member_id is not null and app.can_read_member_financials(member_id)));
create policy "gc ledger insert" on public.financial_transactions for insert to authenticated
  with check (app.is_finance_staff() and source = 'manual' and stripe_event_id is null);
create policy "gc ledger update" on public.financial_transactions for update to authenticated
  using (app.is_finance_staff()) with check (app.is_finance_staff());
create policy "gc audit read" on public.financial_audit for select to authenticated using (app.is_finance_staff());

create policy "gc paylinks read" on public.payment_links for select to authenticated using (app.is_staff() or (active and app.is_insider()));
create policy "gc paylinks write" on public.payment_links for all to authenticated using (app.is_admin()) with check (app.is_admin());
-- stripe_events: no policy on purpose. Only the server webhook (service key) can touch it.

-- three for three
create policy "gc tft program read" on public.tft_program for select to authenticated using (app.is_insider());
create policy "gc tft program write" on public.tft_program for update to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "gc tft criteria read" on public.tft_criteria for select to authenticated using (app.is_staff() or (active and app.is_insider()));
create policy "gc tft criteria write" on public.tft_criteria for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy "gc tft records read" on public.tft_records for select to authenticated using (app.is_staff() or member_id = app.my_member_id());
create policy "gc tft records insert" on public.tft_records for insert to authenticated
  with check (app.is_staff() or (member_id = app.my_member_id() and created_by = (select auth.uid())));
create policy "gc tft records update" on public.tft_records for update to authenticated
  using (app.is_staff() or member_id = app.my_member_id()) with check (app.is_staff() or member_id = app.my_member_id());
create policy "gc tft records delete" on public.tft_records for delete to authenticated using (app.is_staff());
create policy "gc tft history read" on public.tft_history for select to authenticated using (app.is_staff() or member_id = app.my_member_id());

-- announcements and activity
create policy "gc announcements read" on public.announcements for select to authenticated
  using (app.is_staff() or (published and ((member_id is null and app.is_insider()) or member_id = app.my_member_id())));
create policy "gc announcements write" on public.announcements for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy "gc activity read" on public.activity_log for select to authenticated using (app.is_staff());

-- website inquiries (table from 0001): staff can read and tick them off
grant select, update on public.inquiries to authenticated;
drop policy if exists "gc inquiries read" on public.inquiries;
create policy "gc inquiries read" on public.inquiries for select to authenticated using (app.is_staff());
drop policy if exists "gc inquiries update" on public.inquiries;
create policy "gc inquiries update" on public.inquiries for update to authenticated using (app.is_staff()) with check (app.is_staff());

-- ============================================================================
-- 10. PRIVATE FILE STORAGE
--   member-files/<member id>/blueprint/...        Blueprint versions
--   member-files/<member id>/documents/...        supporting files
--   member-files/<member id>/projects/<project id>/...
--   library/resources/...   and   library/campaigns/<campaign id>/...
-- Both buckets are private. Files are only ever served through short lived signed links.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('member-files', 'member-files', false, 52428800), ('library', 'library', false, 52428800)
on conflict (id) do update set public = false;

create or replace function app.can_read_member_file(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_staff()
      or (app.my_member_id() is not null and split_part(path, '/', 1) = app.my_member_id()::text)
      or exists (select 1 from public.documents d where d.storage_path = path and d.project_id is not null and app.is_assigned(d.project_id))
$$;

create or replace function app.can_write_member_file(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_staff()
      or (app.my_member_id() is not null and split_part(path, '/', 1) = app.my_member_id()::text)
      or (split_part(path, '/', 2) = 'projects'
          and app.is_assigned(app.try_uuid(split_part(path, '/', 3)))
          and app.project_member(app.try_uuid(split_part(path, '/', 3)))::text = split_part(path, '/', 1))
$$;

create or replace function app.can_read_library_file(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_staff()
      or exists (select 1 from public.library_resources r where r.storage_path = path and app.can_read_resource(r.id))
      or exists (select 1 from public.campaign_updates u where u.storage_path = path and app.can_read_campaign(u.campaign_id))
$$;
grant execute on all functions in schema app to anon, authenticated, service_role;

drop policy if exists "gc member files read" on storage.objects;
create policy "gc member files read" on storage.objects for select to authenticated
  using (bucket_id = 'member-files' and app.can_read_member_file(name));
drop policy if exists "gc member files add" on storage.objects;
create policy "gc member files add" on storage.objects for insert to authenticated
  with check (bucket_id = 'member-files' and app.can_write_member_file(name));
drop policy if exists "gc member files remove" on storage.objects;
create policy "gc member files remove" on storage.objects for delete to authenticated
  using (bucket_id = 'member-files' and app.is_staff());
drop policy if exists "gc library files read" on storage.objects;
create policy "gc library files read" on storage.objects for select to authenticated
  using (bucket_id = 'library' and app.can_read_library_file(name));
drop policy if exists "gc library files add" on storage.objects;
create policy "gc library files add" on storage.objects for insert to authenticated
  with check (bucket_id = 'library' and app.is_staff());
drop policy if exists "gc library files remove" on storage.objects;
create policy "gc library files remove" on storage.objects for delete to authenticated
  using (bucket_id = 'library' and app.is_staff());
