# Video and batch production review — 2026-09-06

Status: hardening implemented and locally validated; **not a production certification**. No deployment or merge was performed. This checkout contains substantial unrelated work that was preserved.

Follow-up: real Google and MiniMax video requests plus an OpenAI batch subsequently ran through a temporary production-backed gateway. See the [production canary results](./async-production-canary-2026-09-06.md) for costs, webhook evidence, fixes and remaining release gates. Main API traffic was not upgraded.

## Implemented

- Video settlement uses the existing atomic wallet settlement RPC when actual cost differs from the reservation. It retains the hold when settlement fails instead of releasing and separately debiting.
- Video submission does not retry or fall back after a dispatched provider create, transport errors, HTTP 408, or server errors. Validation before dispatch can still select another provider. A dispatched job owns its reservation and is not reused for another provider.
- OpenAI, Alibaba, ByteDance, Fal, Google, Vertex, LTX, MiniMax, Runway, xAI and the compatibility bridge now journal before submission and retain holds for uncertain outcomes, alongside AtlasCloud. Novita was left unchanged in this follow-up. Reconciliation and public reads do not invent task IDs for uncertain submissions.
- Pending journals are retained in the reconciliation filter. Successful persistence marks submissions accepted so the reconciler can progress them normally.
- MiniMax H3/H3 Max validation covers duration, resolution, reference combinations and counts, and output count. V2 polling retains authoritative reference usage. Reference-video holds cover the documented 15-second input ceiling. H3 Max was enabled only after native create/poll/content verification passed.
- Paid Video and Batch jobs that unexpectedly settle at zero retain their holds, record `unexpected_zero_cost`, and emit an operational failure event. Normal zero-cost creates, failed rows and unreserved free operations are not flagged by this check.
- Webhooks use an initial attempt plus three retries (1, 5 and 15 minutes). Failed attempts persist before releasing claims; successful attempt recording and delivery completion share the existing transactional result RPC.
- Existing Requests, Video and Batch log pages remain separate. Job details expose webhook attempt numbers, timestamps, response status, errors and retry time; provider submission state was added alongside billing state.
- First-load Video/Batch queries now enforce the route's job-kind filter before limiting results. Initial rows reuse the refresh serializer, keeping billing and delivery summaries consistent and raw metadata/webhook secrets out of the response.
- Cancelled and expired video jobs can recover missed terminal customer webhook dispatches.
- Google polling-auth failures no longer mark generation failed and release funds.
- Batch pricing does not charge an unrelated conditional batch rate. The OpenAI image batch discount is restricted to OpenAI.
- Batch result compaction preserves video status. Failed/cancelled/expired videos in HTTP-success rows cost zero; nonterminal rows defer settlement.
- Video supports canonical-provider-scoped options and explicit first/last frame images. Protected media, billing, and callback fields cannot be supplied through video options.
- Batch scoped options explicitly allow OpenAI output retention and Mistral metadata, without replacing priced inputs or owned files.
- AtlasCloud Seedance maps resolution, ratio, last-image, audio, and ordered multimodal references. Billing metadata retains reference dimensions and audio configuration.
- LTX public status/content routes use its existing native reconciler.
- Novita Seedance 1.5 has a native unified-video adapter, task polling, guarded reservations, tests and sourced 480p/720p pricing. **Its catalogue route is inactive because live endpoint validation failed.**
- OpenAPI, generated SDKs, handwritten TypeScript/Python request types and the async integration guide were updated.

## Release blockers and remaining work

1. **Novita endpoint access:** authenticated minimal POSTs to the older documented `/v3/async/seedance-v1.5-pro-t2v` and current documented `/v3/video/create` both returned HTTP 404 with `route not found`. Neither returned a task ID. The current unified schema advertises `seedance_v1.5_pro_t2v` and `seedance_v1.5_pro_i2v`; the adapter follows that schema. Resolve provider endpoint/access availability before activating the route. No generation success or charge was confirmed.
2. **Staging rollout:** deploy API, web API and UI together; verify the existing async operation, webhook outbox/result, reconciliation lease and wallet settlement SQL functions are installed. Catalogue enablement is a repository change; the production catalogue has not been imported.
3. **MiniMax coverage:** native minimal H3 and H3 Max generations passed. Real reference-image/video/audio, first/last frames, V1 file retrieval and non-default resolution cases still need a capped staging matrix through the actual gateway. Native smoke tests do not certify gateway wallet debits or provider invoice reconciliation.
4. **Live gateway lifecycle:** the unpublished changes have not been exercised end to end against a deployed gateway, its database settlement, scheduled reconciler and a real customer webhook receiver. Test duplicate/out-of-order delivery, worker restart, unavailable polling credentials, settlement retry and output expiration before rollout.
5. **Provider/model breadth:** this is not an exhaustive renewed certification of every model on every provider. AtlasCloud Seedance 2.5 reference payloads are verified against current documentation and deterministic tests; all its model-specific pricing tiers and live outputs still need validation. Novita coverage is deliberately limited to Seedance 1.5 and remains inactive. Existing experimental/blocked batch providers remain gated.
6. **Uncertain submissions:** records and holds are preserved, but provider-side lookup/manual resolution is still necessary where the upstream cannot recover a job using a client correlation ID. Do not automatically resubmit or release these holds on a timeout.
7. **Operational rollout:** connect the operational events to alerts and an owner. Monitor paid zero-cost completions, growing held-credit totals, completed-but-unbilled jobs, repeated reconciliation errors, aged submissions, and permanently failed webhook deliveries. Validate provider/workspace concurrency and spending limits under load; start with low limits and a small provider/model canary.
8. **Delivery guarantees:** customer webhooks are at-least-once, not exactly-once. Test worker loss after the receiver accepts a request but before recording its response; receivers must deduplicate the stable event ID. The normal scheduler retry budget is four attempts. A strict physical-send ceiling across process crashes would need a durable pre-send counter. Job metadata retains the latest 50 attempt records; extend audit retention if every progress-event attempt must be retained indefinitely.

