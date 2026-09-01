# Linear observability triage

Phaseo sends actionable Axiom monitor transitions and production PostHog error
groups to one authenticated Gateway endpoint. The endpoint owns Linear issue
creation, deduplication, routing, and recurrence comments so neither source can
create an unbounded stream of duplicate tickets.

## Destination

- Endpoint: `https://api.phaseo.app/internal/observability-incidents`
- Method: `POST`
- Authentication: `Authorization: Bearer <OBSERVABILITY_WEBHOOK_SECRET>`
- Linear team: Phaseo
- Project: SDKs, DevTools and Observability
- Status: Triage
- Assignee: Daniel Butler
- Label: Source: Observability

The same bearer secret must be configured in both source destinations. Store it
only as a Worker secret and a secret destination header.

## Incident envelope

```json
{
  "source": "axiom",
  "action": "open",
  "fingerprint": "axiom:<monitor-id>:<group>",
  "title": "Provider degradation: <provider>",
  "description": "The production provider degradation threshold opened.",
  "severity": "high",
  "environment": "production",
  "source_url": "https://app.axiom.co/ai-stats-pxry/monitors/view/<monitor-id>",
  "route": "/v1/chat/completions",
  "request_ids": ["<request-id>"],
  "occurrences": 3,
  "affected_users": 1
}
```

`source` is `axiom` or `posthog`. `action` is `open`, `repeated`, or
`resolved`. The stable `fingerprint` controls deduplication. For Axiom, include
the monitor ID and notify-by-group values. For PostHog, use the native error
group ID. The source URL must open the exact monitor, query, error group, or
session required to investigate the ticket.

## Axiom custom notifier

Attach one custom webhook notifier to the three actionable monitors. Use the
endpoint and bearer header above. The body should normalize each transition:

```json
{
  "source": "axiom",
  "action": "{{ if eq .Action \"Open\" }}open{{ else }}resolved{{ end }}",
  "fingerprint": "axiom:{{.MonitorID}}:{{.Description}}",
  "title": "{{.Title}}",
  "description": "{{.Body}}",
  "severity": "high",
  "environment": "production",
  "source_url": "https://app.axiom.co/ai-stats-pxry/monitors/view/{{.MonitorID}}",
  "request_ids": [],
  "occurrences": {{.Value}}
}
```

Keep the existing Discord notifier attached. Linear is the durable review queue;
Discord remains the immediate awareness channel.

## PostHog workflow

Create a production workflow for native `$exception` events. Trigger only after
the chosen impact threshold, then send the error group ID, exception title,
pathname, release, occurrence and affected-user counts, error-group URL, and
session-replay URL in the incident envelope. Use the error group ID as the
fingerprint and `posthog` as the source.

Do not use the raw exception event UUID as the fingerprint. That would create a
new Linear issue for every occurrence instead of one issue per PostHog group.

## Rollout checklist

1. Merge and deploy the Gateway endpoint.
2. Set `LINEAR_API_KEY` and `OBSERVABILITY_WEBHOOK_SECRET` as Worker secrets.
3. Send a synthetic PostHog envelope and confirm exactly one Triage issue is
   created with working source and replay links.
4. Send the same fingerprint again and confirm no duplicate issue is created.
5. Send a resolved Axiom envelope and confirm the existing issue receives a
   resolution comment.
6. Enable the PostHog workflow and attach the Axiom custom notifier.
7. Review the Linear Triage queue after 24 hours and tune source thresholds if
   the signal is noisy.
