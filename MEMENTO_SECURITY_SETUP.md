# Memento — Account Security Deployment

Status: **GitHub code only**. Nothing in this guide is automatically deployed
to Supabase or installed on another person's iPhone.

## Features coded

- New account form requires an email, password and phone number in E.164
  international format (+1...), but stores the unverified number in Auth
  metadata until enrollment. The number is not shown on the public profile.
- Supabase email confirmation: must be enabled in **Authentication → Providers →
  Email**. Configure a reliable custom SMTP provider before production.
- Existing accounts can turn on SMS-based MFA in **Settings → Two-factor
  authentication**.
- New accounts created in this version are gated on verified SMS MFA before
  opening the app. An existing account with MFA enrolled is also challenged
  after password or email-link login, including when a remembered session only
  has AAL1.
- Sign-in with an email OTP/link uses `signInWithOtp`. It is an **initial
  authentication method**, not a genuine independent email-based second factor.
  The Supabase email template determines whether email shows a code or a link.
- Unfamiliar IP alert backend is in this repository, but **does not send
  anything until deployed, configured with secrets and scheduled**.

## First: enable MFA/SMS in Supabase

1. Open https://supabase.com/dashboard → your Memento project.
2. Navigate to Authentication → Providers → Email and enable email confirmation.
   Set up SMTP (default development emails are heavily rate limited).
3. In Authentication settings, enable **MFA Phone / SMS verification**.
4. Configure a real SMS messaging provider (e.g. Twilio) in Supabase and
   configure rate limits and CAPTCHA to prevent SMS abuse.
5. Test MFA with a second account before rolling it out to existing users.
   Phone MFA is not live until the provider is working. Use a REAL phone number
   capable of receiving SMS; don't use a fake number.

Important: **new users can get stuck at the verification screen until SMS
delivery has been enabled.** Do not publish the new signup flow to everyone
until you have tested SMS delivery.

## Next: optionally enforce MFA in the database

After ALL existing users have a verified factor, add to your local, private
Expo environment (not GitHub):
```dotenv
EXPO_PUBLIC_MEMENTO_REQUIRE_MFA=true
```

Then run the optional hardening migration
`supabase/memento_optional_strict_mfa_rls_20261115.sql` in Supabase SQL
Editor. This adds RESTRICTIVE RLS policies to protect data API and storage
access from password-only sessions, even if somebody bypasses the UI.

**WARNING:** This script will cause existing users with AAL1-only sessions to
receive database permission failures until they complete MFA. Do not activate
it before verifying enrollments, or you can lock out users. Keep the rollback
instructions in the SQL file.

## Optional automatic unusual-login email alerts

These emails are intended to tell the user about **successful sign-ins from a
new IP address**. The IP comes from `auth.sessions.ip`, not a value supplied by
the iPhone. Mobile networks, travel and VPNs can cause false positives.

1. Review and run `supabase/memento_security_login_alerts_20261115.sql` in
   Supabase SQL Editor. This adds a private table and service-role-only RPCs.
2. Create an email-sending account at https://resend.com and verify a domain
   you control as a sender.
3. Configure **Supabase Edge Function secrets**, without committing them or
   sending them in chat:
   - `RESEND_API_KEY` — server-only key from the verified sender
   - `MEMENTO_SECURITY_FROM_EMAIL` — e.g. `security@yourdomain.com`
   - `MEMENTO_LOGIN_ALERT_CRON_SECRET` — long random secret
   - `MEMENTO_ENABLE_IP_GEOLOCATION=true` (optional, opt-in; if enabled, the
     IP is shared with ipwho.is for APPROXIMATE city/country detection)
   - Supabase's built-in `SUPABASE_URL` and
     `SUPABASE_SERVICE_ROLE_KEY` are required server-side.
4. Deploy `supabase/functions/memento-login-alerts/index.ts` as the
   `memento-login-alerts` Edge Function. In `supabase/config.toml` the
   function's `verify_jwt` is disabled, so its own independent
   `x-cron-secret` check MUST be configured before deployment.
5. Schedule a **Supabase Cron → HTTP Edge Function** request every 5 minutes:
   - Method: POST
   - URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/memento-login-alerts`
   - Header: `x-cron-secret: YOUR_PRIVATE_CRON_SECRET`
   - Body: `{}`
   Store the secret in Supabase Vault instead of hardcoding it in an
   accessible Cron definition; review its pg_net queue visibility first.
6. Test with two successful sessions from genuinely different public IPs
   (e.g. home Wi-Fi then cellular data), and confirm a delivered email.

**Security limitations:** This cannot necessarily alert on *failed* password
attempts; Supabase's Password Verification Attempt hook is a separate
advanced feature with plan limitations. It reports successful new-IP sessions,
not guaranteed location changes or proof of a hacker. Delivery is asynchronous
and depends on cron, Resend and the relevant Supabase services. The first
observed IP is the baseline and is not considered unfamiliar.

## Do not compromise user security

- Never include Supabase secret/service-role credentials or email API keys in
  Expo environment variables, GitHub or the app bundle.
- Do not promise that an email alert blocks a login: **MFA plus restrictive
  server-side RLS** are the access controls. Alerts are informational only.
- Never ask people to share their security codes in messages. A phone number
  alone is not proof of ownership until MFA verification succeeds.
- Enable Supabase Auth rate limits, CAPTCHA, password protections and
  account recovery. Offer a recovery route before making 2FA mandatory.
- For production, use a real development or production app build and test
  login, MFA, email confirmation, password reset and logout on both iOS and
  Android. Expo Go startup alone is insufficient.

## Sources

- Supabase phone MFA: https://supabase.com/docs/guides/auth/auth-mfa/phone
- Supabase TOTP MFA: https://supabase.com/docs/guides/auth/auth-mfa/totp
- Email confirmation / OTP: https://supabase.com/docs/guides/auth/passwords
- Supabase Auth session IP: https://supabase.com/docs/guides/auth/audit-logs
- Edge Function scheduling: https://supabase.com/docs/guides/functions/schedule-functions
- Auth hook availability: https://supabase.com/docs/guides/auth/auth-hooks
