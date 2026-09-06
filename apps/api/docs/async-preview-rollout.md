# Video and Batch private beta

## Access and release

Database prerequisite `20260906150000_async_webhook_recovery.sql` was applied with the Supabase CLI on 2026-09-06 and passed production rollback-only recovery assertions. Worker deployment and the production HTTP canary are still required; see `video-batch-pending-review-2026-09-06.md` for evidence.

Both entries appear under Settings → Feature Preview with a Beta badge. They are managed previews, not self-service entitlement toggles. The existing server gates are `gateway_video_api` and `gateway_batch_api`; each fails closed on a failed gate evaluation. The dashboard uses the same gate names. API authorization remains authoritative, particularly for API-key-specific rules.

Use explicit **workspace** allowlists (`custom.workspace_id`) in each production gate, not a percentage rollout or a public rule. Workspace rules keep browser sessions and API keys aligned even when their user identities differ. Start with the owner test workspace, then add individually selected customer workspaces. Keep the remaining population at false. No customer cohort was enabled by this preparation change.

Before admitting a cohort:

1. Apply `20260906150000_async_webhook_recovery.sql` before releasing the reviewed gateway, web API and web changes together. The worker requires its extended claim/result RPC signatures. Keep the migration on a worker rollback. Do not promote the gated test wrapper version from the canary run. Verify all scheduled dispatchers use fresh post-claim reads and claim-token result checks.
2. Verify production database settlement/outbox functions and Axiom ingest credentials. Run the existing inexpensive Google/MiniMax/Batch canary with a capped key and a real signed receiver.
3. Verify the Slack billing-alert connection below and assign an owner to review unresolved incidents.
4. Add the first workspace to each gate separately. Verify its API key can create jobs and another workspace cannot. Test its Feature Preview and separate Video/Batch log pages.
5. Keep provider routing conservative: the live test covered Veo 3.1 Lite on AI Studio, Hailuo 02 on MiniMax, and one OpenAI nano Batch row. Novita remains excluded; broader model coverage needs its own checks.

Use low key spending/request limits and monitor open holds, completed-but-unbilled jobs, uncertain submissions, exhausted webhooks and repeated reconciliation failures. Do not resolve an uncertain upstream submission by resubmitting it or releasing its hold without provider evidence.

Roll back new admission first. Existing route gates can also affect job retrieval: preserve access for workspaces with outstanding jobs until they can recover outputs and settlement, and keep reconciliation running. Do not disable workers with unsettled jobs. Strict physical-send limits across crashes and provider invoice reconciliation remain separate release gates.

## Where zero-cost anomalies are visible

The safeguard applies to a successful paid job whose computed cost unexpectedly becomes zero. Legitimately free jobs and definitive failed generations are not automatically anomalies. It retains the reservation, leaves billing unfinished, and records `billingReason: unexpected_zero_cost` in `gateway_async_operations.meta`.

In the dashboard, open Settings → Usage → Video or Batch, expand the job, and inspect **Billing reason**. This is durable evidence even if telemetry delivery fails.

The existing Usage → Lifecycle Alerts page covers model deprecations and retirements; it is not a billing-anomaly inbox. The separate job-log changes must be deployed before relying on their new billing detail fields in the live dashboard.

The gateway also emits an Axiom event:

```text
event_type = gateway.operational_failure
error_code = unexpected_zero_cost
operational_workflow = video_finalization | batch_finalization
operational_resource_id = the job ID
workspace_id = the owning workspace
```

In Axiom Explorer, select the gateway wide-event dataset configured by `AXIOM_WIDE_DATASET` (or `AXIOM_DATASET`). Filter `event_type` to `gateway.operational_failure` and `error_code` to `unexpected_zero_cost`; show the resource ID, workspace and workflow. This is optional investigation telemetry; Slack alert delivery does not consume Axiom monitors.

### Slack operations inbox

