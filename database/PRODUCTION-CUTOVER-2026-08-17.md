# PlanetScale production cutover — 2026-08-17

## Release artifacts

- Vercel production: `dpl_8n4qQJt3ioyVdsFEEK2pXtQbozTU`
- Gateway Worker: `4833516b-5c3b-4919-8f64-008ff04bd56a`
- Web API Worker: `f19d84fd-8aef-4416-b4a0-71641dc8ec23`
- PlanetScale Hyperdrive: `31f2d1cba26c46f79705fbb7c22b3a7c`

## Freeze and synchronization

- The gateway, web API, Vercel mutations, Better Auth callbacks, and scheduled
  gateway writers were frozen before final synchronization.
- Frozen source LSN: `18F/F6000000` at `2026-08-17 04:55:36.206311+00`.
- The logical subscription reached and passed that LSN with all 142 relations
  in `ready` state.
- Final identity reconciliation committed 113 users and 115 accounts.
- Two public sequences were advanced by the approved 10,000-value buffer.
- Five rehearsal requests, their key and provider-health projection, and five
  detached IO-log rows were removed by exact identifier before traffic resumed.
- The final assessment reported zero missing or changed source-authoritative
  rows, no sequence regressions, and matching identity counts.

## Production verification

- Better Auth created the migrated user's production session without creating a
  duplicate user, profile, workspace, or membership.
- The migrated account page loaded Daniel Butler's existing profile, Personal
  workspace, country, preferences, and original membership date.
- The production model catalogue loaded 1,299 models (518 active routes).
- Google, GitHub, and GitLab each generated a valid authorization URL.
- Leanstral 1.5 (Free) returned `PLANETSCALE_CUTOVER_OK` through production chat.
- Post-cutover integrity passed with 113 users, 115 accounts, 6 sessions, 113
  profiles, 122 workspaces and memberships, zero orphans or duplicate emails,
  and zero unvalidated constraints.
- Public web, models, chat, sign-up, session, and landing-stats routes returned
  200. The unauthenticated gateway models endpoint correctly returned 401.
- Final isolated suites passed: web 135 files/672 tests, web API 56 files/284
  tests, and gateway 467 files/5,346 tests with 45 intentional live/unsupported
  skips. The gateway warm-cache auth benchmark measured 0.187 ms p95.

## Connection correction

The first social-auth smoke exposed exhausted Micro-tier connection slots. The
Vercel pool was reduced from five to one connection per function instance with
a five-second idle timeout. Hyperdrive's origin connection limit was reduced
from 60 to 5. Social auth and subsequent integrity checks passed after the
change.

## Observation and deferred cleanup

Production now writes only to PlanetScale. Keep Supabase online and application
read-only during the verification window. After the window remains clean, run
`database/replication/05_cleanup.sql`, revoke Supabase credentials, remove the
retained source-sync utilities and `supabase/` history, remove all Supabase
environment values, and rerun the repository-wide relic audit.
