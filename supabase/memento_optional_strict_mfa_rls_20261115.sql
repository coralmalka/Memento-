-- OPTIONAL HARDENING: server-side enforcement of Supabase MFA (aal2).
-- DO NOT RUN UNTIL: Phone MFA is enabled, users can complete enrollment,
-- and EXPO_PUBLIC_MEMENTO_REQUIRE_MFA=true is deployed.
-- This will otherwise LOCK EXISTING AAL1 USERS OUT of Memento data until
-- they complete MFA. It is not part of the first migration.
--
-- These are RESTRICTIVE policies, intersecting existing per-user RLS.
-- They never grant extra access and do not remove your existing RLS policies.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','follows','posts','stories','collections','collection_stories',
    'post_likes','post_comments','notifications','direct_messages',
    'story_views','story_likes','content_shares','account_settings'
  ] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop policy if exists memento_require_verified_mfa on public.%I',t);
      execute format(
        'create policy memento_require_verified_mfa on public.%I as restrictive for all to authenticated using ((auth.jwt()->>''aal'') = ''aal2'') with check ((auth.jwt()->>''aal'') = ''aal2'')',
        t
      );
    end if;
  end loop;
end;
$$;

-- Storage write access should also require MFA: private and public buckets
-- must not be writable using just a stolen password/session at aal1.
drop policy if exists memento_storage_require_mfa on storage.objects;
create policy memento_storage_require_mfa on storage.objects as restrictive
  for all to authenticated
  using ((auth.jwt()->>'aal') = 'aal2')
  with check ((auth.jwt()->>'aal') = 'aal2');

-- If you need to undo this rollout without deleting content, run:
-- DO $$ DECLARE t text; BEGIN FOR t IN SELECT table_name
-- FROM information_schema.tables WHERE table_schema='public' LOOP
-- EXECUTE format('drop policy if exists memento_require_verified_mfa on public.%I',t);
-- END LOOP; END $$;
-- drop policy if exists memento_storage_require_mfa on storage.objects;
