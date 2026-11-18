-- GUYS Club website forms: membership applications and I KNOW A GUY recommendations.
-- Run once in Supabase > SQL Editor, after 0001 and 0002. Safe to run again.

create table if not exists public.club_applications (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  name             text not null check (char_length(name) between 2 and 120),
  email            text not null check (char_length(email) <= 200 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone            text check (phone is null or char_length(phone) <= 40),
  business_role    text not null check (char_length(business_role) between 2 and 200),
  industry         text not null check (char_length(industry) <= 80),
  value_offered    text not null check (char_length(value_offered) between 10 and 3000),
  looking_for      text check (looking_for is null or char_length(looking_for) <= 3000),
  sponsor          text check (sponsor is null or char_length(sponsor) <= 160),
  agreed_standards boolean not null check (agreed_standards),
  status           text not null default 'new' check (status in ('new', 'closer_look', 'approved', 'invited', 'declined')),
  notes            text,
  updated_at       timestamptz not null default now()
);

create table if not exists public.club_recommendations (
  id                bigint generated always as identity primary key,
  created_at        timestamptz not null default now(),
  recommender_name  text not null check (char_length(recommender_name) between 2 and 120),
  recommender_email text not null check (char_length(recommender_email) <= 200 and recommender_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  candidate_name    text not null check (char_length(candidate_name) between 2 and 200),
  candidate_contact text check (candidate_contact is null or char_length(candidate_contact) <= 200),
  background        text not null check (char_length(background) between 2 and 3000),
  fit               text check (fit is null or char_length(fit) <= 3000),
  value_offered     text check (value_offered is null or char_length(value_offered) <= 3000),
  consent           text not null check (consent in ('yes', 'not_yet')),
  status            text not null default 'new' check (status in ('new', 'invited', 'applied', 'on_hold', 'closed')),
  notes             text,
  updated_at        timestamptz not null default now()
);

alter table public.club_applications enable row level security;
alter table public.club_recommendations enable row level security;

-- The website may ADD a row and nothing else. It cannot read, change or delete.
revoke all on public.club_applications, public.club_recommendations from anon, authenticated;
grant insert (name, email, phone, business_role, industry, value_offered, looking_for, sponsor, agreed_standards) on public.club_applications to anon;
grant insert (recommender_name, recommender_email, candidate_name, candidate_contact, background, fit, value_offered, consent) on public.club_recommendations to anon;

drop policy if exists "gc applications from the website" on public.club_applications;
create policy "gc applications from the website" on public.club_applications for insert to anon with check (status = 'new' and notes is null);
drop policy if exists "gc recommendations from the website" on public.club_recommendations;
create policy "gc recommendations from the website" on public.club_recommendations for insert to anon with check (status = 'new' and notes is null);

-- GUYS&CO staff (administrators and team members) review them. Members and specialists never see them.
grant select, update (status, notes, updated_at) on public.club_applications, public.club_recommendations to authenticated;
drop policy if exists "gc applications staff read" on public.club_applications;
create policy "gc applications staff read" on public.club_applications for select to authenticated using (app.is_staff());
drop policy if exists "gc applications staff update" on public.club_applications;
create policy "gc applications staff update" on public.club_applications for update to authenticated using (app.is_staff()) with check (app.is_staff());
drop policy if exists "gc recommendations staff read" on public.club_recommendations;
create policy "gc recommendations staff read" on public.club_recommendations for select to authenticated using (app.is_staff());
drop policy if exists "gc recommendations staff update" on public.club_recommendations;
create policy "gc recommendations staff update" on public.club_recommendations for update to authenticated using (app.is_staff()) with check (app.is_staff());

drop trigger if exists gc_touch on public.club_applications;
create trigger gc_touch before update on public.club_applications for each row execute function app.touch();
drop trigger if exists gc_touch on public.club_recommendations;
create trigger gc_touch before update on public.club_recommendations for each row execute function app.touch();

-- the contact page's need field now carries topics like "GUYS Club membership"
alter table public.inquiries drop constraint if exists inquiries_need_check;
alter table public.inquiries add constraint inquiries_need_check check (char_length(need) <= 80);
