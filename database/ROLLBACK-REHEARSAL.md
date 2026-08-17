# Pre-write rollback rehearsal

Recorded 2026-08-17 before any production PlanetScale deployment or write.
Production remains on the Supabase-backed releases below, so the safe rollback
path is currently exercised by leaving these releases serving traffic.

## Retained production releases

| Surface | Retained release | Readiness evidence |
| --- | --- | --- |
| Web | Vercel `dpl_EpmDMyc7C4EDJ47ZrxZjoEfUyrAZ` (`phaseo-k1931oonn-phaseo.vercel.app`) | `Ready`; `https://phaseo.app` returned 200 |
| Web API | Cloudflare version `a1e0202f-1615-4487-a092-039af8a83a7b` | `https://phaseo.app/api/_web/landing/stats` returned 200 |
| Gateway API | Cloudflare version `957eadc0-3581-4409-bfa6-69b875aecada` | `https://api.phaseo.app/v1/health` returned 200 |

The Vercel alias and Cloudflare production routes were not changed during this
rehearsal. PlanetScale deployments remain isolated to the Vercel preview and
`phaseo-web-api-staging` Worker.

## Abort rehearsal

1. Keep or restore the global write freeze.
2. Confirm the retained Vercel deployment is `Ready` with
   `vercel inspect https://phaseo.app`.
3. Inspect Cloudflare history with `wrangler deployments list --env=""` in
   `apps/web-api` and `apps/api`; verify the retained version IDs above exist.
4. Before production accepts any PlanetScale write, restore these exact
   releases using the provider rollback controls, then verify the three health
   URLs above before lifting the freeze.
5. If PlanetScale has accepted a production write, do not use this direct
   rollback. Keep traffic frozen and reconcile the complete target write set as
   described in `database/CUTOVER.md`.

This record proves the pre-write rollback artifacts exist and are healthy. The
final cutover still requires a fresh record because deployment IDs and source
LSNs may change before the maintenance window.
