# Video and Batch preview release gates

Release branch: `release/video-batch-preview-20260906`, based on current main. Pending local regional, catalogue, image and Novita adapter changes were excluded.

## Billing audit

Migration `20260906151934_async_settlement_charge_audit.sql` was applied through Supabase CLI after rollback-only production-schema testing, and the same assertions passed after deployment. Capture and settlement append a negative `charge` entry to the existing `credit_ledger` in the wallet transaction. `ref_type=async_job_charge` and a workspace/reservation reference identify the charge; `source_ref_id` points to the job. This follows the active Realtime audit contract. The separate v2 ledger is not dual-written.

Reservation `captured_nanos` tracks how much of the original hold was consumed; `released_nanos` tracks the unused hold. `settled_amount_nanos` records actual usage, including a permitted over-estimate settlement. Existing historical reservations and charges were not backfilled, and no historical wallet debit was repeated.

Tests cover full, partial, above-estimate, zero-cost and released reservations, idempotent replay, insufficient available balance, and rollback of both wallet and reservation when ledger insertion fails. Test transactions roll back and use short lock/statement timeouts.

## Application validation

- 285 focused async API tests passed.
- 98 routing, content and contract tests passed, including no replay/fallback of a dispatched video create.
- 61 TypeScript SDK tests and six web API usage tests passed.
- Gateway, web API and web TypeScript checks passed; web route types generated first.
- OpenAPI clients regenerated, and gateway deployment dry run passed.

## Remaining live gates

Deploy the reviewed worker version and dashboard, restrict Video and Batch to the owner workspace, and run a capped provider canary with a real signed receiver. Verify initial delivery plus three recorded retries, reservation/ledger/request-log totals, idempotent terminal reads, and denied access for a workspace outside the cohort. Customer expansion stays disabled until these checks pass. Receiver event-ID deduplication remains required for at-least-once delivery.
