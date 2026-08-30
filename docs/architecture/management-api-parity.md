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
| Workspaces | CRUD plus separate routing, observability, identity, and budget resources | Contracted | Add new workspace metadata only when it becomes durable dashboard state. |
| Workspace members | List/add/remove, role changes, invitations, and join-request decisions | Contracted | Add cross-workspace directory assignments when a distinct organisation directory is introduced. |
| API keys | CRUD, rotation, cache invalidation, creator, expiry, resettable spend limits, usage, and remaining allowance | Contracted | Add new durable key controls to this surface as the dashboard evolves. |
| Management keys | CRUD with templates, explicit scopes, expiry, pausing, and request/cost limits | Contracted | Add rotation only if management-key rotation becomes a durable product action. |
| Guardrails | CRUD, key/member assignment, budgets, model/provider restrictions, privacy, prompt-injection, and sensitive-information controls | Contracted | Add new durable policy controls to this surface as the dashboard evolves. |
| Provider credentials | Encrypted create/update/delete, workspace/provider filters, model/key restrictions, priority ordering, required-only mode, and fallback behavior | Contracted | Member restrictions follow effective workspace identity and guardrail assignment rather than duplicating credential ACLs. |
| Routing policies | Workspace defaults, provider restrictions, versioned dynamic routes, key assignments, and deployments | Contracted | Add new durable routing controls to the same surface as the dashboard evolves. |
| Presets | CRUD, publisher identity, immutable versions, forks, upstream updates, and archival | Contracted | Add request-derived versions or designated-version changes only when those become durable dashboard actions. |
| Gateway applications | Attributed application listing, metadata/visibility updates, and history-preserving merges | Contracted | Applications are created automatically from gateway attribution; managed platform applications remain immutable. |
| Plugins and tools | Response-healing workspace defaults and lock policy; request-level plugin/tool controls | Contracted where durable | Add assignment APIs when another plugin gains durable dashboard configuration. |
| Data contribution | Consent, classifier CRUD, sampling configuration, and aggregate analytics | Contracted where feature-enabled | Access remains restricted to the current admin preview segment. |
| Observability | Logs, workspace I/O logging policy, and webhook/OpenTelemetry destination CRUD with privacy, sampling, key filters, and event rules | Contracted for executable exporters | Add destination types only when their exporters are executable. |
| Workspace budgets | Daily, weekly, monthly, and lifetime budget CRUD with usage, remaining allowance, and reset timestamps | Contracted | Add new intervals only when supported by enforcement. |
| Organisation administration | Workspace-native membership, invitations, SSO, SCIM endpoint/token administration, departments, member overrides, manual department memberships, and directory group mappings | Contracted for current workspace identity and directory controls | Add cross-workspace organisation controls only when a distinct organisation directory is introduced. |
| Usage, credits, and analytics | Read endpoints with workspace/key/end-user/model/provider/endpoint/outcome filters and CSV analytics export | Contracted for queryable request facts | Add member attribution only when request facts carry a durable workspace-member identity. |
| Activity and audit events | Read endpoints | Contracted | Expand audit producers as each mutation group becomes public. |
| Request logs, feedback, events, and evaluations | Redacted request logs, feedback records and summaries, custom outcome events, and preset test-run lifecycle | Contracted | I/O payload access remains governed by the separate observability retention policy. |
| OAuth clients and webhook endpoints | CRUD plus secret regeneration/rotation | Contracted where feature-enabled | OAuth applications remain beta-gated; async webhook endpoints remain limited to workspaces with async API access. |
| Billing and notifications | Auto top-up policy, low-balance alerts, email preferences, encrypted destination lifecycle/testing, and event routing | Contracted for durable workspace notification administration | Payment-method collection, payment confirmation, purchases, refunds, and other interactive financial execution remain deliberately excluded. |

## Delivered slices

The parity programme shipped focused, end-to-end slices for provider credentials,
workspace budgets and key usage, membership, observability, routing, presets,
analytics export, management keys, guardrails, integrations, data contribution,
API-key lifecycle, identity, enterprise directory, notifications, and gateway
applications. Each slice includes runtime authorization, OpenAPI, generated
SDKs, documentation, tests, audit coverage, and release metadata.

Each slice should update this matrix in the same pull request. CI should prevent
new dashboard mutations from shipping without either a complete public
management capability or an explicit, reviewed exclusion in this document.

## Deliberate exclusions

- Ephemeral browser state and local presentation preferences.
- Interactive authentication ceremonies and payment confirmations.
- Payment-method collection, purchases, refunds, and other interactive financial execution. Durable auto top-up policy remains part of the Management API.
- Personal account profile, password, passkey, MFA, email-change, account-deletion, OAuth-consent, and beta-enrollment flows.
- Partner onboarding, provider claims, catalogue submission, and webhook-secret rotation for provider publishers.
- Internal service controls, cache invalidation, incident operations, and
  provider-health administration.
- Realtime relay session creation, connection, extension, usage, finalization,
  and relay transport routes. These are internal worker-to-worker lifecycle
  operations, not customer management resources.
- Leaked-key report ingestion. This is a rate-limited security-reporting hook
  with uniform accepted responses, not a workspace administration resource.
- Secret retrieval after creation. Credential values are write-only.

Exclusions apply to the interaction, not the durable result. For example, an
interactive connection flow may remain dashboard-only while the resulting
workspace integration still requires read, update, disable, and delete APIs.
