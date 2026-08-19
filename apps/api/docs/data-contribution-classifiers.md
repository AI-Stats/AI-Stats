# Data contribution and request classifiers

## Product contract

Data contribution is an explicit workspace-level consent, independent of:

- provider routing policies such as `may_train` or `may_publish_prompts`;
- private gateway I/O logging;
- private request classifiers.

When enabled, Phaseo discounts every eligible, successful, non-BYOK request by 1%. Up to 100% of successful request/response I/O is redacted and retained for 30 days. A separate stable hash gate initially selects 10% for upstream classification, so the retained-data rate and classifier-provider exposure can be tuned independently. Retries make the same decision.

The feature is deployed as a locked admin preview behind the disabled-by-default Statsig gate `gateway_data_contribution`. The gateway is the single rollout authority: discount/capture policy and every management read or mutation fail closed while the gate is disabled. The web API only proxies authenticated requests to that gateway boundary and renders the settings card when the gated overview succeeds. The feature is not registered in the website beta/feature-preview catalogue or advertised in CLI help. Access additionally requires the authenticated Phaseo user to have the platform `admin` role; workspace owner/admin permissions still apply inside the selected workspace.

The discount is applied after provider pricing and recorded on both the pricing total and each pricing line. BYOK service fees and billable failures are not discounted or contributed.

## Data path

1. Gateway context loads the consent version, 100% retention rate, independent classifier submission rate, and 1% discount.
2. The after-stage applies the discount before wallet charging.
3. Successful request auditing runs in `waitUntil`, off the response latency path.
4. Retained request and gateway-response JSON is sanitized, capped at 1 MiB, and written to the dedicated `DATA_CONTRIBUTIONS_BUCKET` R2 binding. Structured credentials are removed and text is scanned for secrets, email addresses, phone numbers, government identifiers, payment cards, IP addresses, names, and physical addresses. Each object records the redaction policy version and count.
5. Postgres stores only queue metadata, the R2 object reference and hash, billing attribution, and token counts.
6. Only rows selected by the independent classifier rate enter the queue. The five-minute scheduled worker claims them with `FOR UPDATE SKIP LOCKED`, reads the object, and runs enabled classifiers with bounded concurrency. Non-selected objects remain retained without being sent upstream.
7. Classifier results are stored privately and exact daily aggregates are refreshed idempotently. The starter taxonomy also feeds a workspace-free model/task rollup.
8. Raw objects expire after 30 days. Disabling contribution expires all remaining workspace objects immediately. The five-minute retention job batch-deletes expired objects; the R2 bucket should also have a 30-day `contributions/` lifecycle rule as a defense-in-depth backstop.

The raw prompt/completion is never placed in Postgres or public analytics. Classification results and daily rollups remain in Postgres after raw I/O expires, allowing durable model/domain analysis without indefinite content retention. Only the workspace can read its private aggregate classifications through authenticated APIs. The platform model/task rollup is readable only after a grain contains at least five workspaces and 100 classified requests, enforced by RLS; lower-volume grains remain service-only.

## Billing eligibility

Upstream non-2xx responses never reach charge finalization. A nominally successful text response that contains no usable output is converted to an unbilled gateway failure, even if the provider reports input usage. Streams that terminate without a terminal success event, or explicitly report an upstream error, are also unbilled. Observed usage is retained in audit metadata with `billing_suppressed=true`, while the charged amount and pricing lines are forced to zero.

Zero output tokens alone are not a universal billing rule: tool calls, images, audio, video, and other non-token output dimensions can be valid generated output. Successful input-only APIs such as embeddings also remain billable. The suppression rule therefore combines endpoint semantics, terminal state, and usable output rather than testing one token field globally.

## Classifier execution

The starter preset uses four macro groups (`code`, `data`, `agent`, and `general`) with more specific task labels. Workspaces can add private classifiers with their own instructions and taxonomy.

The worker uses the existing OpenAI Responses integration with `store: false`, structured output, a 200,000-character classification cap, and Flex service tier by default. Flex is preferable for this queue because classification is delay-tolerant and retryable. It also avoids collecting prompts in memory until a provider batch fills.

Provider Batch APIs are a later optimization, not the capture mechanism. Captured objects must be persisted once immediately after the request; a batch scheduler can subsequently group object references when volume makes the lower batch price worth its longer completion window. The queue and object boundary remain unchanged if that executor is added.

## Consent and audit

`set_data_contribution_consent` changes settings and appends the content-free consent audit event in one database transaction. Consent events are never sampled and contain actor, workspace, action, outcome, policy version, rates, reason, and time—never request content.

Only owners/admins with `settings:write` can change consent or custom classifiers. Contribution tables use RLS, revoke `anon` and `authenticated`, and grant access only to `service_role`.

## Deployment

1. Apply `20260726160000_data_contribution_classifiers.sql` before deploying Workers.
2. Create `phaseo-data-contributions` and `phaseo-data-contributions-preview` R2 buckets (or update Wrangler names for the environment).
3. Deploy the gateway with the `DATA_CONTRIBUTIONS_BUCKET` binding.
4. Confirm `OPENAI_API_KEY` is available to the gateway classifier worker.
5. Confirm the gateway has `STATSIG_SERVER_KEY`; leave `gateway_data_contribution` disabled or absent until an admin preview is intended. No second Statsig secret is required by the web API or website.
6. Configure a 30-day R2 lifecycle rule for the `contributions/` prefix.
7. Enable `DATA_CONTRIBUTION_CLASSIFIER_ENABLED` only after the migration and bucket binding are live.
8. Monitor `data_contribution_capture_failed`, `data_contribution_classifier_scheduled_failed`, and `data_contribution_retention_scheduled_failed` events.

The staging configuration keeps classifier processing disabled by default so consent and storage can be verified before sending contributed data to a classifier provider.
