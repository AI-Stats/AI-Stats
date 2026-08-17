# PlanetScale staging readiness

Recorded before cutover on 2026-08-17. At the time, production remained on the
retained Supabase releases in `database/ROLLBACK-REHEARSAL.md` and no production
route or deployment had changed.

> Historical staging record. The approved production cutover subsequently
> completed; see `database/PRODUCTION-CUTOVER-2026-08-17.md`.

## Tested release candidates

- Web preview: Vercel `dpl_8UvSJrg9ufHfwzyi7G5kNDcZQ9hW`, available through
  `https://phaseo-planetscale-better-auth.vercel.app`.
- Web API staging: `https://phaseo-web-api-staging.danielbutler500.workers.dev`.
- PlanetScale target: the `phaseo/phaseo` rehearsal database reached through
  the configured runtime and migration roles.

The Vercel Preview scope contains PlanetScale, Better Auth, Google, GitHub,
GitLab, signup, and staging web-API configuration. It contains no Supabase URL,
anonymous key, or service-role key. Production and Development retain their
Supabase variables until the observation window described in `CUTOVER.md` ends.

## Passing evidence

- Production build: 271 routes prerendered; Vercel deployment reached `READY`.
- Protected preview smoke: `/`, `/models`, `/chat`, `/sign-in`,
  `/api/auth/get-session`, and `/api/_web/landing/stats` returned 200.
- Web tests: 135 files, 672 tests.
- Web API tests: 56 files, 284 tests.
- Gateway tests: 467 files and 5,346 tests passed; 45 live SDK/performance and
  explicitly unsupported Perplexity multimodal cases were skipped.
- TypeScript: `@phaseo/db`, `@phaseo/web`, `@phaseo/web-api`, and
  `@phaseo/gateway-api` passed.
- Drizzle schema check and CI secret-boundary checks passed.
- Documentation link validation and `git diff --check` passed.
- Runtime source guard found no Supabase, PostgREST, RPC, RLS-policy, or
  database-mode fallback dependency.
- PlanetScale integrity passed with 113 Better Auth users, 115 accounts, 113
  profiles, 122 workspaces, 122 memberships, no orphans or duplicates, and no
  unvalidated constraints.
- Cutover assessment passed with zero missing or changed source-authoritative
  rows and zero sequence regressions. Repository-authoritative catalogue rows
  intentionally differ after canonical import; target-only staging writes are
  still listed for explicit disposition during the freeze.
- Ten-route shadow validation passed: exact matches, bounded canonical
  catalogue contracts, and a canonical target superset for monitor options.
- Eight-route uncached performance validation passed every p95 SLO with no HTTP
  failures.

## Remaining release boundaries

- A production cutover requires an approved maintenance window, external write
  freeze, final replication LSN catch-up, final identity/sequence sync, explicit
  target-only staging-row disposition, OAuth callback updates, and coordinated
  Vercel/Cloudflare deployment. Those are production mutations and are not
  authorized by this staging rehearsal.

## Deliberately retained rollback artifacts

These are not runtime dependencies, but they mean the repository-wide
"no Supabase relics" objective is intentionally not complete before cutover:

- `supabase/` preserves the source schema and migration history needed to audit
  or repair the retained production database during the rollback window.
- `apps/web/scripts/auth/*supabase*`, the source-side replication helpers, and
  their package scripts provide the final frozen identity/data sync.
- Production/Development Vercel scopes retain the Supabase URL and credentials;
  Preview contains none of them.

After the observation window, remove those files and scripts, revoke and delete
all Supabase environment values and credentials, remove the replication
subscription/publication with `database/replication/05_cleanup.sql`, and rerun a
repository-wide case-insensitive search plus the runtime source guard. Historical
cutover and rollback documentation may name Supabase as migration history.
