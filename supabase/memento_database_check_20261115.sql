-- MEMENTO DATABASE CHECK — SAFE, READ ONLY
-- Run in the Supabase SQL Editor to see what's missing before/after upgrades.
-- This file never creates, changes, deletes, or resets any data.
with required_tables(name) as (
  values ('profiles'), ('follows'), ('posts'), ('stories'),
         ('collections'), ('collection_stories'), ('post_likes'),
         ('post_comments'), ('notifications'), ('direct_messages')
),
required_columns(table_name, column_name) as (
  values
    ('profiles','username'),('profiles','bio'),('profiles','display_name'),
    ('profiles','category'),('profiles','pronouns'),('profiles','website'),
    ('profiles','instagram'),('profiles','tiktok'),('profiles','avatar_path'),
    ('posts','image_path'),('posts','caption'),('posts','repost_of'),
    ('posts','archived'),('posts','music_url'),
    ('posts','music_provider'),('posts','music_title'),
    ('posts','music_artist'),('posts','original_audio_path'),
    ('posts','location_label'),
    ('stories','image_path'),('stories','published_at'),('stories','expires_at'),
    ('stories','music_url'),('stories','music_provider'),
    ('stories','music_title'),('stories','music_artist'),
    ('stories','original_audio_path'),('stories','location_label'),
    ('direct_messages','audio_path'),
    ('notifications','recipient_id'),('notifications','actor_id'),
    ('notifications','read_at'),
    ('post_comments','body')
),
required_buckets(name, should_be_public) as (
  values ('memories',false), ('profile-avatars',true),
         ('dm-voice',false), ('original-audio',false)
),
checks as (
  select 'TABLE'::text as kind, name::text as item,
         to_regclass('public.'||name) is not null as passed
  from required_tables
  union all
  select 'COLUMN', table_name||'.'||column_name,
         exists (
           select 1 from information_schema.columns c
           where c.table_schema='public' and c.table_name=rc.table_name
             and c.column_name=rc.column_name
         )
  from required_columns rc
  union all
  select 'BUCKET', rb.name || case when rb.should_be_public then ' (public)' else ' (private)' end,
         exists (
           select 1 from storage.buckets b
           where b.id=rb.name and b.public=rb.should_be_public
         )
  from required_buckets rb
)
select kind, item, case when passed then 'OK' else 'MISSING / CHECK CONFIG' end as status
from checks
order by case kind when 'TABLE' then 1 when 'COLUMN' then 2 else 3 end, item;
