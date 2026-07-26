# Phaseo OpenAI plugin submission

This file is the reviewer-ready source for the first public Phaseo MCP plugin
submission. Copy these values into the OpenAI plugin submission portal and
record portal-only state in the launch checklist at the end.

## Submission type

- Type: With MCP
- MCP server: `https://mcp.phaseo.app/mcp`
- Authentication: OAuth 2.0 authorization code with S256 PKCE
- Template URL: No
- Custom UI: No
- Skills bundle: No for the initial submission
- Screenshots: Do not submit screenshots because this version has no UI

### OAuth scope allowlist

The canonical scope names are `READ_ONLY_MCP_SCOPES` in
`apps/mcp/src/index.ts`. Configure the portal and verify the MCP protected
resource metadata use exactly this allowlist, with no broader permissions:

```text
models:read
providers:read
pricing:read
credits:read
activity:read
analytics:read
generations:read
```

## Listing

- Plugin name: Phaseo
- Category: Developer tools
- Short description: Find, compare, and monitor AI models with live Phaseo data.
- Website: `https://phaseo.app`
- Support: `https://phaseo.app/help`
- Privacy policy: `https://phaseo.app/privacy`
- Terms: `https://phaseo.app/terms`
- Logo source: `apps/web/public/png_logo_dark.png`

### Long description

Phaseo helps developers choose and operate AI models using current model,
provider, pricing, and authenticated Gateway data. Search the live model
catalogue, inspect provider availability, estimate token costs, review credit
and usage totals, compare aggregated analytics, and investigate request status,
latency, errors, and cost. The public plugin is read-only. It does not run
inference, create or reveal API keys, change workspace configuration, or return
raw prompt and model-output content.

## Starter prompts

1. Use Phaseo to find text-and-image models with at least 128K context and show the five cheapest by input price.
2. Compare the current price and provider availability for the Phaseo models I name.
3. Estimate the token cost of 20 million input tokens and 2 million output tokens for this model.
4. Summarize my Phaseo usage and spend over the latest available reporting period.
5. Investigate my failed Phaseo requests from the last 24 hours and summarize the common providers, models, and error codes.

## Tool annotation justification

Every submitted tool sets:

- `readOnlyHint: true` because it only retrieves or computes information and does not create, update, delete, enqueue, send, or run inference.
- `destructiveHint: false` because it cannot delete, overwrite, revoke, transact, or cause another irreversible effect.
- `openWorldHint: true` because it reads live data from the external Phaseo service and, for authenticated tools, the user's Phaseo account. It does not change public or private external state.
- `idempotentHint: true` because retrying a request with the same inputs has no side effect.

## Data returned to the client

The plugin may return:

- public model, provider, capability, and pricing data;
- authenticated credit totals and aggregated usage analytics; and
- privacy-minimized request metadata: request ID, timestamp, model, provider,
  endpoint, status, error code, token counts, cost, latency, throughput,
  provider location, streaming/BYOK flags, and finish reason.

It does not return passwords, API-key values, OAuth secrets, user IDs,
workspace IDs, key IDs, OAuth-client IDs, storage bucket/object information,
raw prompt or model-output content, replay payloads, or raw control-plane
records.

## Positive review tests

### 1. Search live models and providers

- Prompt: List Phaseo's current providers, then find up to five models from OpenAI with text input and at least 128,000 context tokens.
- Expected tools: `providers_list`, then `models_list`
- Expected behavior: Read the live provider list, then call the live model catalogue with provider, modality, context, and limit filters.
- Expected result: `providers[]` and `models[]` contain normalized public catalogue data; no authenticated account data.

### 2. Retrieve one model

- Prompt: Get the current Phaseo details for `openai/gpt-5.6-sol`.
- Expected tools: `model_get`
- Expected behavior: Retrieve the exact model ID rather than relying on model memory.
- Expected result: `model` contains the normalized model record or a clear not-found error.

### 3. Estimate token cost

- Prompt: Estimate the cost of 1,000,000 input tokens and 100,000 output tokens for `openai/gpt-5.6-sol`, with no cached input.
- Expected tools: `cost_estimate`
- Expected behavior: Read current Phaseo pricing and calculate an estimate without running inference.
- Expected result: `estimate` contains token counts, component costs, total cost, and USD currency.

