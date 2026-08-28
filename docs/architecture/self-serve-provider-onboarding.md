# Self-serve provider onboarding

## Summary

Create a self-serve provider portal that lets a provider:

1. Create or find its existing public provider profile.
2. Prove control of the provider's domain or organization.
3. Submit a machine-readable model and endpoint catalog.
4. Run automated schema, connectivity, capability, pricing, and reliability checks.
5. Publish eligible routes into a staged rollout without operator intervention.
6. Maintain models, pricing, regions, policies, and operational status over time.

Provider payments and commercial agreements remain a separate operator-controlled workflow. A provider can onboard and publish without paying a platform fee; settlement readiness can be collected and reviewed later.

## Why this is worth building

The gateway already has the core runtime pieces: provider adapters, model/provider routes, capability metadata, pricing meters, health state, fallbacks, and routing diagnostics. The missing product layer is a trusted intake and ownership workflow that turns provider-submitted information into those records safely.

The primary goal is to make the common path self-serve while keeping three things fail-closed:

- identity: only a verified organization can control a provider profile;
- execution: only a tested and explicitly enabled route can receive production traffic;
- money: no payout or payment obligation is created merely because a catalog was submitted.

## Product boundaries

### Account experience versus authorization

Do not encode product personas into `users.role`. These are independent dimensions:

- `users.role`: Phaseo platform authorization, including internal administration;
- `workspace_members.role`: authorization inside one workspace;
- `workspaces.tier` and `billing_mode`: self-serve or enterprise workspace experience;
- `provider_account_links`: provider ownership and provider UI capability.

Every user receives or joins workspaces rather than being assigned one global customer type. `workspaces.workspace_kind` distinguishes `personal`, `organization`, `enterprise`, and `provider` workspaces. A user may belong to any number of each kind through `workspace_members`.

The provider relationship is `provider -> provider workspace -> workspace members`. One active provider workspace controls one provider profile, and one provider profile has one active controlling workspace. Provider catalog events belong to that workspace, so newly invited teammates see the existing operational history without copying ownership to individual users.

The settings bootstrap derives `self_serve`, `enterprise`, `provider`, and `internal` experiences from the active workspace and memberships. Experiences may overlap: an enterprise workspace member can also manage a provider workspace, while internal access remains protected by the platform role stored in the database.

### Provider profile

A public provider profile describes the organization, brand, website, links, policies, supported API formats, and onboarding status. It is not proof that the provider owns every model or route associated with it.

### Provider claim

A claim grants an account or organization permission to edit an existing provider profile. Claiming must never automatically rewrite historical catalog records, model ownership, pricing provenance, or performance data.

### Provider submission

A submission is a versioned declaration of models, endpoints, capabilities, pricing, capacity, regions, data policy, and operational readiness. Every submission is immutable after review; edits create a new version.

### Routable offer

A routable offer is the result of a successful submission, adapter/configuration resolution, automated verification, and explicit enablement. A provider profile can be public while all of its offers remain non-routable.

### Settlement profile

A settlement profile contains the information needed for a later commercial agreement or payout process. It is intentionally separate from onboarding and does not need to block free catalog publication.

## Recommended provider experience

### 1. Start with a normal account

The provider signs up with the normal account flow, creates or selects an organization, and chooses **Add provider**.

Required initial information:

- provider name and website;
- legal or operating country;
- technical contact;
- catalog feed URL or downloadable manifest;
- supported API format and endpoint family;
- optional commercial contact and settlement preference.

No payment is required to submit or stage a provider.

### 2. Find or create a profile

Search should first match by normalized website domain, then by provider name and known aliases.

- If no likely match exists, create a draft provider profile.
- If one likely match exists, offer **Claim this profile**.
- If several matches exist, require the submitter to choose one or create a new profile with an explanation.
- Never silently create duplicates for an existing verified domain.

### 3. Verify control

Use progressively stronger proof methods:

1. HTTPS file or well-known token on the provider website.
2. DNS TXT record on the provider domain.
3. Email verification to a domain mailbox.
4. Organization control through a connected GitHub or equivalent organization, where available.
5. Manual escalation only for conflicts, public-sector providers, or providers without a controllable domain.

The strongest successful proof should be recorded with its method, subject, timestamp, and expiry/reverification policy. A claim is not complete merely because the account email is verified.

The implemented existing-profile claim uses a one-hour server-issued token at `/.well-known/phaseo-provider-claim.txt` on the provider's previously verified domain. The token is stored only as a SHA-256 hash and is single-use. Existing profiles without a verified domain fail closed to manual review.

### 4. Submit a manifest

The canonical integration should be a provider-hosted HTTPS manifest that Phaseo periodically fetches. A one-time JSON upload can help bootstrap small providers, but the hosted feed should become the source of truth for ongoing changes.

The initial manifest should support:

