# Memento — complete testing and Supabase setup

The code runs in Expo Go, but opening the app alone does not verify database permissions,
uploads, messaging, audio playback, or notifications. Keep a copy of your original
working project before testing a new GitHub download.

## Step 1: Keep your original Memento safe

Keep your existing laptop project untouched. Test only in your downloaded
`Memento--main` folder. A backup GitHub branch also exists:
`backup-before-lib-repair-20261115`.

Changes made to GitHub **after downloading the ZIP** are not automatically present
in `Memento--main`. Open the **live GitHub links** below when copying the newest SQL.

## Step 2: Inspect Supabase without changing anything

Open https://supabase.com/dashboard → your Memento project → SQL Editor → New query.

Copy and run the read-only checker:
`supabase/memento_database_check_20261115.sql`.

It identifies missing tables, columns, and Storage buckets. Do not run the old
complete schema again on a database that already has users and content.

## Step 3: Apply additive migrations individually

In Supabase SQL Editor, review and run each query separately. Stop and inspect
any errors; don't blindly drop tables or disable RLS.

1. `supabase/memento_profile_upgrade_20261115.sql`
   Adds profile details, `avatar_path` and public **profile pictures** Storage.
   Without a photo the app displays its default person-circle icon.
2. `supabase/memento_social_upgrade_20261115.sql`
   Adds `direct_messages.audio_path`, private `dm-voice` Storage and server-side
   triggers for post likes, comments and @mentions in comments/stories.
3. `supabase/memento_original_audio_20261115.sql`
   Adds private original music uploads to `original-audio`.

Ensure the existing `memories` Storage bucket and its row-level-security
policies allow authorized uploads and viewing. Existing app tables and their RLS
are required. The upgrade scripts do not create every base table.

The bucket access model matters: profile pictures intentionally use a public
bucket; private messages and original-audio remain private. A public bucket
does not require authentication for downloads.

After migration, rerun the read-only checker and investigate any remaining
`MISSING / CHECK CONFIG` rows.

## Step 4: Test functionality with two accounts

1. Sign in, close Memento, relaunch it; confirm you remain signed in.
2. Open Edit Profile. Change display name, username, bio and links; add a real
   photo; save. Refresh and confirm the photo/details persist.
3. Open the camera icon, grant permission, try front/rear, flash,
   capture a photo, send it to the post editor, and save to Photos.
4. Upload another photo from the library and post it with a caption and
   hashtags. Confirm the image looks right and has no automatic cropping.
5. Create and publish a Story; inspect its 24-hour expiry and the archive.
   Add archived stories to a memory collection.
6. With account B follow account A, like and comment on a post, and @mention A.
   Confirm account A's Activity bell receives the events.
7. Open DMs; send and read a text message both ways. Record and upload a voice
   note and check playback on the other device.
8. Repost somebody else's post; inspect the Reposts page.
9. Search the Apple Music catalog or paste an official music link;
   upload an original audio file to test the private audio bucket.
10. Check privacy: signed-in users should see their permitted public content
    but not another person's private archive or private messages.
11. Verify Settings' permissions, profile editing, manual refresh and sign-out.

## Step 5: Know what is *not* finished

- Remote/lock-screen push alerts require an appropriate development or
  production build, push credentials and a deployed push delivery backend.
  In-app Activity is separate from remote push delivery.
- Video upload/editor, advanced camera filters/effects, video compression/HD
  preservation guarantees, moderation/report/block features, and direct
  Instagram/X OAuth publishing have **not been completed** in this repo.
  External sharing currently uses links or the system share sheet.
- The UI is not a substitute for testing Supabase RLS with two separate accounts.
- Dependences must match the local Expo SDK, and the `package-lock.json` in Git
  may need regeneration after installing recent packages.

## Step 6: Run the test copy on your laptop

In File Explorer, open your `Memento--main` project folder, type `cmd` in
the address bar, and run one command at a time:

```bat
npm install
npx expo install --fix
npx expo-doctor
npx expo start --clear
```

If already running on your iPhone, no need to repeat these unless files change
or Expo reports an issue. Keep your original Memento folder untouched.

## Troubleshooting

- If registration or login succeeds but the feed doesn't load, check the base
  Supabase tables and RLS, and confirm the public Expo environment variables.
- If pictures don't upload, inspect Storage bucket names and upload policies.
- If voice messages upload but recipients cannot listen, inspect
  `dm-voice` read policies and the `direct_messages` row visibility.
- If new profile fields fail to save, the latest profile migration may not have
  been applied. The ZIP downloaded before the migration was updated contains
  an older SQL file—use the latest file on GitHub.
- Never paste a Supabase service-role or secret key into the client app or into
  a public GitHub repository.
