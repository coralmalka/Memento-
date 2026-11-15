-- Memento: profile identity, category and social links.
-- Additive migration. Does not delete users, media or posts.
-- Run once in the Supabase SQL Editor before using Edit Profile.
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists category text;
alter table public.profiles add column if not exists pronouns text;
alter table public.profiles add column if not exists website text;
alter table public.profiles add column if not exists instagram text;
alter table public.profiles add column if not exists tiktok text;

-- No avatar or profile-photo settings or new media buckets are created.
-- Existing profile RLS should allow each user to update their own row.