- provider and model identity;
- provider model slug;
- capability/endpoint IDs;
- input and output modalities;
- typed supported parameters;
- provider-specific passthrough parameters;
- pricing meters and conditional rules;
- capacity and concurrency declarations;
- execution and data regions;
- data retention, training, and compliance declarations;
- readiness, deprecation, and retirement dates;
- API format and adapter requirements.

The contract uses a conventional provider model-feed shape while retaining Phaseo capability IDs and pricing meters. Unknown fields should be preserved as provenance metadata, but unknown executable behavior must not be enabled automatically.

### 5. Automatic validation and staging

After submission, the system should run these checks in order:

1. **Account and claim check** — submitter is authorized for the provider profile.
2. **Manifest check** — HTTPS, size, schema, unique identities, valid dates, currencies, units, and non-negative prices.
3. **Catalog consistency** — model IDs, provider slugs, capabilities, pricing, aliases, and lifecycle fields are internally consistent.
4. **Adapter resolution** — the requested API format maps to a known adapter or an explicitly supported compatibility adapter.
5. **Credential check** — credentials are stored through the existing secret boundary and are never written to catalog or telemetry records.
6. **Connectivity check** — endpoint can authenticate and return the expected response shape.
7. **Capability probes** — run small deterministic tests for non-streaming, streaming, tools, structured output, modalities, and cancellation where declared.
8. **Pricing check** — every routable capability has a complete billable pricing card, with no ambiguous or negative rules.
9. **Safety/privacy check** — verify declared regions, data policies, user-identifier behavior, and logging settings where testable.
10. **Reliability check** — require a successful baseline window before normal traffic; failed or slow routes remain quarantined.

Successful checks should create a staged route and a reviewable report. The default rollout should be small and reversible: for example, internal test traffic first, then a low-percentage public canary, then normal routing after enough successful observations.

## State model

Keep state machines separate so one workflow cannot accidentally authorize another.

### Submission

```text
draft -> submitted -> validating -> needs_action
                         |              |
                         v              v
                      staging <------- resubmitted
                         |
                         v
                      published -> withdrawn
```

Validation failures should retain structured reasons and point to the manifest path or check that failed.

### Claim

```text
requested -> proof_pending -> verified -> approved -> revoked
                   |              |
                   v              v
                expired        rejected
```

There may be multiple claim requests, but only one approved controlling organization should exist at a time. Conflicting verified claims require operator review.

### Route

```text
declared -> probe_pending -> tested -> canary -> enabled
                                  |          |
                                  v          v
                              blocked     deranked -> disabled
```

`tested` is not the same as `enabled`; a provider can pass protocol tests and still be held back by pricing, compliance, rollout, or commercial review.

## Data model direction

Reuse the existing catalog tables for the published projection:

- provider profile: existing provider identity and metadata;
- provider model route: provider model slug, lifecycle, regions, and route status;
- route capability: capability ID, parameter declarations, and capability status;
- pricing SKU and meters: billable operations, service tiers, units, and prices;
- provider health/performance: observed availability, latency, throughput, and breaker state.

Add onboarding-specific records rather than mixing workflow state into catalog rows:

- `provider_submissions`: provider, submitter organization, source URL, status, version, and hashes;
- `provider_submission_checks`: check name, status, evidence, error path, and timestamps;
- `provider_claims`: provider, claimant, proof method, proof subject, status, and review history;
- `provider_route_probes`: route/capability, probe type, request class, result, and response timing;
- `provider_settlement_profiles`: commercial contact, payout readiness, and operator-only notes;
- `provider_onboarding_events`: deduplicated notifications and audit references.

The catalog should only receive a new version after validation. Failed submissions must not partially mutate live routes.

## Notification and commercial handoff

Every meaningful transition should produce an idempotent event:

- provider submitted;
- claim requested, verified, or conflicted;
- manifest changed;
- validation failed or needs action;
- probe passed or failed;
- route staged, canaried, enabled, deranked, or disabled;
- pricing changed materially;
- settlement information became ready for review.

Use the existing notification delivery/outbox pattern where possible. Notifications should contain IDs, status, check summaries, and links—not provider secrets or prompt content. If “IPN” refers to payment notifications, treat those as settlement events and keep them out of the technical route-enablement path.

The first commercial version should be operator-assisted:

- providers can submit settlement details without paying;
- the system marks a provider as `settlement_ready` after required fields are present;
- an operator receives a notification and handles contract, payout method, tax, and reconciliation outside the routing state machine;
- future automated payouts can consume the same audited settlement record.

## Proposed surfaces

These are portal/control-plane surfaces, not inference endpoints:

```text
GET    /provider-portal/providers/search
POST   /provider-portal/providers
POST   /provider-portal/providers/{id}/claims
POST   /provider-portal/claims/{id}/verify
GET    /provider-portal/providers/{id}/submissions
POST   /provider-portal/providers/{id}/submissions
POST   /provider-portal/submissions/{id}/validate
POST   /provider-portal/submissions/{id}/submit
GET    /provider-portal/submissions/{id}/checks
POST   /provider-portal/providers/{id}/settlement-profile
```