## Lifecycle and failure behavior

1. Validate and price the canonical request; reserve credit before provider submission.
2. Persist a pending job with reservation and provider identity, then dispatch once.
3. Persist the native task ID and accepted state. If acceptance is uncertain, preserve the journal and hold for investigation.
4. Native provider notifications and scheduled polling converge on the same durable job. Polling providers such as Anthropic still produce customer notifications through the gateway.
5. On terminal provider status, settle actual usage atomically and idempotently. Missing pricing or an anomalous zero cost keeps billing open for reconciliation; a delivery failure never causes a second generation.
6. Durable webhook events are claimed by one worker, signed and delivered. Persist attempts/retry state before releasing a failed claim; atomically record successful delivery and its attempt.
7. Request logs describe the API request; Video/Batch logs describe the longer lifecycle and show provider execution, settlement and delivery separately.

The database/HTTP boundary cannot be atomic. A timeout is therefore an uncertain state, not proof that upstream work failed. This is why automatic generation retries and automatic hold release are unsafe after dispatch.

## Validation

- Focused API suite: 305 tests passed across 32 files.
- API TypeScript check passed.
- Targeted ESLint: zero errors; five file-length warnings.
- Workers dry-run build passed.
- TypeScript SDK: 60 tests passed; TypeScript check passed.
- Python SDK client suite: 53 tests passed.
- All nine SDK generation commands completed. The existing C++ model-ID header was restored from its pre-generation backup because the generation cleanup removed it without recreating it.
- Documentation links and build validation passed; public OpenAPI regenerated.
- Catalogue, pricing and gateway validations passed. Novita was subsequently marked inactive after its live 404 responses.
- Follow-up API lifecycle suite: 431 tests across 49 files passed, excluding Novita adapter tests. A subsequently added batch zero-cost safeguard passed its 30-test finalization suite.
- Real loopback HTTP receiver tests passed for Video and Batch, each covering success on attempt four and exhaustion on attempt four, HMAC verification, stable event IDs, all attempt records, scheduler recovery and no fifth normal attempt. Database calls are mocked in these tests; deployed SQL/worker recovery remains a staging gate.
- Follow-up API, web API and web TypeScript checks passed. Log backend tests: seven passed, including kind filtering and secret redaction on initial load.
- API dry-run and web production builds passed. Targeted API ESLint completed with zero errors and seven existing file-length warnings. Gateway catalogue validation and documentation link checks passed.
- Native MiniMax H3: task `438839114518734`, 4 seconds at 768P, succeeded; reported four output seconds; content HEAD returned 200/video-mp4.
- Native MiniMax H3 Max: task `438838034714941`, 5 seconds at 768P, succeeded; reported five output seconds; content HEAD returned 200/video-mp4. No automatic create retries were used. Provider invoice charges were not independently inspected.

## Reference findings

| Source | Finding |
| --- | --- |
| [OpenAI Batch guide](https://developers.openai.com/api/docs/guides/batch) | Video batch results already contain terminal video objects; image references use JSON objects; video assets expire 24 hours after batch completion. HTTP row success does not alone establish video success. |
| [Mistral Batch API](https://docs.mistral.ai/api/endpoint/batch) | Native `/batch/jobs`, inline requests or input files, `metadata` and `timeout_hours`. Mistral was already implemented in this repository. |
| [MiniMax V2 create](https://platform.minimax.io/docs/api-reference/video-generation-v2-create), [query](https://platform.minimax.io/docs/api-reference/video-generation-v2-query) | H3 and H3 Max use `/v2/video_generation` and `/v2/query/video_generation/{task_id}`. Results contain `task.content.url`; usage reports output and reference dimensions. |
| [Anthropic batches](https://platform.claude.com/docs/en/build-with-claude/batch-processing) | Native batch polling can feed Phaseo's customer webhook dispatcher; native provider webhooks are not required for that integration. |
| [OpenRouter video](https://openrouter.ai/docs/guides/overview/multimodal/video-generation) | Explicit frame images and provider-specific extensions informed the canonical request additions. Phaseo retains managed customer endpoint IDs rather than forwarding arbitrary upstream callback URLs. Full OpenRouter parity has not been certified. |
| [AtlasCloud Seedance 2.5](https://www.atlascloud.ai/models/bytedance/seedance-2.5/reference-to-video) | Up to 30 image, 10 video and 10 audio references; native `resolution`, `ratio`, `generate_audio`; automatic editing duration needs different reservation treatment and remains unsupported. |
| [Novita unified video](https://docs.novita.ai/api-reference/reference-unified-video-generation) | Current public `/v3/video/create` schema uses string duration, `aspect_ratio`, `add_audio`, `image` and `end_image`. Its public configuration is available at `/v3/admin/video-unify-api/config`. Authenticated create still returned 404 during this review. |
| [Novita pricing guide](https://blogs.novita.ai/seedance-1-5-pro-on-novita-ai-complete-developer-guide/) | Published standard rates for Seedance 1.5: 480p silent/audio $0.012/$0.024 per second; 720p $0.026/$0.052. The inactive catalogue entry does not enable unverified 1080p or flex pricing. |
