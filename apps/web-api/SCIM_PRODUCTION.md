# SCIM production runbook

Phaseo exposes its SCIM 2.0 service provider at `/scim/v2`. Users, Groups, the Enterprise User extension, PATCH, filtering, pagination, and Bulk are supported. Sorting, password changes, and ETags are not advertised.

## Required deployment configuration

- Apply `20260820130000_scim_service_provider_foundation.sql` before deploying the Worker.
- Configure `SCIM_TOKEN_PEPPER` from the secret manager. Use at least 32 random bytes and never expose it to the browser or logs.
- Keep the `SCIM_RATE_LIMITER` Cloudflare binding configured. Production requests fail closed when it is unavailable.
- Route `/scim/v2/*` to `@phaseo/web-api`.
- Verify `SUPABASE_SERVICE_ROLE_KEY` is available only to the Worker.

Rotating `SCIM_TOKEN_PEPPER` invalidates existing tokens. Rotate customer tokens first, then replace the pepper after every old credential has been revoked.

## Release checks

1. Apply the migration to a disposable database and run `supabase db lint`.
2. Run the web-api tests, typecheck, lint, and dry-run build.
3. Confirm unauthenticated requests return a SCIM `401` response.
4. Exercise discovery, User lifecycle, Group membership, deactivation/reactivation, and Bulk fixtures.
5. Verify a deactivated ordinary member immediately loses workspace membership while owners/admins remain available.
6. Run Microsoft SCIM Validator, an Entra provisioning cycle, and an Okta provisioning cycle.
7. Confirm audit events contain no authorization header, bearer token, email body, or complete SCIM document.
8. Alert on elevated `401`, `409`, `429`, and `5xx` outcomes in `scim_audit_events` and on audit insert failures in Worker logs.

## Operational behavior

- Bulk accepts at most 100 operations and 1 MiB.
- `Idempotency-Key` enables replay of a completed Bulk response for 24 hours. Reusing a key with another payload returns `409`.
- SCIM token usage and mutation outcomes are persisted for operator visibility.
- SSO directory linking requires an active SCIM user, an enabled SCIM endpoint, an `sso/saml` AMR method, and an exact match between the AMR entry's `provider` UUID and the workspace SSO provider identifier.
- Deactivation is enforced through workspace membership, so an existing login session no longer grants access to that workspace.
- Owner and administrator memberships are preserved as break-glass access.

## Rollback

Disable the affected row in `scim_endpoints` or revoke its tokens before rolling back application code. Do not drop SCIM tables during an incident; directory and audit state are required for recovery and investigation.
