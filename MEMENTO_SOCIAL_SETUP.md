# Memento — camera, repost, notifications and DM voice notes

## Apply the Supabase migration
The app cannot create tables or private storage buckets by itself. On your phone or PC:
1. Visit https://supabase.com/dashboard and open your Memento project.
2. Go to SQL Editor → New query.
3. Copy the complete SQL from `supabase/memento_social_upgrade_20261115.sql` in this repo, review it, and run once.
4. The SQL adds `direct_messages.audio_path`, a private `dm-voice` bucket with restricted storage policies, and database triggers for likes, comments and @mentions in comments/stories.

**Do not run the old complete schema again**, and do not delete existing tables.

## Update the local Expo project
Pull the new GitHub commits into the **existing** working folder (not a blank checkout; this GitHub repository is missing the original `lib/` source files). Back up local modifications first.

Run:
```bash
npx expo install react-native-svg expo-camera expo-media-library expo-audio expo-file-system
npx expo start --clear
```
If you use an installed development build instead of Expo Go, rebuild it after editing `app.json` permissions.

## Test with two accounts
1. Press the camera icon at top-left. iOS asks for camera permission. Deny permission and check the crossed camera and Open Settings action.
2. Grant access and capture a photo. It should open the New post editor with your captured photo. Flash, camera flip and saving to Photos are supported.
3. Publish a post on account A, then repost it on account B. Press the header repost icon on B to view the repost.
4. Like/comment on A's post from B. On A, press the bell to see Activity.
5. Comment `@account_a` or put `@account_a` in a published story caption. Account A should get a mention notification after the SQL migration.
6. Open a DM and tap Record voice note. Grant microphone access, stop, preview, then Send voice note. Check playback on the other account.

## Important limits
- Activity is populated in the app from Supabase; remote lock-screen push alerts require a deployed push-delivery backend and app build.
- If SQL errors because your deployed tables differ from the migration assumptions, stop and compare the existing schema before changing anything.
- The GitHub repository currently does not contain the `lib/` files imported by `App.js`, so a fresh clone alone may not build.
- The images you supplied were icon references; this version draws matching scalable outline glyphs from code, rather than embedding cropped screenshots.
