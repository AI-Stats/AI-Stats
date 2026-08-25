import { Hono } from "hono";
import { deliverNotificationTest } from "@/pipeline/notifications/notification-delivery";
import type { Env } from "@/runtime/types";
import { clearRuntime, configureRuntime } from "@/runtime/env";

export const internalNotificationTestRoutes = new Hono<Env>();

internalNotificationTestRoutes.post("/", async (c) => {
	const expected = String(c.env.GATEWAY_INTERNAL_TEST_TOKEN ?? "").trim();
	const provided = c.req.header("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
	if (!expected || provided !== expected) return c.json({ error: "unauthorized" }, 401);

	const body: { type?: string; target?: string; destinationId?: string; workspaceId?: string } = await c.req.json().catch(() => ({}));
	const workspaceId = String(body.workspaceId ?? "").trim();
	if (!workspaceId) return c.json({ error: "workspace_required" }, 400);

	configureRuntime(c.env);
	try {
		const status = await deliverNotificationTest({
			type: body.type,
			target: body.target,
			destinationId: body.destinationId,
			workspaceId,
		});
		return c.json({ ok: true, status }, 200);
	} catch (error) {
		const message = error instanceof Error ? error.message : "notification_test_failed";
		const status = message === "notification_destination_not_found" ? 404 : 502;
		return c.json({ error: message }, status);
	} finally {
		clearRuntime();
	}
});
