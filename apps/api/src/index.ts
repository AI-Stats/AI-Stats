// src/app.ts
// Purpose: Worker entrypoint that boots Hono and registers routes.
// Why: Single place to configure the gateway app.
// How: Exposes focused helpers for this module.

import { Hono } from "hono";
import type { Env } from "@/runtime/types";

import { rootRouter } from "@/routes/root";
import { oauthRouter } from "@/routes/oauth";
import { v1Router } from "@/routes/v1";
import { internalRouter } from "@/routes/internal";
import { handleScheduledEvent } from "@/scheduled";
import { isCutoverWriteFreezeEnabled } from "@/runtime/cutover-freeze";
export { RealtimeRelayDurableObject } from "@core/realtime-relay-durable-object";

const app = new Hono<Env>();

app.use("*", async (c, next) => {
	if (!isCutoverWriteFreezeEnabled(c.env) || c.req.method === "GET" || c.req.method === "HEAD") {
		return next();
	}
	return c.json(
		{ error: { code: "cutover_maintenance", message: "Phaseo is briefly read-only during a database migration." } },
		503,
		{ "Cache-Control": "no-store", "Retry-After": "60" },
	);
});

app.route("/", rootRouter);
app.route("/oauth", oauthRouter);
app.route("/v1", v1Router);
app.route("/internal", internalRouter);

export default {
	fetch: app.fetch,
	scheduled: (event: ScheduledController, env: Env["Bindings"]) => {
		if (isCutoverWriteFreezeEnabled(env)) return Promise.resolve();
		return handleScheduledEvent(event, env);
	},
};






