# PlanetScale to Supabase rollback

This branch restores the application and Supabase schema state from commit
`416351930b28869af498b68d7f8aeed965d98cf5`, immediately before the PlanetScale
cutover.

The reconciliation command discovers tables shared between PlanetScale's
application schemas and Supabase `public`. It refuses schema drift, skips
partition roots, compares keyed row digests, and reports only aggregate counts.
No database writes occur without `--apply` and all production confirmations.

## Dry run

Provide the migration connection strings through Infisical, then run:

```powershell
pnpm --filter @phaseo/web db:rollback:planetscale:dry-run
```

Required environment variables:

- `PLANETSCALE_MIGRATION_DATABASE_URL`
- `SUPABASE_MIGRATION_DATABASE_URL`

The dry run reports missing Supabase Auth users and exact per-table upsert and
delete counts. It never prints user emails, API-key material, or row contents.

## Production reconciliation

Do not run this while any application, queue, webhook, scheduled job, or admin
tool can write to either database. A separate production approval is required.

```powershell
pnpm --filter @phaseo/web db:rollback:planetscale:apply -- `
  --confirm-source=phaseo/phaseo/main `
  --confirm-target=xansbgjaduxypzsmjwct `
  --freeze-confirmed
```

Apply also requires:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Missing OAuth-only users are created through the Supabase Auth Admin API with
their existing UUIDs. Password users, unsupported identity providers, schema
drift, or a table without a safe unique key stop the operation. Sessions are
not migrated; users should expect to sign in again.

Business-table changes are reconciled in foreign-key order in a serializable
Supabase transaction. Changed and missing rows are upserted, rows absent from
the frozen PlanetScale source are deleted, and every changed table is verified
before commit. PlanetScale remains untouched as the rollback source and
immediate fallback.
