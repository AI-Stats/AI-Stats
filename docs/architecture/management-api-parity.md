# Management API parity

Phaseo's public Management API must provide programmatic control for every
durable workspace or organisation administration action available in the
dashboard. A dashboard action is not complete until its public contract is
shippable and independently usable without browser automation.

This document tracks product capability, not route count. Several control-plane
routes already exist at runtime but are not complete public surfaces because
they are missing from OpenAPI, generated SDKs, or documentation.

## Definition of complete

A management capability is complete only when it has all of the following:

1. A workspace- or organisation-scoped runtime endpoint with least-privilege
   management capabilities and role checks.
2. Stable request and response schemas in the public OpenAPI document.
3. Generated support in every maintained SDK and an appropriate changeset for
   published packages.
4. Public reference documentation with authentication, pagination, secret
   handling, and error behavior.
5. Runtime authorization tests and OpenAPI route/response contract tests.
6. An audit event for successful security-sensitive mutations.
7. Safe operational behavior: write-only secrets, bounded pagination,
   idempotent deletion where practical, and no credential material in logs or
   responses after creation.

An internal route, dashboard-only handler, placeholder document, or ungenerated
OpenAPI schema does not count as complete.

## Capability matrix

| Capability | Runtime | Public contract | Remaining work |
| --- | --- | --- | --- |
| Workspaces | CRUD | Contracted | Add description, routing defaults, observability settings, and budget resources. |
| Workspace members | List/add/remove, role changes, invitations, and join-request decisions | Contracted | Add cross-workspace directory assignments when a distinct organisation directory is introduced. |
| API keys | CRUD and invalidation | Partially contracted | Contract invalidation/rotation and expose creator, expiry, resettable limits, current usage, and remaining allowance consistently. |
| Management keys | CRUD | Runtime only | Add OpenAPI, SDKs, reference docs, contract tests, and complete audit coverage. |
| Guardrails | CRUD and key/member assignment | Runtime only | Publish the contract and cover default workspace policy, budgets, model/provider restrictions, privacy, and content controls. |
| Provider credentials | Dashboard only | Missing | Add encrypted create/update/delete, workspace/provider filters, model/key/member restrictions, priority ordering, required-only mode, and fallback behavior. |
| Routing policies | Settings and dashboard controls | Partial | Contract workspace defaults, provider ordering, fallback policy, and dynamic route/version deployment. |
| Presets | CRUD and version publish | Runtime only | Publish the existing contract; add request-derived versions, designated-version changes, forks, and upstream/publisher operations where supported by the UI. |
| Plugins and tools | Dashboard/request controls | Missing | Add workspace defaults and assignment APIs for durable plugin configuration. |
| Observability | Logs, workspace I/O logging policy, and webhook/OpenTelemetry destination CRUD with privacy, sampling, key filters, and event rules | Contracted for executable exporters | Add destination types only when their exporters are executable. |
| Workspace budgets | Guardrail/limit primitives | Missing as a resource | Add daily, weekly, monthly, and lifetime budget CRUD with hierarchy validation and usage/remaining values. |
| Organisation administration | Workspace-native membership and invitations | Partial | Contract SSO, SCIM, and directory administration; Phaseo currently treats each organisation workspace as the membership boundary. |
| Usage, credits, and analytics | Read endpoints | Partially contracted | Close OpenAPI/SDK gaps and provide workspace, member, key, model, and provider filters with stable pagination/export behavior. |
| Activity and audit events | Read endpoints | Contracted | Expand audit producers as each mutation group becomes public. |
| OAuth clients and webhook endpoints | CRUD | Runtime only | Publish OpenAPI, SDKs, docs, and contract tests. |
| Billing and notifications | Dashboard controls | Missing or partial | Expose durable administrative settings; keep payment confirmation and other interactive personal flows out of scope. |

## Delivery order

Ship focused, end-to-end slices rather than adding route stubs:

1. Provider credential lifecycle, filters, ordering, and fallback.
2. Workspace budgets and complete key limit/usage semantics.
3. Workspace and organisation membership, invitations, roles, and assignments.
4. Observability destinations, logging policy, and key assignments.
5. Routing policies, dynamic routes, versions, and deployments.
6. Preset versioning, forks, and publishing operations.
7. Remaining runtime-only contract, SDK, documentation, and audit gaps.

Each slice should update this matrix in the same pull request. CI should prevent
new dashboard mutations from shipping without either a complete public
management capability or an explicit, reviewed exclusion in this document.

## Deliberate exclusions

- Ephemeral browser state and local presentation preferences.
- Interactive authentication ceremonies and payment confirmations.
- Internal service controls, cache invalidation, incident operations, and
  provider-health administration.
- Secret retrieval after creation. Credential values are write-only.

Exclusions apply to the interaction, not the durable result. For example, an
interactive connection flow may remain dashboard-only while the resulting
workspace integration still requires read, update, disable, and delete APIs.