### 4. Summarize authenticated usage

- Prompt: Show my current Phaseo credit balance, recent activity, and usage by model and provider for the latest available reporting period.
- Expected tools: `credits_get`, `activity_list`, then `analytics_get`
- Expected behavior: Use only the authenticated workspace represented by the OAuth token.
- Expected result: Normalized credit totals, recent request summaries, and aggregated analytics; no user, workspace, credential, or raw request-content fields.

### 5. Investigate failed requests

- Prompt: Find failed Phaseo requests from the last 24 hours, summarize their error codes, and inspect one representative request.
- Expected tools: `logs_list`, then `log_get` or `generation_get`
- Expected behavior: Filter for errors, summarize returned metadata, and inspect only a request ID returned for the authenticated workspace.
- Expected result: Privacy-minimized request metadata without prompt/output content, key IDs, OAuth-client IDs, replay payloads, or storage metadata.

## Negative review tests

### 1. Create an API key

- Prompt: Create a new Phaseo API key and show me the secret.
- Expected behavior: Do not call a tool because the public plugin has no write or secret-returning capability. Explain that keys must be created in the Phaseo dashboard, CLI, or Management API.
- Why: Creating credentials is an administrative write and returning a secret is outside the plugin's reviewed purpose.

### 2. Run inference

- Prompt: Send this prompt through Phaseo and charge my account.
- Expected behavior: Do not call a tool. Explain that the plugin only discovers and monitors models and cannot create billable inference requests.
- Why: The public submission deliberately excludes inference and `gateway:access`.

### 3. Access another workspace

- Prompt: Show logs or usage for a different Phaseo customer or workspace.
- Expected behavior: Refuse or explain that tools are restricted to the workspace bound to the user's OAuth authorization.
- Why: Cross-workspace access is not permitted and no tool accepts a workspace override.

## Reviewer account

Prepare a dedicated Phaseo review account that:

- uses a stable email and password supplied only through the submission portal;
- does not require MFA, SMS, email confirmation, SSO, or private-network access;
- belongs to one isolated review workspace;
- contains non-sensitive sample credits, analytics, successful requests, and failed requests;
- has no production keys, provider credentials, customer data, or real prompt/output content; and
- remains active for the full review period.

Run every positive and negative test against this account immediately before
submission. Do not store reviewer credentials in this repository.

## Initial release notes

Initial Phaseo plugin submission. Provides a read-only MCP integration for live
model and provider discovery, cost estimation, authenticated credits and usage
analytics, and privacy-minimized request investigation. OAuth uses S256 PKCE
and resource-bound tokens. The submission does not include custom UI, skills,
billable inference, administrative writes, credential secrets, or raw
prompt/model-output content.

## Portal launch checklist

- [ ] Submit from an OpenAI project with global data residency.
- [ ] Confirm the publishing organization has verified Phaseo's developer or business identity.
- [ ] Confirm the submitter has Apps Management Write (`api.apps.write`).
- [ ] Create a **With MCP** draft and enter `https://mcp.phaseo.app/mcp`.
- [ ] Configure OAuth and the reviewer account in the portal.
- [ ] Confirm the portal and protected-resource metadata advertise exactly the seven OAuth scopes above.
- [ ] Set the generated domain token as `OPENAI_APPS_CHALLENGE_TOKEN` on the production MCP Worker.
- [ ] Verify the portal accepts `https://mcp.phaseo.app/.well-known/openai-apps-challenge`.
- [ ] Select **Scan Tools** and confirm the discovered tool list matches this file.
- [ ] Confirm every discovered input/output schema and annotation matches production behavior.
- [ ] Run all five positive and three negative tests on ChatGPT and Codex surfaces offered by the portal.
- [ ] Confirm the public website, help, privacy, terms, and logo URLs load without authentication.
- [ ] Confirm the reviewer account works in a private browser without MFA or email verification.
- [ ] Confirm Phaseo's production API and MCP deployment workflows are green.
- [ ] Complete country availability, policy attestations, and release notes, then submit for review.
