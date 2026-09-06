---
"@phaseo/gateway-api": patch
"@phaseo/sdk": patch
---

Expose authenticated, streamed Anthropic batch result downloads and return the Phaseo download URL in batch responses. Preserve workspace ownership and avoid additional inference charges on downloads. Clarify that webhook retries only follow failed deliveries.
