# Pending Video and Batch release review

Reviewed and fixed 2026-09-06. **All five findings have code fixes and regression coverage. The database migration is applied; worker deployment remains pending.** Novita was excluded as requested. The checkout also contains unrelated regional-routing, catalogue, image and notification work; passing checks do not approve that entire checkout for release.

## Production migration verification

Applied `20260906150000_async_webhook_recovery.sql` using Supabase CLI 2.109.1 to project `xansbgjaduxypzsmjwct` on 2026-09-06, verified by 15:03 UTC. A temporary work directory fetched the remote migration history; `db push --dry-run` selected only this migration before `db push --yes` applied it. SHA-256: `E211704CC392E151DBAD9E0A85DC3B18A59F35E6459D7FD1296EC6A80C3A5C36`.

Rollback-only SQL assertions passed against the production schema for both Video and Batch: lifecycle creation after terminal/billed transitions, event deduplication, live-lease protection, expired-lease recovery, stale-token rejection, successful delivery recording, permanent-failure protection, future-retry protection, progress identity and initially expired operations. The fixtures used unique job IDs in the owner test workspace. Follow-up queries confirmed zero remaining test operations or deliveries. No provider generation, customer HTTP delivery or wallet debit was triggered by these database tests.

Both extended RPC signatures are present, migration history contains the version, and execution is denied to `anon` and `authenticated` while allowed to `service_role`. Security advisors reported no finding against the changed webhook objects; unrelated database warnings remain outside this migration's scope. The 248 focused API tests passed again after migration, including the local HTTP retry receiver. Worker deployment and the production HTTP canary remain outstanding.

## Fix verification

- Post-claim reads explicitly bypass both L1 and in-flight reads. Tests use the real storage/cache module and prove an older in-flight result cannot replace fresh metadata.
- Migration `20260906150000_async_webhook_recovery.sql` queues Batch and Video lifecycle events in the status transaction, including initially terminal jobs. Repeated terminal updates do not duplicate events.
- Scheduled discovery includes claims older than five minutes. First-attempt claims persist event metadata, including progress. The claim RPC protects live leases, future retries and permanent outcomes; result writes reject a stale claim token.
- Native media aliases and priced output aliases are reserved in provider options. Fal applies canonical inputs after extensions.
- Fal routes explicit first/last frames separately from reference images. Mixed frame/reference inputs and last-frame-only requests fail before a hold or provider request.
- 248 focused API tests passed across 20 files, including a real HTTP receiver exercising initial delivery plus three retries for both surfaces. SQL assertions passed in disposable PGlite PostgreSQL using the existing webhook migrations and a minimal async-operation table; this is not a full production-schema or distributed-worker test. API typecheck passed. Targeted ESLint had no errors and two existing file-length warnings.

The database migration is now applied **before** releasing the worker: new code sends extended RPC arguments. Old RPC callers remain compatible through default arguments, but claim-token protection is complete only once all dispatchers use the new code. Keep the migration when rolling back the worker. No worker deployment or paid generation was performed for these fixes.

The retry budget remains four recorded outcomes (initial attempt plus three retries). A crash after receiver acceptance but before recording can cause an additional physical send with the same stable event ID; receivers must deduplicate it. The fixes recover that event rather than silently losing it.

## Original findings (resolved locally)

### P1 — The post-claim webhook read can return stale cached metadata

`apps/api/src/core/async-notifications.ts:1306` calls `getAsyncOperation` after acquiring the delivery claim. That function uses a one-second L1 cache (`apps/api/src/core/async-operations.ts:525`); acquiring a webhook claim does not invalidate it. The initial dispatch read populates that cache. If another worker records a failed attempt and releases its claim before this worker acquires it, the second read can still return the original retry state. The new equality check then passes and sends the old attempt again, bypassing the newly recorded backoff and potentially the retry budget.

Reproduced with the real storage module and a mocked database: read the job, replace the database retry metadata to simulate another worker, acquire the claim, then read again with time held constant. The second read returned the old metadata and only one database SELECT occurred. The existing race test mocks two different `getAsyncOperation` results, so it cannot expose this cache behavior.

Fix: make this read explicitly uncached, including in-flight-read bypass, or atomically return authoritative retry state from the claim RPC. Test through the real storage/cache layer with two competing workers.

### P1 — Batch terminal events are not durably queued with the state transition