Production routes persisted `unexpected_zero_cost` flags to the private [phaseo-billing-alerts Slack channel](https://slack.com/app_redirect?channel=C0BVD4FL5GR). The channel-scoped Phaseo Billing Alerts app uses an encrypted destination named **Billing alerts**, visible in Settings → Notifications in the owner's Personal workspace. No webhook secret is stored in this repository.

Migration `20260906135947_gateway_billing_anomaly_alerts.sql` captures each operation's anomaly once in `gateway_billing_alerts`, atomically with its job update. `gateway_billing_alert_config` selects the operations destination; customer notification preferences are not involved. Missing destinations leave durable, unqueued alerts for operator recovery. Billing the job marks the alert resolved. The gateway changes that persist the anomaly flag still need their reviewed release; this database connection alone does not deploy those safeguards or enable the beta.

The existing production notification worker delivers queued alerts on its five-minute schedule. Delivery status, attempt count, HTTP response and last error are recorded in `notification_delivery_attempts`; failures use the existing backoff with five total attempts under normal execution. These operations notifications are separate from customer job webhooks and their initial attempt plus three retries. Delivery remains at least once across crashes.

`email_outbox` is the shared event store: these Slack-only events close its legacy email leg immediately. Use the delivery-attempt status below, not `email_outbox.sent_at`, as evidence of Slack delivery.

```sql
select a.id, a.resource_id, a.workspace_id, a.kind, a.provider,
       a.status, a.created_at, d.status as delivery_status,
       d.attempts, d.response_status, d.last_error, d.sent_at
from public.gateway_billing_alerts a
left join public.notification_delivery_attempts d on d.event_id = a.event_id
where a.status = 'open'
order by a.created_at desc;
```

After restoring a missing destination, a service-role operator can call `queue_gateway_billing_alert(alert_id)` for an open alert whose `event_id` is null. Already queued alerts are not duplicated. Exhausted delivery attempts require operator investigation before deliberate redelivery.

The transactional SQL regression in `supabase/tests/gateway_billing_anomaly_alerts.sql` passed against production with all fixtures rolled back: capture, deduplication, legitimate-free exclusion, missing-destination recovery, settlement resolution and restricted access. Synthetic delivery tests must be clearly labelled and must not alter wallets.

**Scheduler isolation issue found during setup:** `phaseo-gateway-staging` had an active minute cron against the production Supabase database, without the dedicated webhook encryption key. It could claim production notification work and fail decryption. Its live cron was removed, and `apps/api/wrangler.staging.toml` now keeps schedules empty until staging has isolated storage and credentials. The main production scheduler remains enabled; regional/performance gateway schedules were already empty. Keep this separation in future deployments.

During diagnosis, the operations destination was re-encrypted through the gateway's authenticated destination API without rotating shared keys. The temporary setup credential was revoked and its temporary destination retired. The initial failures do not establish a dashboard/production key mismatch because a competing staging consumer was present. A fresh dashboard-created destination should still be checked after scheduler isolation before general notification rollout.

**Live receipt, 2026-09-06:** synthetic alert `3230f0d5-c947-43d0-a238-7d43c75c78aa`, event `a7919f69-f31e-4946-877f-9fed60bd6917`, reached Slack at **14:20:14 UTC** through the production scheduled worker. Delivery status is `sent`, HTTP **200**, attempt count **3**, following two decryption failures observed before staging isolation. The clearly labelled message was independently read from Slack. The synthetic incident is resolved, another queue call returned false, and no generation or wallet charge occurred. The attempt row stores a cumulative count and latest error/status, not immutable per-attempt history; success clears the latest error. Main gateway deployment remained `5ee04932-83a5-4ff6-8714-1c655880cef1` throughout setup.

For a database fallback, an operator can inspect unresolved anomalies without customer prompt data:

```sql
select internal_id, workspace_id, kind, provider, status, updated_at
from public.gateway_async_operations
where meta->>'billingReason' = 'unexpected_zero_cost'
  and billed_at is null
order by updated_at desc
limit 100;
```

See [live canary results](./async-production-canary-2026-09-06.md) for verified billing and retry evidence and remaining fault tests.
