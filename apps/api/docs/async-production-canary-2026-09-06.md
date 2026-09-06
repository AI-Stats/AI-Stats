# Async production canary — 6 September 2026

## Scope

Real paid provider requests ran through the current gateway source on the temporary `phaseo-async-canary-20260906` Worker, using the production database, wallet, request logs and webhook outbox. Production's existing scheduled reconciler also processed these records. Main `api.phaseo.app` traffic remained on version `5ee04932-83a5-4ff6-8714-1c655880cef1`; this was not a general rollout of the dirty checkout.

The owner's Personal workspace funded the tests through a temporary key with a $2 daily, weekly and monthly limit. No Novita requests were submitted or its adapter changed in this test pass. Only successful job IDs were eligible for the canary's targeted retry runner; it respected persisted retry deadlines and did not drain other workspaces' queues.

## Generation and billing results

| Surface | Provider/model | Settings | Result | Settled USD |
| --- | --- | --- | --- | ---: |
| Video | Google AI Studio / Veo 3.1 Lite | 4 seconds, 720p, audio enabled | Completed; MP4 HTTP 200, 287,907 bytes | 0.20 |
| Video | MiniMax / Hailuo 02 | 6 seconds, 768P, text-to-video | Completed; MP4 HTTP 200, 141,446 bytes | 0.28 |
| Batch | OpenAI / GPT-5.4 nano | One Responses row, 24 maximum output tokens | Completed; JSONL HTTP 200, one successful row | 0.000004125 |
| **Total** | | | | **0.480004125** |

