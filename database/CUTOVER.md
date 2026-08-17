# Supabase to PlanetScale hard cutover

Production remains on its last known-good Supabase deployment until every gate
below is recorded as passing. The rebuilt artifacts contain only PlanetScale,
Drizzle, Hyperdrive, and Better Auth runtime paths; there is no database-mode
feature flag. Because Vercel and Cloudflare cannot switch atomically, freeze
writes while deploying the exact revisions already proven in staging.

## Preconditions

- Tag and retain the last known-good Supabase web, web-api, and gateway
  deployments. They are the pre-write rollback artifacts.
- Use separate least-privilege PlanetScale runtime and migration/replication
  roles. Rotate any credential exposed during setup.
- Stage `PLANETSCALE_DATABASE_URL`, `PLANETSCALE_MIGRATION_DATABASE_URL`,
  `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, social credentials, and optional SSO
  provider JSON in Infisical.
- Register the production Better Auth callback URL with Google, GitHub, and
  GitLab, but do not remove the retained Supabase callbacks until rollback is
  no longer allowed.
- Bind one cache-disabled `PLANETSCALE_HYPERDRIVE` configuration to web-api and
  gateway API.
- Apply every reviewed Drizzle and Better Auth migration.
- Confirm logical replication used `copy_data=true` against empty target
  application tables and every subscription relation reports `ready`.
- Prove the exact release candidates with typechecks, tests, authenticated
  browser smoke tests, the endpoint shadow matrix, integrity assessment,
  performance thresholds, and rollback rehearsal.

## Freeze and final synchronization

1. Enable an edge maintenance rule that rejects external mutations and gateway
   inference requests. Keep only an allowlisted operator path for health checks.
2. Stop scheduled writers and queue consumers. Confirm no application process
   can write to Supabase.
3. Record `pg_current_wal_lsn()` on Supabase. Wait until PlanetScale has received
   and applied that LSN and every subscription relation remains `ready`.
4. Dry-run and apply `auth:migrate:supabase -- --sync` to reconcile the frozen
   identity set, password hashes, linked providers, MFA markers, and deletions.
5. Run `db:sync-sequences`, then `db:sync-sequences -- --apply`.
6. Run `db:assess-cutover` and `db:verify-planetscale-integrity`; archive their
   JSON. Any missing/changed source row, sequence regression, orphan, duplicate
   identity, or unvalidated constraint aborts the cutover. Review and explicitly
   approve or remove every reported target-only staging row.
7. Take a final Supabase backup and record the freeze timestamp and source LSN.

## Coordinated deployment

1. Deploy the exact tested PlanetScale web-api and gateway revisions with their
   Hyperdrive bindings while the write freeze remains active.
2. Deploy the exact tested Better Auth web revision with sign-up disabled.
   Set `BETTER_AUTH_URL` to the production origin as part of that coordinated
   deployment; never promote a preview artifact whose base URL still names the
   preview alias.
3. Verify health from all three deployments, then run password, Google, GitHub,
   GitLab, passkey, TOTP, migrated-MFA re-enrollment, account read/mutation,
   workspace isolation, key creation, billing, OAuth consent/device flow,
   catalogue, and one reversible free-model chat/gateway smoke test.
4. Re-run the shadow matrix against the frozen Supabase deployment. Investigate
   every semantic difference before allowing traffic.
5. Enable Better Auth sign-up only after the full frozen smoke matrix passes.

## Resume and observe

1. Resume scheduled jobs and queue consumers against PlanetScale.
2. Remove the write freeze. Continuously watch Better Auth failures, PostgreSQL
   errors, Hyperdrive saturation, p95/p99 latency, billing writes, and gateway
   error rate.
3. Keep Supabase online and application-read-only for the agreed verification
   window. Do not immediately remove replication or the retained deployments.
4. After the verification window, run `database/replication/05_cleanup.sql`,
   revoke Supabase runtime credentials, remove Supabase runtime configuration,
   and disable the paid Supabase IPv4 add-on.
5. Delete the retained `supabase/` tree, source migration/replication utilities,
   Supabase-named package scripts, and obsolete rollback-only configuration.
   Keep only historical documentation that explains the completed migration.
6. Prove repository cleanup with `pnpm validate:no-supabase-runtime`, package
   dependency inspection, a case-insensitive repository search, all typechecks
   and tests, and a fresh production smoke test before declaring the migration
   complete.

## Abort and rollback boundary

Before lifting the freeze, rollback is safe: redeploy the retained Supabase
revisions for all three services, verify Supabase health, and only then remove
the freeze. Do not attempt to flip an environment flag; the rebuilt artifacts
intentionally contain no Supabase runtime.

After PlanetScale accepts any production write, direct rollback is unsafe
because replication is one-way. Keep traffic frozen and either repair forward
or explicitly reconcile the complete PlanetScale write set back into Supabase
before restoring the retained Supabase deployments.
