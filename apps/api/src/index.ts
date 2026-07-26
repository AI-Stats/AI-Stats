// src/app.ts
// Purpose: Worker entrypoint that boots Hono and registers routes.
// Why: Single place to configure the gateway app.
// How: Exposes focused helpers for this module.

import { Hono } from "hono";
import type { Env } from "@/runtime/types";

import { rootRouter } from "@/routes/root";
import { authRouter } from "@/routes/auth";
import { oauthRouter } from "@/routes/oauth";
import { v1Router } from "@/routes/v1";
import { internalRouter } from "@/routes/internal";
import { handleScheduledEvent } from "@/scheduled";
import { resolveIngressResidencyPolicy } from "@pipeline/ingressResidency";
export { RealtimeRelayDurableObject } from "@core/realtime-relay-durable-object";

const app = new Hono<Env>();

app.use("*", async (context, next) => {
	const residencyPolicy = resolveIngressResidencyPolicy(
		context.req.raw,
		context.env,
	);
	if (residencyPolicy && !residencyPolicy.enabled) {
		return context.json(
			{
				status_code: 503,
				error: "regional_content_path_unavailable",
				description:
					"The EU content path is not active. Regional infrastructure must be verified before this hostname can serve requests.",
			},
			503,
			{ "Cache-Control": "no-store" },
		);
	}

	await next();
	if (residencyPolicy) {
		context.header("x-phaseo-residency-level", "content-path");
		context.header("x-phaseo-processing-region", residencyPolicy.region);
	}
});

app.route("/", rootRouter);
app.route("/auth", authRouter);
app.route("/oauth", oauthRouter);
app.route("/v1", v1Router);
app.route("/internal", internalRouter);

export default {
	fetch: app.fetch,
	scheduled: handleScheduledEvent,
};