These are gateway settlements, not independently reconciled provider invoices. Google pricing is documented in the [Gemini API pricing reference](https://ai.google.dev/gemini-api/docs/pricing). MiniMax's [text-to-video reference](https://platform.minimax.io/docs/api-reference/video-generation-t2v) limits Hailuo 02 text-only requests to 768P/1080P; the cheaper 512P setting requires an image.

Evidence identifiers:

- Google: `G-01M1V7GHYJES5RZ5GHX3RD4J5X`; native `models/veo-3.1-lite-generate-preview/operations/fpdxpslwk73i`.
- MiniMax: `G-01M1V7MC7ANW8WXKZ59C65P1GF`; native `438850232500499`.
- Batch: `batch_01M1V7P1ETWYH8B4VZJWMASD5V`; submission `G-01M1V7P13S17VMJFKKJNMT45E0`; native `batch_6a9d4e9b4b488190970c3b36a9b772ea`.

The wallet moved from 111,967,892,437,510 to 111,967,412,433,385 nanos: exactly 480,004,125 nanos. Existing reserved credit remained 5,310,000,000 nanos. Three further reads of every completed job left both balances unchanged. `/v1/key` reported three requests and $0.480004125 usage across its total/daily/weekly/monthly counters, with $1.519995875 remaining.

Both video reservations are captured at their estimates. Batch reserved 26,950 nanos and atomically settled 4,125 nanos. Three definitive provider rejections released their holds (100,000,000; 200,000,000; 100,000,000 nanos), with zero recorded request cost. No accepted request was resubmitted. Completed video request logs contain 200,000,000 and 280,000,000 nanos; the batch output row contains 4,125 nanos.

## Defects exposed and fixed in source/canary

1. MiniMax V1 received lowercase resolution values. Normalize them to native uppercase values and reject 512P text-only requests before dispatch/reservation.
2. Google REST rejected `numberOfVideos`; the supported single-output request now omits that SDK-only field. The live fixture enables mandatory Veo 3.1 audio.
3. Video content resolution treated AI Studio metadata as a Vertex operation, causing a missing-Vertex-key error. Resolve by stored provider identity; similarly prevent arbitrary provider task IDs being treated as MiniMax, BytePlus, Runway or Atlas tasks.
4. A worker could read retry state before another worker delivered, acquire the released claim and send a stale attempt. Re-read durable state after claiming and stop if it changed. Forced delivery also cannot restart a permanently exhausted event.
5. Repeated terminal reads advanced completion timestamps and generation duration. Video and Batch now preserve the existing valid terminal timestamp; repeated live Batch reads confirm it stays stable.

## Webhook experiment

The HTTPS receiver verifies HMAC signatures and timestamp freshness, returns HTTP 503 for attempts 1–3, then HTTP 200 for attempt 4. The configured delays are 60, 300 and 900 seconds; the older production scheduler's five-minute ticks can deliver later than those minimum delays. Event IDs stay stable and individual attempts are retained in job metadata.

All three completed events succeeded on attempt 4 at 11:56:14 UTC, after real backoff delays. Two concurrent canary runners competed for the final delivery; the database contains exactly one attempt-4 record per event. MiniMax and Batch each have four physical attempts total. Google has five because its older-dispatcher attempt 1 was duplicated. Every successful fourth response was HTTP 200 with HMAC verified. All three durable delivery markers were written and retry queues became empty. Two further concurrent runners returned no work and sent nothing.

The Google completion already contains two physical attempt-1 records from the older dispatcher, before the claim re-read fix. Consequently this mixed-version run cannot establish a strict four-physical-send ceiling. Receiver storage uses event ID plus attempt number and overwrites duplicates; the database attempt array, rather than receiver slot count, is the authoritative duplicate evidence.

## Remaining release gates

- Release the reviewed gateway fixes and corresponding web API/UI changes together. The main deployment still has the old dispatcher; the test-only video gate is not broad provider enablement.
- Verify retry concurrency again with every dispatcher on the fixed version. At-least-once delivery still requires receiver deduplication; a strict physical-send ceiling across worker crashes requires durable pre-send accounting.
- Resolve the billing audit contract: these async debits are visible in wallet/reservation/request records but create no `credit_ledger` or `v2_credit_ledger` row. A prior migration deliberately removed synthetic reservation ledger rows. Decide how actual settled charges should appear in the financial audit, and test that atomically and idempotently. Do not backfill by charging again. Legacy `captured_nanos`/`released_nanos` columns remain zero despite terminal reservation status.
- Deploy the completion-timestamp fix everywhere; mixed old/new workers can still overwrite timing metadata until rollout is complete.
- Exercise worker loss, ambiguous accepted submissions, webhook exhaustion, provider output expiry, insufficient balance/concurrent limits, and paid zero-cost anomaly handling in a controlled fault matrix. Existing deterministic tests cover many of these; this live run does not certify them all.
- Reconcile provider invoice costs, attach actionable alerts/ownership, and test additional models/reference inputs before expanding routing. MiniMax H3 and Atlas/Novita are not certified by this Hailuo/Veo run.

## Local validation

- 437 tests passed across 49 API files, excluding Novita adapter tests.
- API TypeScript check passed.
- A subsequent completion-timestamp fix passed 50 finalization tests and another API TypeScript check.
- Receiver rejected unsigned and invalid-signature requests with HTTP 401; the canary API rejected unauthenticated access with HTTP 404.
- Targeted ESLint: zero errors; two file-length warnings, plus three file-length warnings in the subsequent finalization check.
- Targeted diff whitespace check passed.
- Temporary Worker deployment and real provider/content requests passed.

The prior broader review is [video-batch-production-review-2026-09-06.md](./video-batch-production-review-2026-09-06.md). This report supersedes its statement that no deployed gateway lifecycle test had run; the other untested release gates remain.

## Cleanup

The temporary key `686a193b-7924-4f96-9dc5-0cc46e6b4dfb` was revoked and endpoint `d56705c1-0b89-4213-9b1c-58e8b1573e00` disabled after delivery. The newly created test-only `gateway_video_api` gate was disabled and its test rule removed. Job, attempt, reservation and request-log evidence remains in production.

Wrangler confirmed deletion of `phaseo-async-canary-20260906`. Local temporary credential files were removed. Receiver receipts in the shared cache expire automatically after 24 hours; production bindings and other workers were not deleted.

An unused, gated preview version `2eeb6d71-680d-47ef-8dd7-51ed86240240` was uploaded to `phaseo-gateway` before discovering that Durable Object workers do not support preview URLs. It was never deployed and must not be promoted as a release. The actual test ran on the separately named temporary Worker.
