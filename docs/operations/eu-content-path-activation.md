# EU content-path activation

This runbook activates `eu.api.phaseo.app` only after Cloudflare regional execution
and Phaseo's downstream EU policy have both been verified. The application flag is
deliberately disabled in committed configuration so the hostname fails closed.

## Guarantee boundary

The Level 2 guarantee covers TLS termination, HTTP Worker execution, the request
and response content path, and eligible upstream execution/data handling in the EU.
It does not claim EU residency for account, authentication, usage, cost, billing,
support, analytics, or other database metadata.

Cloudflare Regional Services does not regionalize outgoing Worker subrequests, Cron
Triggers, or Queues. Phaseo therefore enforces EU upstream eligibility in application
routing, and no scheduled or queue-triggered work is part of this guarantee.

## Prerequisites

1. Confirm the account has the Enterprise Data Localization Suite and Regional
   Services entitlement.
2. Confirm `eu.api.phaseo.app` is a Workers custom domain for the gateway.
3. Keep `EU_CONTENT_PATH_ENABLED=false` during provisioning and verification.
4. Confirm every production model intended for the regional path has at least one
   catalogue route declaring EU execution and EU data-handling support.

## Provision the regional hostname

Use a narrowly scoped token with DNS write permission:

```bash
curl "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/addressing/regional_hostnames" \
  --request POST \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --json '{
    "hostname": "eu.api.phaseo.app",
    "region_key": "eu"
  }'
```

Cloudflare documents the Worker setup and API in [Workers data localization](https://developers.cloudflare.com/data-localization/how-to/workers/)
and [Regional Hostnames](https://developers.cloudflare.com/data-localization/regional-services/regional-hostnames/).

## Verify before activation

1. Confirm the regional-hostname API returns `region_key: eu`.
2. Repeatedly request the hostname from EU and non-EU clients and inspect `Cf-Ray`
   or `/cdn-cgi/trace`. Every processing colo must be within the configured EU map.
3. Confirm the hostname returns `503 regional_content_path_unavailable` while the
   application flag is false.
4. In a non-production environment, enable the flag and verify:
   - regional response headers are present;
   - `provider.region: "us"` is rejected as a policy conflict;
   - requests cannot select a route without EU execution and data regions;
   - missing EU candidates fail closed;
   - gateway replay, detailed Axiom payloads, and R2 I/O payload capture are absent;
   - compact usage and cost records remain available.

Cloudflare's verification guidance is in [Data Localization configuration guides](https://developers.cloudflare.com/data-localization/how-to/).

## Activate

Only after the evidence above is recorded:

1. Set `EU_CONTENT_PATH_ENABLED=true` for the production Worker.
2. Run the Level 1 and Level 2 smoke suite against representative models.
3. Monitor policy-conflict, empty-candidate, upstream-failure, and regional-hostname
   error rates.
4. Publish the hostname as available only after the first production verification.

## Roll back

Set `EU_CONTENT_PATH_ENABLED=false` first. This immediately makes the regional
hostname fail closed without weakening requests onto the global content path. If
required, then remove the regional hostname and Workers custom-domain records.

Do not redirect the EU hostname to the global hostname during an incident.

Cloudflare documents key exclusions in [Data Localization limitations](https://developers.cloudflare.com/data-localization/limitations/).
