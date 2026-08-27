import { Hono } from "hono";
import { deliverNotificationTest } from "@/pipeline/notifications/notification-delivery";
import type { Env } from "@/runtime/types";
import { clearRuntime, configureRuntime } from "@/runtime/env";

export const internalNotificationTestRoutes = new Hono<Env>();

function timingSafeEqual(a: string, b: string): boolean {
	const length = Math.max(a.length, b.length);
	let difference = a.length === b.length ? 0 : 1;
	for (let index = 0; index < length; index += 1) {
		difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
	}
	return difference === 0;
}

internalNotificationTestRoutes.post("/", async (c) => {
	const expected = String(c.env.GATEWAY_INTERNAL_TEST_TOKEN ?? "").trim();
	const provided = c.req.header("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
	if (expected.length < 32 || !timingSafeEqual(provided, expected)) return c.json({ error: "unauthorized" }, 401);

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
