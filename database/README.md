# Database migrations

SQL migrations in `database/migrations` are reviewed artifacts and must be applied in filename order with the restricted migration credential. Application runtimes use `PLANETSCALE_DATABASE_URL`; schema changes use `PLANETSCALE_MIGRATION_DATABASE_URL`.

The Better Auth schema is generated from `apps/web/better-auth.cli.ts`:

```powershell
pnpm --filter @phaseo/web exec auth generate --config better-auth.cli.ts --output ../../database/migrations/<timestamp>_<name>.sql
```

Generation only writes SQL. Review the output before applying it. Never run the Better Auth CLI's direct `migrate` command against production.

Apply a reviewed migration with PostgreSQL's `ON_ERROR_STOP` enabled, then verify the expected objects. PlanetScale role URLs include TLS parameters intended for libpq; Node runtime code normalizes those parameters and always verifies the server certificate.

The initial Better Auth migration was applied to the rehearsal `phaseo/phaseo` database on 2026-08-14. It has not enabled Better Auth or changed production traffic.

## Supabase identity import

`apps/web/scripts/auth/migrate-supabase-users.ts` imports users and account links while preserving user IDs and compatible bcrypt hashes. It excludes sessions, OAuth tokens, and non-portable MFA secrets. Users who had a verified Supabase MFA factor are marked for mandatory Better Auth re-enrollment and denied private API/OAuth access until that enrollment succeeds. The command is a rollback-only dry run unless `--apply` is supplied, and it refuses to run unless the target Better Auth user and account tables are empty.

```powershell
pnpm --filter @phaseo/web auth:migrate:supabase
pnpm --filter @phaseo/web auth:migrate:supabase -- --apply
```

The initial import requires empty Better Auth `user` and `account` tables. During
the final write freeze, reconcile users, password changes, provider links, and
deletions that occurred after the initial import:

```powershell
pnpm --filter @phaseo/web auth:migrate:supabase -- --sync
pnpm --filter @phaseo/web auth:migrate:supabase -- --sync --apply
```

The sync is transactional and makes the Better Auth identity/account set match
the frozen Supabase source exactly. Always run its dry run first.

It requires `SUPABASE_MIGRATION_DATABASE_URL` and `PLANETSCALE_MIGRATION_DATABASE_URL` in the process environment. Supply them through Infisical rather than a checked-in environment file. The Supabase shared pooler uses encrypted `sslmode=require` semantics; the PlanetScale destination always uses full certificate verification.

## Cutover parity assessment

After writes are frozen and logical replication reports no lag, compare every
`public` and `auth` table plus all sequences before deploying the rebuilt
PlanetScale artifacts:

```powershell
pnpm --filter @phaseo/web db:assess-cutover
```

The command is read-only, prints JSON suitable for archiving with the cutover
record, and exits `2` for any missing relation, missing or changed source row,
sequence regression, identity/account mismatch, or loss of MFA-protected-user
coverage. Target-only staging rows are reported separately; explicitly approve,
archive, or remove them before cutover. Do not deploy until the command exits
`0` and its reported target-only rows have been reviewed.

Sequence values are not copied by logical replication. During the final write
freeze, first preview and then apply a buffered target sequence advance:

```powershell
pnpm --filter @phaseo/web db:sync-sequences
pnpm --filter @phaseo/web db:sync-sequences -- --apply
```

The default buffer is `10000`; override it with
`PLANETSCALE_SEQUENCE_BUFFER` for high-write sequences. The assessor accepts a
target sequence at or ahead of its source value.

## Hyperdrive and shadow validation

Create one cache-disabled configuration after rotating the PlanetScale role:

```powershell
pnpm --dir apps/web-api exec wrangler hyperdrive create phaseo-planetscale-fresh --connection-string="$env:PLANETSCALE_DATABASE_URL" --caching-disabled
```

Add the returned ID to both Worker configurations using
`database/hyperdrive-bindings.example.toml`. Cache must stay disabled for auth,
permissions, billing, and read-after-write correctness. Deploy the rebuilt
web-api preview, then compare its responses against the retained Supabase
deployment:

```powershell
$env:SHADOW_SOURCE_ORIGIN="https://<supabase-backed-web-api>"
$env:SHADOW_TARGET_ORIGIN="https://<planetscale-preview-web-api>"
pnpm --filter @phaseo/web db:shadow-validate
```

`SHADOW_PATHS_JSON` can replace the default public endpoint matrix. Authenticated
comparisons accept source/target authorization or cookie values through the
corresponding `SHADOW_*` environment variables; values are never printed.

## Enterprise SSO import

The Better Auth SSO plugin is mounted with self-service registration disabled.
Store an array of provider definitions in `BETTER_AUTH_SSO_PROVIDERS_JSON` in
Infisical, then validate and apply it with:

```powershell
pnpm --filter @phaseo/web auth:migrate:sso
pnpm --filter @phaseo/web auth:migrate:sso -- --apply
```

Each entry contains `providerId`, `issuer`, `domain`, an owning Better Auth
`userId`, and exactly one of `oidcConfig` or `samlConfig`. If Supabase stored a
different identity provider key (commonly an SSO-generated key), include
`sourceProvider`; the identity importer maps that source key to Better Auth's
`providerId`. IdP credentials and certificates must never be committed.

## Logical replication

Reviewed source, target, monitoring, and cleanup SQL lives in
`database/replication`. Use the Supabase direct IPv4 endpoint on port `5432`;
pooled URLs cannot create the replication connection. The source preflight
fails closed for tables without a usable replica identity. Run
`00_source_replica_identity_full.sql` first to apply the conservative
migration-time fallback; monitor Supabase WAL usage because FULL identities can
increase it.

The production migration must start from empty application tables: recreate or
reset the rehearsal target, run `00_target_bootstrap.sql`, restore the reviewed
`public`/`private` schema without data, and run
`00_target_compatibility.sql`. Then create the subscription with the template's
mandatory `copy_data=true`. This gives the initial copy and WAL stream a single
consistent snapshot. Never substitute `copy_data=false` after an ordinary dump;
matching row counts cannot detect missed updates or deletes.

The publication contains every `public` table and only the `id` column from
`auth.users`, which preserves application foreign keys without carrying
Supabase sessions, refresh tokens, or other Auth internals into PlanetScale.
The final identity sync reads the frozen Supabase source directly and populates
Better Auth's user/account tables.

After every subscription relation reaches `ready`, apply the Better Auth
migrations and identity/SSO imports. At freeze time, the target `received_lsn`
must reach the frozen Supabase `pg_current_wal_lsn()`, and the parity assessor
must exit `0` before the coordinated deployment.
