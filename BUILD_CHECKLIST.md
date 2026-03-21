# FundedPro Build Checklist

## Phase 0
- [x] Audit existing repository
- [x] Write implementation plan
- [x] Create `AGENTS.md`
- [x] Replace static site with monorepo scaffold

## Phase 1: Foundation
- [x] Create workspace tooling and shared configs
- [x] Add Next.js app shell
- [x] Add shared UI package
- [x] Add domain package
- [x] Add Prisma schema and seed strategy
- [x] Add worker scaffold
- [x] Add Docker and Compose baseline

## Phase 2: Brand and Marketing
- [x] Define design tokens, typography, spacing, and status colors
- [x] Implement SVG FundedPro wordmark
- [x] Build marketing home page
- [x] Build pricing page
- [x] Build how-it-works page
- [x] Build why FundedPro page
- [x] Build FAQ page
- [x] Build payouts page
- [x] Build trading rules page
- [x] Build about page
- [x] Build contact page
- [x] Add SEO metadata, sitemap, robots, and Open Graph support

## Phase 3: Auth and Billing
- [x] Implement signup and login
- [x] Add session handling and RBAC
- [ ] Add Stripe checkout
- [x] Add orders and billing history
- [x] Add transactional email abstraction

## Phase 4: Trader Portal
- [x] Build trader overview dashboard
- [x] Build account detail and compliance widgets
- [x] Build trade history and chart views
- [x] Build payout request flow
- [x] Build notifications, profile, billing, and support

## Phase 5: Rules and MT5
- [x] Implement challenge rules engine
- [x] Implement account state machine
- [x] Implement MT5 provider interface
- [x] Implement mock MT5 provider
- [x] Implement worker polling and sync health views

## Phase 6: Admin
- [x] Build admin overview
- [x] Build users/accounts/challenges/payout/risk/settings/content tools
- [x] Add audit log browser
- [x] Add manual override flows

## Phase 7: Quality and Delivery
- [ ] Add unit, integration, and E2E coverage
- [x] Seed realistic demo data
- [x] Verify local startup
- [ ] Verify Docker startup
- [x] Write onboarding and architecture docs
