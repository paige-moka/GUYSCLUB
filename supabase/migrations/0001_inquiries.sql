-- GUYS&CO website inquiries. Run once: Supabase > SQL Editor > New query > paste > Run.
create table if not exists public.inquiries (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 2 and 120),
  business    text check (business is null or char_length(business) <= 160),
  email       text not null check (char_length(email) <= 200 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone       text check (phone is null or char_length(phone) <= 40),
  need        text not null check (char_length(need) <= 80),
  message     text not null check (char_length(message) between 10 and 4000),
  consent     boolean not null check (consent),
  handled     boolean not null default false
);

-- Row Level Security: website visitors may ADD an inquiry and nothing else.
-- There is no select, update or delete policy, so the public key cannot read the table.
alter table public.inquiries enable row level security;

drop policy if exists "Website visitors can send an inquiry" on public.inquiries;
create policy "Website visitors can send an inquiry"
  on public.inquiries for insert to anon
  with check (consent = true and handled = false);

revoke all on public.inquiries from anon;
grant insert (name, business, email, phone, need, message, consent) on public.inquiries to anon;
