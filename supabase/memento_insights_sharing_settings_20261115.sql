-- Memento: share analytics, story likes/views/replies and genuine account controls.
-- ADDITIVE migration. Review and run in Supabase SQL Editor, one time.
-- Existing posts, stories, profiles and messages are preserved.

create table if not exists public.account_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  story_replies text not null default 'everyone' check (story_replies in ('everyone','following','off')),
  message_requests text not null default 'everyone' check (message_requests in ('everyone','following','off')),
  allow_story_reshares boolean not null default true,
  hide_like_counts boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.account_settings enable row level security;
drop policy if exists "memento_account_settings_read" on public.account_settings;
create policy "memento_account_settings_read" on public.account_settings
  for select to authenticated using (true);
drop policy if exists "memento_account_settings_write" on public.account_settings;
create policy "memento_account_settings_write" on public.account_settings
  for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "memento_account_settings_update" on public.account_settings;
create policy "memento_account_settings_update" on public.account_settings
  for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

alter table public.posts add column if not exists source_story_id uuid references public.stories(id) on delete set null;
alter table public.stories add column if not exists source_post_id uuid references public.posts(id) on delete set null;
alter table public.stories add column if not exists source_story_id uuid references public.stories(id) on delete set null;
alter table public.direct_messages add column if not exists shared_post_id uuid references public.posts(id) on delete set null;
alter table public.direct_messages add column if not exists shared_story_id uuid references public.stories(id) on delete set null;
alter table public.direct_messages add column if not exists reply_to_story_id uuid references public.stories(id) on delete set null;

create table if not exists public.story_likes (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id,user_id)
);
alter table public.story_likes enable row level security;
drop policy if exists "memento_story_likes_read" on public.story_likes;
create policy "memento_story_likes_read" on public.story_likes for select to authenticated
  using (user_id=auth.uid() or exists (select 1 from public.stories s where s.id=story_id and s.author_id=auth.uid()));
drop policy if exists "memento_story_likes_add" on public.story_likes;
create policy "memento_story_likes_add" on public.story_likes for insert to authenticated
  with check (user_id=auth.uid() and exists (select 1 from public.stories s where s.id=story_id and s.published_at is not null and s.expires_at>now()));
drop policy if exists "memento_story_likes_remove" on public.story_likes;
create policy "memento_story_likes_remove" on public.story_likes for delete to authenticated
  using (user_id=auth.uid());

create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  primary key (story_id,viewer_id)
);
alter table public.story_views enable row level security;
drop policy if exists "memento_story_views_read" on public.story_views;
create policy "memento_story_views_read" on public.story_views for select to authenticated
  using (viewer_id=auth.uid() or exists (select 1 from public.stories s where s.id=story_id and s.author_id=auth.uid()));
drop policy if exists "memento_story_views_add" on public.story_views;
create policy "memento_story_views_add" on public.story_views for insert to authenticated
  with check (viewer_id=auth.uid() and exists (select 1 from public.stories s where s.id=story_id and s.author_id<>auth.uid() and s.published_at is not null and s.expires_at>now()));
drop policy if exists "memento_story_views_update" on public.story_views;
create policy "memento_story_views_update" on public.story_views for update to authenticated
  using (viewer_id=auth.uid()) with check (viewer_id=auth.uid());

create table if not exists public.content_shares (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  source_post_id uuid references public.posts(id) on delete cascade,
  source_story_id uuid references public.stories(id) on delete cascade,
  destination text not null check (destination in ('dm','story','page')),
  recipient_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint memento_share_one_source check ((source_post_id is null) <> (source_story_id is null))
);
create index if not exists memento_share_by_post on public.content_shares(source_post_id,created_at);
create index if not exists memento_share_by_story on public.content_shares(source_story_id,created_at);
alter table public.content_shares enable row level security;
drop policy if exists "memento_content_shares_read" on public.content_shares;
create policy "memento_content_shares_read" on public.content_shares for select to authenticated
  using (
    actor_id=auth.uid()
    or exists(select 1 from public.posts p where p.id=source_post_id and p.author_id=auth.uid())
    or exists(select 1 from public.stories s where s.id=source_story_id and s.author_id=auth.uid())
  );
-- No direct INSERT policy. Entries are generated by DB triggers when a real
-- repost or DM share succeeds. That prevents fabricated share counts.

create or replace function public.memento_validate_social_action()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  mode text;
  permitted boolean;
  story_owner uuid;
  is_following boolean;