`apps/api/src/pipeline/batch-reconciliation.ts:308` starts background webhook dispatch after `finalizeBatchJob` can mark the job billed (`apps/api/src/core/batch-finalization.ts:1223`). A crash between those steps leaves no delivery record or retry metadata. Billing reconciliation excludes billed jobs, and webhook recovery only discovers existing delivery/retry records.

Read-only production inspection confirmed that the sole lifecycle webhook trigger on `gateway_async_operations` is `gateway_async_operation_video_webhook_outbox`, which explicitly excludes Batch. This is an existing architectural gap that the pending release still does not close, rather than a new regression in the small Batch options patch.

Fix: atomically enqueue Batch lifecycle events with their status changes, with stable delivery keys and idempotent inserts, as Video does. Exercise a crash after settlement but before background dispatch and prove the scheduler still sends the event. Include expired and partially successful Batch outcomes.

### P1 — First-attempt worker loss can strand claimed webhook deliveries

`apps/api/src/core/async-operations.ts:308` discovers only `status = pending` outbox rows. A claim changes that row to `claimed`; the claim RPC allows stale leases to be acquired again, but the scheduler never discovers those rows to invoke it. If a worker stops during the first attempt before recording a result, no metadata retry entry exists either. A billed terminal job can therefore retain an undelivered claimed row indefinitely.

Fix: include expired claims in durable discovery/reclaim, with lease ownership checks and durable attempt accounting. Test worker loss before the HTTP send and after receiver acceptance but before recording the result. Receiver event-ID deduplication remains necessary. This is distinct from the documented possibility of duplicate sends: the current gap can prevent any recovery at all.

### P2 — Provider options bypass canonical media protection

`apps/api/src/core/schemas.ts:1796` rejects selected media names but allows native aliases such as `image_url`, `image_urls`, `video_urls` and `audio_urls`. Fal spreads these options after its canonical media mapping (`apps/api/src/executors/fal/video-generate/index.ts:100`), allowing an accepted option to replace the requested image or add references that were absent when choosing the endpoint and calculating reservation inputs.

A direct public-schema probe accepted `provider_options.fal.image_url` and `provider_options.fal.video_urls`. This contradicts the documented canonical-media requirement. Do not treat the current denylist as a complete provider contract.

Fix: allowlist reviewed extensions per provider, or comprehensively reserve the native media aliases and ensure canonical fields take precedence. Add public schema → IR → executor tests proving options cannot replace media or priced dimensions.

### P2 — Fal treats explicit first/last frames as reference-mode images

The new `frame_images` codec preserves both frame roles in `inputReferences`. Fal's `references(ir, "image")` includes all roles, and `resolveEndpoint` treats any two images as multimodal references (`apps/api/src/executors/fal/video-generate/index.ts:67`). For the base Seedance endpoint, first + last frames therefore select `/reference-to-video`, rather than the frame-based image route. Explicit frames can also enter `image_urls` as style/reference inputs.

Fix: distinguish first/last frames from reference-role images in endpoint selection and payload construction. Cover first-only, first+last, reference-only and mixed-role cases through the public schema and IR.

## Validation

- 290 API tests passed across 28 focused files: finalization, submission journals, retry dispatch, reconciliation, pricing fallback, provider adapters and video retrieval/content.
- Six web API usage-log tests passed.
- API TypeScript check passed.
- A temporary cache reproduction passed assertions demonstrating the stale post-claim read; the probe file was removed after review.
- Public-schema probes demonstrated accepted native media aliases.
- Read-only production trigger inspection confirmed the Video-only lifecycle outbox.
- No new paid generations, deployments, wallet mutations or webhook sends were performed during this review.

## Release sequence

1. Apply the reviewed webhook recovery migration, then deploy every dispatcher with the uncached claim validation and claim-token result checks.
2. Include the provider-option protections and Fal frame routing fixes before enabling those options/providers for the cohort.
3. Keep staging scheduled consumers disabled while staging shares production storage. The earlier Slack setup removed the conflicting staging cron; retain that configuration change.
4. Resolve the financial audit/ledger contract and finish the controlled fault cases listed in `async-production-canary-2026-09-06.md`. A successful debit and a visible request log do not settle the outstanding ledger design decision.
5. Isolate the reviewed changes into a release branch/PR, run the release checks, deploy the reviewed gateway/web API/UI together, and repeat a capped canary with every dispatcher on that release. Enable explicit workspace allowlists only after that succeeds.

Slack operations-alert delivery was verified in the preceding setup task. That verification does not certify customer webhook crash recovery or the pending provider changes.
