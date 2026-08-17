# PlanetScale, Drizzle, and Better Auth architecture

## Decision

Phaseo's rebuilt data and identity plane uses PlanetScale Postgres, Drizzle,
Cloudflare Hyperdrive, and Better Auth. Supabase remains only as the frozen
production source and rollback system until the hard-cutover gates pass. The
rebuilt runtime has no Supabase/PostgREST client, RPC executor, RLS boundary,
database-mode feature flag, or compatibility adapter.

## Runtime architecture

- `@phaseo/db` owns the Drizzle schema, connection construction, TLS handling,
  Hyperdrive integration, transaction helpers, and focused schema exports.
- Web-api and gateway API access data through typed repositories and explicit
  services. Tenant identity and workspace scope are required inputs at those
  boundaries rather than implicit PostgreSQL request settings.
- Worker traffic uses the cache-disabled `PLANETSCALE_HYPERDRIVE` binding.
  Administrative scripts and migrations use a separate direct PlanetScale role.
- Better Auth is the canonical browser and mobile identity service. Web-api and
  gateway session validation use Better Auth cookies or the PlanetScale-backed
  session store; no Supabase JWT fallback exists in the rebuilt artifact.
- Stateful object workloads remain in Cloudflare R2 or Durable Objects. The
  migration inventory found no required Supabase Storage or Realtime runtime.

## Authorization and SQL

Authorization is enforced by application services and repository predicates.
Every workspace-scoped operation must bind the authenticated user and workspace
in the query or validate membership before mutation. Atomic billing, wallet,
key, and concurrency-sensitive operations use explicit Drizzle transactions and
row locks rather than remotely callable database functions.

The PlanetScale target has:

- no enabled row-level security tables or `public` policies;
- no `auth.uid()` column defaults;
- no functions, triggers, or views that inspect `auth.uid()`, `auth.jwt()`, JWT
  request settings, PostgREST request settings, or `pgrst.*` state; and
- no runtime dependency on a PostgREST `/rpc/` endpoint.

`auth.users` may exist temporarily as an identity-copy anchor while logical
replication preserves source UUID foreign keys. It is not an authentication
service and is removed only after the final replication/foreign-key cleanup is
reviewed. Better Auth's `user`, `account`, `session`, passkey, and MFA tables are
the target identity authority.

## Schema changes

Drizzle migrations under `packages/data/db/src/generated` are the canonical
target history. Generate schema-derived changes with `drizzle-kit generate` and
use a custom Drizzle migration for reviewed SQL that is not represented by the
TypeScript schema. Apply migrations only with the restricted migration role,
then run `drizzle-kit check`, connection verification, integrity verification,
and affected application tests.

The historical `supabase/migrations` tree is retained only to reproduce or
repair the production source before cutover. New application schema work must
not be added there.

## Identity migration

The importer preserves stable user UUIDs, compatible password hashes, verified
emails, and linked Google/GitHub/GitLab accounts. It does not copy sessions,
refresh tokens, OAuth provider tokens, or non-portable MFA secrets. Migrated MFA
users must re-enrol before private API access. The final frozen sync is
transactional and followed by orphan, duplicate-email, membership, constraint,
and profile-parity checks.

## Deployment and rollback

This is a hard artifact cutover, not a runtime flag rollout. Production keeps
running the retained Supabase revisions while the PlanetScale revisions are
tested in staging and preview. During cutover, writes are frozen, replication
catches up, identities and sequences are reconciled, and the exact tested web,
web-api, and gateway revisions are deployed together.

Before PlanetScale accepts a production write, rollback means redeploying all
retained Supabase revisions while the freeze remains active. After a target
write is accepted, rollback requires explicit reverse reconciliation or a
forward repair; one-way logical replication makes a flag-only rollback unsafe.
The executable operator sequence is in `database/CUTOVER.md`.

## Current verification evidence

The rehearsal target currently proves:

- 151 application tables and five applied Drizzle migration entries;
- zero legacy RLS policies, `auth.uid()` defaults, Supabase context functions,
  PostgREST context functions, dependent triggers, or dependent views;
- 113 Better Auth users matching 113 Phaseo profiles, 115 linked accounts, 122
  workspaces, and 122 memberships with no detected identity or ownership orphan;
- every source row present unchanged in the target, with target-only staging
  rows reported separately for operator review; and
- authenticated Google login and a successful free-model chat response in the
  Vercel preview.

These are rehearsal results, not permission to cut production over. Performance
thresholds, the complete frozen smoke matrix, final replication LSN, final
identity sync, rollback rehearsal, and explicit operator approval remain hard
gates.
