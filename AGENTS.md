# FundedPro Engineering Guide

## Mission
FundedPro is a production-grade proprietary trading firm SaaS with a premium fintech experience across the public site, trader portal, and admin operations suite. Every change should strengthen trust, clarity, risk visibility, and operational reliability.

## Coding Standards
- Use TypeScript everywhere unless a tool requires another language.
- Prefer server components by default in Next.js; use client components only when interactivity requires them.
- Keep functions small and intention-revealing.
- Validate all external input at system boundaries.
- Prefer composition over inheritance.
- Avoid hidden magic. Business rules must be explicit and testable.

## Architecture Boundaries
- `apps/web`: Next.js application for public marketing pages, trader portal, and admin portal.
- `apps/worker`: background jobs for MT5 sync, notifications, reconciliation, and scheduled processing.
- `packages/ui`: reusable design system primitives and FundedPro brand components.
- `packages/domain`: shared business types, constants, enums, rule helpers, and DTO contracts.
- `packages/db`: Prisma schema, migrations, seeds, and database access helpers.
- `packages/config`: shared TypeScript, lint, Tailwind, and runtime config utilities.
- Keep UI code out of domain packages.
- Keep persistence concerns out of presentation components.
- Route handlers and server actions may orchestrate services, but challenge logic and MT5 normalization belong in domain/service modules.

## Naming Conventions
- Components: `PascalCase`
- Files for components: `kebab-case.tsx` unless framework convention requires otherwise
- Utility modules: `kebab-case.ts`
- Prisma models: `PascalCase`
- Database columns: `camelCase` in Prisma, snake_case only if required by SQL conventions or external systems
- Environment variables: `UPPER_SNAKE_CASE`
- Feature flags and statuses should use explicit enums, not loose strings

## Testing Commands
- Root quality gate: `npm run check`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Unit tests: `npm run test`
- E2E tests: `npm run test:e2e`
- Database seed verification: `npm run db:seed`
- Worker sync verification: `npm run worker:dev`

## Migration Workflow
1. Update Prisma schema in `packages/db/prisma/schema.prisma`
2. Create migration with `npm run db:migrate`
3. Review SQL output for safety and data retention impact
4. Update seeds if reference data changed
5. Add or update tests that cover the schema-dependent feature

## Security Requirements
- Hash passwords with Argon2 or bcrypt using vetted library settings.
- Never store secrets in code or sample data.
- Protect admin routes and privileged APIs with RBAC checks.
- Audit-log all sensitive actions: payouts, account overrides, billing adjustments, auth state changes, and content publication.
- Apply rate limits to auth, checkout, support, and payout endpoints.
- Render untrusted content safely and sanitize CMS-rich text before display.
- Use parameterized ORM queries only.
- Log legal acceptance events and KYC state transitions, but do not claim legal compliance is complete without external review.

## Design System Rules
- The FundedPro look is premium, dark, and trader-focused. Avoid generic dashboard templates.
- Use the shared tokens from `packages/ui` and `apps/web/app/globals.css`.
- Prioritize contrast, spacing consistency, and strong typography hierarchy.
- Status colors must stay consistent:
  - pass: green
  - fail: red
  - warning: amber
  - funded: cyan
  - breached: magenta-red
  - review: blue
- Tables, cards, and charts should feel refined and information-dense without looking crowded.

## Definition Of Done
- Feature has tests proportional to risk.
- Types, lint, and tests pass.
- Empty states are intentional and styled.
- Copy is production-ready and trader-facing.
- Security and authorization were reviewed.
- Documentation and seeds were updated if behavior changed.

## MT5 Adapter Rules
- All MT5 integrations must implement the provider contract in the domain layer.
- Raw provider payloads must be retained for admin inspection when safe to store.
- Sync jobs must be idempotent.
- Reconciliation must support retries and dead-lettering.
- Mock MT5 fixtures must mirror realistic account, trade, and symbol payloads.
- Never let provider-specific fields leak directly into UI without normalization.

## Challenge Engine Testing Rules
- Cover pass, fail, review, reset, and funded transitions.
- Test daily drawdown, overall drawdown, static drawdown, and trailing drawdown logic separately.
- Test phase progression, minimum trading days, and consistency calculations.
- Test rule behavior using fixtures with both intraday and multi-day trade histories.
- Treat monetary calculations as precision-sensitive and avoid float drift.

## Admin Authorization Rules
- Admin routes require authenticated admin role.
- Risk overrides and payout decisions require elevated permission checks.
- Sensitive views must show actor identity and audit references.
- Admin impersonation, if added later, must be visibly labeled and auditable.
