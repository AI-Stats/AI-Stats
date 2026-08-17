# Production database migrations

Drizzle migrations for PlanetScale Postgres are stored in
`packages/data/db/src/generated`. Pull requests validate the migration journal
without production credentials. After a migration reaches `main`, deployment
pauses at the protected `production-database` environment before applying it.

## GitHub setup

1. Create the `production-database` environment with required review and a
   `main` branch restriction.
2. Add the environment secret `PLANETSCALE_MIGRATION_DATABASE_URL` using the
   restricted migration role, never the runtime role.
3. Set `ENABLE_PRODUCTION_DB_MIGRATIONS=true` only after Vercel and Cloudflare
   production deploys are routed exclusively through the gated workflow.

The workflow is fail-closed. Changes to migration SQL, migration metadata, or
the authoritative Drizzle schema require the validation and migration jobs to
succeed before application deployment.

## Workflow

Pull requests and merge-queue runs execute:

```bash
pnpm --filter @phaseo/db db:check
```

Pushes to `main` repeat that check, wait for `production-database` approval,
and then execute:

```bash
pnpm --filter @phaseo/db exec drizzle-kit migrate
```

Never edit a migration already applied to any shared database. Generate a new
migration, review its SQL, test it against the rehearsal database, and use
expand-and-contract changes where compatibility is required.

## Recovery

Migrations are forward-only. If one fails, application deployment remains
blocked. Prefer a new corrective migration; restore a PlanetScale backup only
when a forward repair is unsafe. Follow `database/CUTOVER.md` for the separate
pre-write application rollback boundary during the platform cutover.