The implementation exposes these workflow and contract surfaces:

```text
GET    /api/internal/provider-catalog/reviews
PATCH  /api/internal/provider-catalog/reviews/{run_id}/models/{model_slug}
GET    /api/account/settings/provider-onboarding
POST   /api/account/settings/provider-onboarding/preview
POST   /api/account/settings/provider-onboarding/submit
POST   /api/account/settings/provider-onboarding/webhook/rotate
GET    /api/internal/provider-catalog/schema
GET    /api/internal/provider-catalog/openapi
```

Review decisions are per provider/model claim. Approvals and rejections are append-only events with an actor, timestamp, and reason. Provider-facing responses include the decision and reason; reviewer identity and internal notes remain private.

The public catalog remains read-only and should expose only approved projections:

```text
GET /v1/providers
GET /v1/models
GET /v1/models/{author}/{slug}/endpoints
```

## Provider catalog synchronization

The provider catalog source uses both push and pull delivery:

- `POST /api/internal/provider-catalog/{provider_slug}` accepts a small signed event and queues an immediate refresh.
- A Worker cron checks for due sources every five minutes. Each source defaults to a six-hour recovery interval, sends `If-None-Match` and `If-Modified-Since`, and backs off exponentially after failures.
- Both paths call the same fetch, schema validation, hashing, and normalized snapshot writer.
- A database-backed provider lease serializes webhook, polling, and manual refreshes so stale concurrent runs cannot publish out of order.
- Webhook deliveries include an event ID and are deduplicated. Signatures use `HMAC-SHA256` over `{unix_timestamp}.{raw_body}` with a five-minute replay window.

The normalized provider-owned snapshot is stored separately from public catalog data. Exact canonical IDs and currently effective aliases are automatically approved and projected into immutable `provider_catalog_route_candidates`, including capabilities and pricing. Unknown IDs remain pending. Approving an unknown ID creates its canonical lab/model record and stages the same candidate shape. Catalog synchronization never mutates a live route.

Candidate promotion is a separate service-role transaction. It requires a recorded successful probe, complete pricing, and operator-controlled `adapter_ready` and `credentials_ready` provider metadata. Promotion atomically writes the route, capabilities, versioned pricing SKU/meters, and provider routing state. The internal probe-result endpoint is intended for the gateway's probe runner or an internal operator; provider accounts cannot call it.

The feed is a full authoritative snapshot for observed provider data, but omissions and lifecycle changes do not directly alter live routing. They create reviewable candidates so an accidental or stale feed cannot disable production traffic. Promotion applies an approved lifecycle change to the live route.

Example webhook:

```http
POST /api/internal/provider-catalog/acme
X-Phaseo-Timestamp: 1770000000
X-Phaseo-Signature: v1=<hex hmac>
X-Phaseo-Event-Id: catalog-2026-08-28T14:00:00Z
Content-Type: application/json

{"event_id":"catalog-2026-08-28T14:00:00Z","type":"catalog.updated"}
```

## MVP scope

The smallest useful release should support one provider family and text generation:

1. Create/claim provider profile with DNS or HTTPS proof.
2. Submit a hosted manifest for chat/responses-compatible text models.
3. Validate schema, identity, parameters, pricing, and endpoint connectivity.
4. Run deterministic non-streaming and streaming probes.
5. Create a staged provider-model route without touching live routing.
6. Send operator notifications for failures, conflicts, and successful staging.
7. Require operator approval to enable the first public route.
8. Add a settlement-ready record, but no automatic payout.

Do not begin with arbitrary custom code, unrestricted webhook callbacks, automated payouts, or full multimodal parity. Those add risk before the core onboarding loop is proven.

## Acceptance criteria

- A provider can complete the happy path without contacting an operator.
- A submitter cannot claim an existing provider without domain/organization proof.
- A malformed or unreachable manifest produces actionable check results and no live catalog mutation.
- A passing manifest creates versioned catalog records and a staged route.
- A provider can publish a profile without being financially onboarded.
- Route enablement is independently reversible.
- Every catalog change has source URL, submission version, check evidence, and actor history.
- Secrets, prompts, completions, and raw provider credentials never appear in onboarding notifications or public catalog responses.
- Conflicting claims and commercial readiness generate operator notifications.

## Suggested implementation order

1. Add the manifest schema and validation library.
2. Add submission/check/claim persistence and audit events.
3. Build provider search, claim proof, and submission portal actions.
4. Add the hosted-feed fetcher with SSRF, size, timeout, and signature controls.
5. Map validated manifests into the existing catalog projection.
6. Add deterministic provider probes and staged route creation.
7. Wire notifications and settlement-ready handoff.
8. Add public self-serve documentation and a provider test harness.

The central invariant is: **a provider may self-publish metadata, but only a validated, observed, and explicitly enabled route may receive production traffic.**
