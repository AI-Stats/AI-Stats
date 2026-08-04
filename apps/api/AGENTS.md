# Gateway API Overrides

These instructions apply to `apps/api` and extend the repository-level `AGENTS.md`.

## Runtime and Architecture

- The gateway runs on Cloudflare Workers with Hono, TypeScript, Wrangler, and Vitest. Do not introduce Node-only APIs unless the target Worker runtime explicitly supports them.
- Preserve the existing boundaries: `protocols` decode and encode public wire formats, `pipeline` owns shared request flow, `core` owns the internal representation and orchestration, `executors` translate IR to providers, `providers` declare provider capabilities and endpoints, and `routes` expose HTTP surfaces.
- Normalize public requests into the internal representation before provider execution. Do not leak provider-specific request shapes into shared pipeline or protocol code.
- Keep provider quirks localized to the provider or executor compatibility layer. A provider workaround must not silently change behavior for every provider.
- Reuse runtime environment types and binding-key registries when adding Worker bindings. Keep secrets out of source, fixtures, logs, and error responses.

## Protocol and Contract Changes

- Treat OpenAI Chat, Responses, Anthropic Messages, embeddings, rerank, media, batches, and streaming behavior as public compatibility contracts.
- Preserve request validation, tool-choice semantics, structured-output behavior, finish reasons, usage accounting, error shapes, and streaming event order unless the change intentionally updates the public contract.
- Add focused decode, encode, executor, and surface tests when changing a protocol field. Cover streaming and non-streaming paths where both exist.
- Capability checks belong before execution. Reject unsupported parameters explicitly rather than dropping or forwarding them unpredictably.
- Keep billing reservations, usage reconciliation, idempotency, and post-response notifications correct across success, provider error, client disconnect, and partial-stream failure paths.
- Public contract changes require synchronized OpenAPI, generated SDK, documentation, and compatibility-test updates under the root workflow.

## Providers and Executors

- Declare capabilities and endpoint support in the established provider registry; do not infer broad support from one successful model or endpoint.
- Keep request mapping, response mapping, retry/fallback policy, and provider authentication independently testable.
- Preserve raw provider diagnostics internally while returning safe normalized errors to clients.
- Never add an implicit provider fallback, model substitution, parameter downgrade, or billing fallback without an explicit product policy and observable telemetry.
- For streaming adapters, test fragmented chunks, multi-event chunks, malformed data, terminal events, usage-only events, and cancellation where relevant.

## Commands and Tests

- Development: `pnpm --filter @phaseo/gateway-api dev`
- Lint/type-check: `pnpm --filter @phaseo/gateway-api lint`
- Unit and contract tests: `pnpm --filter @phaseo/gateway-api test`
- Worker dry-run build: `pnpm --filter @phaseo/gateway-api build`
- AI mock suite: `pnpm --filter @phaseo/gateway-api test:aimock`

- Run the narrowest Vitest files while iterating, then the relevant protocol/provider matrix before handoff.
- Tests named `*.live.spec.ts`, `test:live:*`, recording commands, and provider scripts can contact external services, consume quota, or update fixtures. Do not run them without explicit task need, credentials, and user authorization.
- Prefer AI mock contracts and deterministic fixtures for ordinary development. Record new external contracts only through the established recording workflow and review the resulting provenance and secrets exposure.

## Reliability and Security

- Treat tool arguments, URLs, files, webhook targets, media references, and model-produced structured data as untrusted input.
- Preserve rate limits, SSRF protections, authorization, workspace isolation, audit events, and sensitive-data redaction when changing request flow.
- Avoid unbounded buffering in Worker memory. Stream or cap large text, media, batch, and multipart payloads.
- Include stable request/provider context in structured telemetry, but never log credentials, full sensitive payloads, or private customer content by default.
