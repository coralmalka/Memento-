# Memento v0.3 — Cloud starter (Expo + Supabase)

This is a **development prototype**, not an App Store-ready social network. It includes working client/database code for email accounts, cloud posts, private Story archive, 24-hour published Stories, public/private rectangular Memory Collections, and optional **red** hashtags. Your own Supabase project is required; no live service or users have been provisioned for you.

## 1. Create Expo project

```bash
npx create-expo-app@latest memento --template blank
cd memento
npx expo install expo-image-picker expo-file-system @react-native-async-storage/async-storage
npx expo install @supabase/supabase-js react-native-url-polyfill
npm install base64-arraybuffer
```

Copy `App.js`, `app.json`, the `lib/` directory and `.env.example` from this bundle to your new `memento/` directory. **Do not overwrite your Expo-generated package.json** with the bundle's metadata-only package.json; Expo's generated dependency versions are important. Rename `.env.example` to `.env`.

## 2. Create your Supabase project

1. Create a new Supabase project at https://supabase.com/dashboard.
2. In SQL Editor, run `supabase/schema.sql` from this bundle. It creates tables, private `memories` Storage bucket, policies, 24-hour Story enforcement and a new-account profile trigger.
3. In `.env`, set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from your project dashboard. **NEVER put a secret/service-role key into a mobile app.**
4. Enable Email authentication. Email verification is recommended (new accounts may have to confirm email before first sign-in).
5. Start: `npx expo start` and scan using Expo Go on iPhone or Android. Reboot Expo after changing `.env`.

## 3. Test two real accounts

- Sign up with two different email addresses and confirm email if required; sign in.
- Edit each profile to set a memorable username (3–24 lowercase letters, numbers or underscores).
- Publish a photo with `#nostalgia`: hashtag text appears **red**. Explore → Hashtags → search `nostalgia`. Tags are optional.
- Follow the other account; refresh Home to see their posts chronologically.
- Post a Story. It appears in Home for **24 hours**, expires according to the DB timestamp and stays available to the creator in the private archive.
- Save a photo directly to private archive (it will never appear in the active Story feed).
- Create a rectangular Memory Collection, choose archived Stories, cover and Public visibility. Visit that account from the other device/account to view the collection. Private collections are only visible to their creator.
- Reorder, edit or delete collections; delete archived Stories. Changes sync on refresh or the periodic poll.

## Architecture & privacy

`Expo iOS/Android → Supabase Auth → Postgres (RLS) + private Storage (signed URLs)`.

- Published Stories have `published_at` stamped by a server-side trigger and `expires_at` generated 24 hours later; the database visibility rule honors the expiry. An expired Story's bytes remain in the private archive; **they are not physically deleted after 24 hours**. This is intentional.
- An archived Story placed in a **public** collection is visible to other authenticated accounts, even after the Story's 24-hour publication period ends. Public collections explicitly override private archive access for selected Stories.
- Private archives, private collections, and photo media are protected by RLS and Storage policies. Signed URLs are short-lived (1 hour) and may remain usable until expiration if a collection is made private; sensitive products need a stricter delivery design.
- Collections are shared **inside Memento** by visiting someone else's profile; system sharing currently sends text telling someone to search for the user. Deep-link routing and web share pages are not built.
- Hashtag highlighting uses Unicode-aware matching; hashtags are clickable in post/Story captions and appear red (`#D92D32`). Hashtag search uses recent loaded posts (up to 100), **not a global indexed search yet**.
- The demo has no push notifications, DMs, comments, likes, video, reporting, blocks, content moderation, account deletion UI, legal policies, or production operations. Implement these before public launch. Photos are currently expected to be JPEG uploads; picker quality lowers size but media-format compatibility needs more testing on both platforms.
- RLS governs access; app UI filtering alone is never a security boundary. Signed URL refresh happens on pull-to-refresh or a one-minute poll.

## Known engineering limitations / backlog

1. Add robust pagination, realtime subscriptions, graceful offline state, and upload retry/cleanup for orphan files.
2. Add proper media transcoding and moderation, content reporting, block controls, abuse rate limits, and age protections.
3. Add deep links, shareable web views, password reset, delete/export account, and privacy controls.
4. Add tests against a real Supabase test instance and physical iOS/Android devices. This source has not been deployed or end-to-end tested in this environment.
5. Database currently allows updating/deleting an archived Story; Story editing should be further restricted for production audit integrity.

Memento is an independent concept and is not affiliated with Instagram or Meta.
