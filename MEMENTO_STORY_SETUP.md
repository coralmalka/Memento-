# Story photo editor and Close Friends

After taking a story photo or selecting one, use Filters, Adjust, Rotate and Flip.
Filters: Original, Chrome, Golden, Rose, Noir, Vivid. Adjust brightness, contrast
and saturation; Reset restores the source photo. Preview and upload use the same
renderer. The full frame is preserved, with no automatic crop. Edited exports are
JPEG at quality 94, with the longest edge capped at 4096 pixels.

Your Story shares with signed-in Memento members for 24 hours. Close Friends uses
a separate private audience. Tap Edit Close Friends to search members and add or
remove them; changes save immediately. A green star labels private stories.
Private stories cannot be reposted, DM-shared, or used in collections/covers.

## Install on Windows without Git

1. Stop Expo with Ctrl+C. Open your current Memento-main folder in File Explorer.
   Click the address bar, type `cmd`, and press Enter.
2. Run this command in that window:

```bat
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Join-Path $env:TEMP 'memento-story-update.ps1'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/coralmalka/Memento-/main/scripts/update-story-editor.ps1' -OutFile $p; & $p"
```

The updater downloads one GitHub revision, backs up the files it replaces, updates
only the required files, and runs npm install and syntax validation. Your .env and
other files remain in place. It copies the SQL setup to your clipboard.

3. In your Memento Supabase project, open SQL Editor → New query, paste, and Run.
   The source is `supabase/memento_story_editor_close_friends_20261115.sql`.
   It assumes the existing social/audio migrations in this repository are applied.
   This transaction is repeatable and preserves existing content. If an error
   occurs, the transaction rolls back; resolve the missing prerequisite and rerun.
4. Return to the same command window and run:

```bat
npx expo start -c
```

Close Friends posting fails closed if setup is missing. It never silently posts
publicly. Existing public posting can still work before setup is completed.

## Privacy behavior

The migration adds a private friend list and restrictive story-read guard, plus an
isolated private media bucket for both images and original audio. Legacy permissive
policies cannot override those restrictions. Changing a private story to public or
reusing its media in posts/covers is blocked server-side. Removing a friend prevents
new authorized reads. Already downloaded photos cannot be recalled; issued private
media URLs expire after 60 seconds. Active app data refreshes every 15 seconds.

The owner retains their private archive after the story expires. Members added to
the current Close Friends list can see still-active Close Friends stories.

## Verification

```bat
npm run check:syntax
npm run test:stories
npx expo install --check
npx expo export --platform ios --platform android
```

The story tests use an isolated PostgreSQL-compatible database and Skia's CPU
renderer. They verify owner/friend/outsider/anonymous access, media and audio access,
friend removal, expiration, repost restrictions, repeated migration execution,
actual image pixels for rotation/flip/grayscale, and all filter exports.

Device check: capture a story, edit and publish it; reopen it and check the saved
image. Use a second selected account and an unselected account to verify the live
Supabase installation. Build/test success does not replace an iPhone device test.
