import { Hono } from "hono";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";

type GatewayResult = { status: number; payload: any };

function gatewayOrigin(env: Env): string {
	return (
		env.GATEWAY_API_ORIGIN ??
		env.PHASEO_GATEWAY_URL ??
		env.AI_STATS_GATEWAY_URL ??
		env.NEXT_PUBLIC_GATEWAY_API_URL ??
		env.NEXT_PUBLIC_API_URL ??
		"https://api.phaseo.app"
	).replace(/\/$/, "");
}

export async function callDataContributionGateway(args: {
	env: Env;
	request: Request;
	method?: string;
	path?: string;
	body?: unknown;
}): Promise<GatewayResult> {
	const authorization = args.request.headers.get("authorization");
	if (!authorization) return { status: 401, payload: { error: "unauthorized" } };
	try {
		const response = await fetch(
			`${gatewayOrigin(args.env)}/v1/data-contribution${args.path ?? ""}`,
			{
				method: args.method ?? "GET",
				headers: {
					authorization,
					...(args.body === undefined ? {} : { "Content-Type": "application/json" }),
				},
				body: args.body === undefined ? undefined : JSON.stringify(args.body),
			},
		);
		return {
			status: response.status,
			payload: await response.json().catch(() => ({ error: "gateway_unavailable" })),
		};
	} catch (error) {
		console.error("data_contribution_gateway_proxy_failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return { status: 503, payload: { error: "gateway_unavailable" } };
	}
}

function proxyError(c: any, result: GatewayResult) {
	return c.json(result.payload, result.status as any, PRIVATE_NO_STORE_HEADERS);
}

export const accountSettingsDataContributionRouter = new Hono<{ Bindings: Env }>();

accountSettingsDataContributionRouter.put("/data-contribution", async (c) => {
	const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
	const result = await callDataContributionGateway({
		env: c.env,
		request: c.req.raw,
		method: "PATCH",
		path: "/consent",
		body: { enabled: body.enabled, reason: body.reason },
	});
	if (result.status < 200 || result.status >= 300) return proxyError(c, result);
	return c.json({ ok: true, enabled: result.payload?.data?.enabled === true }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsDataContributionRouter.post("/data-contribution/classifiers", async (c) => {
	const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
	const result = await callDataContributionGateway({ env: c.env, request: c.req.raw, method: "POST", path: "/classifiers", body });
	if (result.status < 200 || result.status >= 300) return proxyError(c, result);
	return c.json({ classifier: result.payload?.data ?? null }, 201, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsDataContributionRouter.put("/data-contribution/classifiers/:id", async (c) => {
	const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
	const result = await callDataContributionGateway({
		env: c.env,
		request: c.req.raw,
		method: "PATCH",
		path: `/classifiers/${encodeURIComponent(c.req.param("id"))}`,
		body,
	});
	if (result.status < 200 || result.status >= 300) return proxyError(c, result);
	return c.json({ classifier: result.payload?.data ?? null }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsDataContributionRouter.delete("/data-contribution/classifiers/:id", async (c) => {
	const result = await callDataContributionGateway({
		env: c.env,
		request: c.req.raw,
		method: "DELETE",
		path: `/classifiers/${encodeURIComponent(c.req.param("id"))}`,
	});
	if (result.status < 200 || result.status >= 300) return proxyError(c, result);
	return c.json({ ok: true }, 200, PRIVATE_NO_STORE_HEADERS);
});
