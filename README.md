# FundedPro

FundedPro is a premium prop-firm SaaS built as a monorepo for the public marketing site, trader workspace, admin operations suite, challenge evaluation logic, and MT5-oriented sync workflows.

## Workspace Layout
- `apps/web`: Next.js app for the public site, trader portal, and admin portal
- `apps/worker`: worker runner for MT5 sync, lifecycle evaluation, and payout hold sweeps
- `packages/ui`: shared design system primitives and FundedPro brand components
- `packages/domain`: shared challenge logic, marketing models, and domain helpers
- `packages/db`: Prisma schema, migrations, seed scripts, and DB access
- `packages/config`: shared config utilities

## Current Product Coverage
- Premium public marketing pages for home, pricing, how-it-works, why FundedPro, FAQ, payouts, rules, about, contact, login, and signup
- Database-backed signup and login with RBAC-aware session handling
- Trader workspace with dashboard, account detail, billing, payouts, and support routes
- Admin workspace with overview, users, accounts, challenges, payouts, risk, sync, settings, and content routes
- Challenge checkout with invoice creation, paid-order finalization, and account provisioning
- Stripe checkout codepath with webhook-based paid-order reconciliation
- Shared challenge snapshot logic for evaluation progress, drawdown room, review readiness, and funded-only payout gating
- Payout hold sweeps, persisted audit logs, and admin override/review actions
- Mock MT5 provider layer with normalized account snapshot data, persisted sync history, worker cycles, and an admin sync monitor
- Email abstraction with mock delivery and a Resend-ready provider path

## Local Setup
1. Install dependencies
2. Start Docker services
3. Copy `.env.example` to `.env` if needed
4. Generate Prisma client
5. Run migrations
6. Seed demo data
7. Start the app

## Commands
```powershell
npm.cmd install
docker compose up -d
npm.cmd run db:generate --workspace @fundedpro/db
npm.cmd run db:migrate --workspace @fundedpro/db
npm.cmd run db:seed --workspace @fundedpro/db
npm.cmd run dev
npm.cmd run dev --workspace @fundedpro/worker
```

## Demo Accounts
- Trader: `trader@fundedpro.com` / `FundedPro123!`
- Pro phase trader: `protrader@fundedpro.com` / `FundedPro123!`
- Review trader: `reviewtrader@fundedpro.com` / `FundedPro123!`
- Funded trader: `fundedtrader@fundedpro.com` / `FundedPro123!`
- Breached trader: `breachedtrader@fundedpro.com` / `FundedPro123!`
- Passed trader: `passedtrader@fundedpro.com` / `FundedPro123!`
- Admin: `admin@fundedpro.com` / `FundedPro123!`

## Key Notes
- If PowerShell blocks `npm`, use `npm.cmd`.
- The local stack uses PostgreSQL and Redis through Docker Compose.
- Real payout requests should only ever come from funded accounts. Evaluation and demo states remain review-only.
- If `RESEND_API_KEY` is not configured, email sending falls back to a mock provider and logs messages locally.
- Real Stripe testing requires valid Stripe keys in `.env`, a full web-server restart after env changes, and `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
- The MT5 sync layer currently uses a mock provider so the full product can run locally before a live bridge is connected.
- Worker polling can be enabled with `WORKER_POLL_MS`, for example `30000` for a 30 second loop.

## Next Expansion Areas
- Browser E2E coverage for auth, checkout, payouts, and admin workflows
- Production hardening for auth, rate limiting, and operational monitoring
- Real MT5 bridge/provider integration
- Trade history and chart views
- Ticketed support flow
- Real content editing persistence
