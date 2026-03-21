# Launch Checklist

## Current status

- Hosting is live on Vercel
- Database is live on Neon
- Schema migrations have been applied
- Seed data has been loaded
- Production build is unblocked
- Signup now enforces age 18+ to match the legal copy in the UI

## Required before real customer launch

### 1. Fix production environment values in Vercel

Set these in Vercel Project Settings -> Environment Variables:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

For live checkout and live email, also set:

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Optional:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `TRADING_CREDENTIAL_SECRET`
- `NINJATRADER_INGEST_TOKEN`

### 2. Make signup emails real

Signups currently require email verification before login. That means real delivery must work.

Provider steps:

1. Create a Resend account.
2. Verify a sender domain or sender address.
3. Put the live Resend API key into `RESEND_API_KEY`.
4. Put the verified sender into `RESEND_FROM_EMAIL`.
5. Redeploy.

Expected result:

- Signup sends verification emails
- Password reset sends real reset emails
- Order, credentials, certificate, and breach emails deliver for real

### 3. Make payments real

Stripe is already wired in code, but the provider setup still needs to be done in your Stripe dashboard.

Provider steps:

1. Create Stripe products only if you want dashboard-side reporting. The app already builds checkout line items dynamically.
2. Put your live or test Stripe keys into:
   - `STRIPE_SECRET_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Create a webhook endpoint in Stripe:
   - URL: `https://YOUR_DOMAIN/api/stripe/webhook`
4. Subscribe at minimum to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
5. Copy the Stripe signing secret into `STRIPE_WEBHOOK_SECRET`.
6. Redeploy.

Expected result:

- Checkout creates a Stripe Checkout Session
- Stripe redirects back to the app
- Webhook finalizes the order
- Trading account is provisioned
- Credentials email is sent

### 4. Make Google sign-in real

Provider steps:

1. Create a Google OAuth client.
2. Add the callback URL:
   - `https://YOUR_DOMAIN/api/auth/google/callback`
3. Put the credentials into:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
4. Redeploy.

### 5. Rotate exposed secrets

These should be rotated because they were used during setup:

- Neon database password
- `DATABASE_URL` in Vercel after password rotation
- `NEXTAUTH_SECRET` if you want a fresh production-only secret

## Post-launch smoke test

### Signup

1. Create a new account
2. Receive verification email
3. Verify account
4. Log in

### Login

1. Log in with email/password
2. Test forgot password
3. Test password reset email

### Google auth

1. Click Continue with Google
2. Confirm callback returns to dashboard

### Checkout

1. Log in as a trader
2. Start checkout
3. Complete Stripe payment
4. Confirm dashboard account provisioning
5. Confirm order and credentials emails arrive

### Admin

1. Log in as admin
2. Open billing, accounts, users, and payouts pages
3. Confirm the latest paid order appears

### Trade Now

1. Open trader dashboard
2. Open account detail
3. Open Trade Now
4. Confirm terminal access still works

## What still requires your provider accounts

I can prepare code, envs, deploys, and fixes, but these account-side actions still require you:

- Adding Stripe keys and webhook secret in Vercel
- Creating the Stripe webhook in Stripe
- Adding Resend API key and verified sender in Vercel
- Creating Google OAuth credentials
- Rotating the Neon password
