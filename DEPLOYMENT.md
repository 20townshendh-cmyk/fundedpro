# Deployment

## Cheapest path

For a free setup, deploy the Next.js app on Vercel Hobby and use a free hosted Postgres database such as Neon or Supabase.

## Recommended stack

- App hosting: Vercel Hobby
- Database: Neon Postgres free tier
- Email: keep mock mode at first, or add Resend later
- Payments: keep Stripe test keys until you are ready for real checkout

## What this repo now supports

- Monorepo-safe Turbopack root for production builds
- Hosted Postgres SSL connections
- One-command Prisma migration deploy: `npm run db:deploy`

## Vercel setup

1. Push this repo to GitHub.
2. In Vercel, create a new project from the repo.
3. Set the project Root Directory to `apps/web`.
4. Leave the framework as Next.js.
5. Set environment variables before the first production deploy.

## Required environment variables

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

## Usually needed

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NINJATRADER_INGEST_TOKEN`

## Safe starter values

- Set `NEXTAUTH_URL` to your Vercel production URL exactly, for example `https://your-project.vercel.app`
- Do not include trailing spaces, newlines, or an extra trailing slash
- Set `NEXTAUTH_SECRET` to a long random string
- Use a hosted Postgres URL with `sslmode=require`
- Leave `DATABASE_SSL` empty unless you need to force it off

## Database bootstrap

After the database exists and `DATABASE_URL` points at it:

```powershell
npm.cmd install
$env:DATABASE_URL="your-hosted-postgres-url"
npm.cmd run db:deploy
```

If you want demo users and demo content in the deployed app:

```powershell
$env:DATABASE_URL="your-hosted-postgres-url"
npm.cmd run db:seed
```

## Notes

- Vercel will not run your local Docker services. The deployed app must use hosted services.
- The local Windows Turbopack permission issue should not affect Linux-based Vercel builds, and the repo now sets the monorepo root explicitly.
- This app uses direct `pg` connections, so make sure your Postgres provider allows standard TCP connections from Vercel.
