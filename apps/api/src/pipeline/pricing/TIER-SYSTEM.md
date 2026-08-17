# Workspace Pricing System

## Overview

The Gateway now runs on a **single-plan pricing model**:

- **Standard plan**: 5% markup on credit purchases
- **Model usage pricing**: billed at catalog rates
- **No active enterprise/basic fee split** in the request path

Some public response fields retain tier-oriented names, but current pricing is flat.

## Current Behavior

### Request path

- The gateway loads workspace billing state through the typed Drizzle repositories in `apps/api/src/repositories`.
- Request authorization, balance checks, and pricing selection run in application services rather than database functions.
- Pricing application uses catalog price cards and does not differentiate usage price by a legacy workspace tier.

### Dashboard/UI

- Dashboard billing summaries are assembled by the web API from Drizzle repository results.
- Any retained `tier` response value is display metadata, not a database authorization or pricing decision.

### Billing and top-ups

- Credit purchases use a flat 5% top-up fee.
- Stripe webhook handling reverse-calculates the fee from the gross payment amount using `5.0`.
- Auto-recharge follows the same flat-fee behavior.

## Source of Truth

The active schema is defined by the Drizzle schema and migrations under `packages/data/db` and `database/`.
Gateway pricing behavior is implemented by the pricing loader and typed repositories under
`apps/api/src/pipeline/pricing` and `apps/api/src/repositories`.

## Compatibility Notes

Some fields still use tier-oriented names because they are part of public response contracts:

- workspace `tier` column

These are presentation metadata, not compatibility database shims or evidence of an active multi-tier pricing model.

## Operational Summary

If you need to reason about pricing today:

1. Credit purchases incur a **5%** top-up fee.
2. Usage consumes credits at catalog pricing.
3. There is a single live top-up fee path in the current standard Gateway billing model: **5%**.
