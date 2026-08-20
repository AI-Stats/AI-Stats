# Phaseo SCIM service provider

The SCIM API is mounted at `/scim/v2` and follows RFC 7643 and RFC 7644.

## V1 capability contract

- Users and the Enterprise User extension
- Groups and group membership
- PATCH and PUT
- Filtering and pagination
- Bulk requests with at most 100 operations and a 1 MiB payload
- Workspace-scoped bearer credentials
- Service provider, resource type, and schema discovery
- Sanitized, append-only audit events

Sorting, password changes, and ETags are not part of V1.

## Delivery increments

1. Foundation: persistence, authentication, SCIM HTTP primitives, discovery, and tests.
2. Users: validation, representations, filters, CRUD, PATCH, deactivation, and audit writes.
3. SSO linking: match active directory users and link them to existing login identities and workspace membership.
4. Groups: CRUD, filtered membership PATCH paths, and attribution-only mappings by default.
5. Bulk: validate `BulkRequest`, resolve `bulkId` references, honor `failOnErrors`, execute User and Group operations through the same resource services, and return per-operation status in `BulkResponse`.
6. Administration: endpoint enablement, one-time token display, rotation, revocation, setup instructions, and audit history.
7. Compatibility: RFC fixtures, Microsoft SCIM Validator, Entra, and Okta.

Bulk must not duplicate route behavior. Individual and bulk operations call the same resource services so validation, tenant isolation, authorization, auditing, and error semantics cannot drift.

## Security invariants

- Directory users exist independently of Supabase Auth until an SSO identity is linked.
- Every lookup and mutation is constrained by the authenticated workspace ID.
- Bearer tokens are stored only as peppered HMAC hashes and are never logged.
- Audit events never contain authorization headers or complete request bodies.
- Audit rows are immutable. Identifier columns intentionally have no foreign keys so deleting operational records cannot mutate or remove historical evidence.
- SCIM-managed groups classify users for analytics by default; mapping groups to privileged workspace roles requires explicit configuration.