begin
  if TG_TABLE_NAME='direct_messages' then
    if new.sender_id=new.recipient_id then return new; end if;
    select coalesce(a.message_requests,'everyone') into mode
      from public.account_settings a where a.user_id=new.recipient_id;
    mode := coalesce(mode,'everyone');
    select exists(select 1 from public.follows f
      where f.follower_id=new.sender_id and f.followed_id=new.recipient_id)
      into is_following;
    if mode='off' or (mode='following' and not is_following) then
      raise exception 'This person is not accepting messages from you.';
    end if;
    if new.reply_to_story_id is not null then
      select s.author_id into story_owner from public.stories s where s.id=new.reply_to_story_id;
      if story_owner is distinct from new.recipient_id then
        raise exception 'Story reply must be sent to the story owner.';
      end if;
      select coalesce(a.story_replies,'everyone') into mode
        from public.account_settings a where a.user_id=new.recipient_id;
      mode := coalesce(mode,'everyone');
      if mode='off' or (mode='following' and not is_following) then
        raise exception 'This person has restricted story replies.';
      end if;
    end if;
  elsif TG_TABLE_NAME='stories' and new.source_story_id is not null then
    select s.author_id into story_owner from public.stories s
      where s.id=new.source_story_id and s.published_at is not null and s.expires_at>now();
    if story_owner is null then raise exception 'This story is no longer available to reshare.'; end if;
    select coalesce(a.allow_story_reshares,true) into permitted from public.account_settings a where a.user_id=story_owner;
    if story_owner<>new.author_id and not coalesce(permitted,true) then
      raise exception 'This person disabled story resharing.';
    end if;
  elsif TG_TABLE_NAME='posts' and new.source_story_id is not null then
    select s.author_id into story_owner from public.stories s
      where s.id=new.source_story_id and s.published_at is not null and s.expires_at>now();
    if story_owner is null then raise exception 'This story is no longer available to reshare.'; end if;
    select coalesce(a.allow_story_reshares,true) into permitted from public.account_settings a where a.user_id=story_owner;
    if story_owner<>new.author_id and not coalesce(permitted,true) then
      raise exception 'This person disabled story resharing.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists memento_check_dm_settings on public.direct_messages;
create trigger memento_check_dm_settings before insert on public.direct_messages
  for each row execute function public.memento_validate_social_action();
drop trigger if exists memento_check_story_reshares on public.stories;
create trigger memento_check_story_reshares before insert on public.stories
  for each row execute function public.memento_validate_social_action();
drop trigger if exists memento_check_post_reshares on public.posts;
create trigger memento_check_post_reshares before insert on public.posts
  for each row execute function public.memento_validate_social_action();

create or replace function public.memento_log_actual_share()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if TG_TABLE_NAME='posts' then
    if new.repost_of is not null then
      insert into public.content_shares(actor_id,source_post_id,destination)
        values(new.author_id,new.repost_of,'page');
    elsif new.source_story_id is not null then
      insert into public.content_shares(actor_id,source_story_id,destination)
        values(new.author_id,new.source_story_id,'page');
    end if;
  elsif TG_TABLE_NAME='stories' then
    if new.source_post_id is not null then
      insert into public.content_shares(actor_id,source_post_id,destination)
        values(new.author_id,new.source_post_id,'story');
    elsif new.source_story_id is not null then
      insert into public.content_shares(actor_id,source_story_id,destination)
        values(new.author_id,new.source_story_id,'story');
    end if;
  elsif TG_TABLE_NAME='direct_messages' then
    if new.shared_post_id is not null then
      insert into public.content_shares(actor_id,source_post_id,destination,recipient_id)
        values(new.sender_id,new.shared_post_id,'dm',new.recipient_id);
    elsif new.shared_story_id is not null then
      insert into public.content_shares(actor_id,source_story_id,destination,recipient_id)
        values(new.sender_id,new.shared_story_id,'dm',new.recipient_id);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists memento_track_post_share on public.posts;
create trigger memento_track_post_share after insert on public.posts
  for each row execute function public.memento_log_actual_share();
drop trigger if exists memento_track_story_share on public.stories;
create trigger memento_track_story_share after insert on public.stories
  for each row execute function public.memento_log_actual_share();
drop trigger if exists memento_track_dm_share on public.direct_messages;
create trigger memento_track_dm_share after insert on public.direct_messages
  for each row execute function public.memento_log_actual_share();

-- Story like notifications use the existing 'like' type (same as post likes).
create or replace function public.memento_notify_story_like()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare owner_id uuid;
begin
  select author_id into owner_id from public.stories where id=new.story_id;
  if owner_id is not null and owner_id<>new.user_id then
    insert into public.notifications(recipient_id,actor_id,type,body)
    values(owner_id,new.user_id,'like','liked your story');
  end if;
  return new;
end;
$$;
drop trigger if exists memento_story_liked_notification on public.story_likes;
create trigger memento_story_liked_notification after insert on public.story_likes
  for each row execute function public.memento_notify_story_like();
