import { afterEach, describe, expect, it, vi } from "vitest";
import app from "@/index";

const env = {
	ENV: "development" as const,
	SUPABASE_URL: "https://example.supabase.co",
	SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

afterEach(() => vi.unstubAllGlobals());

describe("public app routes", () => {
	it("returns IDs, detail, usage, and recent requests with volatility-specific caching", async () => {
		const appId = "11111111-1111-4111-8111-111111111111";
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("v2_web_public_usage_daily") && url.includes("canonical_model_id")) {
				return new Response(JSON.stringify([{
					day_bucket: "2026-07-14",
					canonical_model_id: "openai/gpt-test",
					requests: 10,
					success_requests: 9,
					total_tokens: 1_000,
					total_cost_nanos: 500,
				}]), { status: 200 });
			}
			if (url.includes("v2_web_public_usage_daily")) {
				return new Response(JSON.stringify([{
					requests: 10,
					success_requests: 9,
					total_tokens: 1_000,
				}]), { status: 200 });
			}
			if (url.includes("v2_web_gateway_requests")) {
				return new Response(JSON.stringify([{
					created_at: "2026-07-14T12:00:00.000Z",
					usage: { total_tokens: 100 },
					cost_nanos: 50,
					model_id: "openai/gpt-test",
					provider: "openai",
					success: true,
				}]), { status: 200 });
			}
			if (url.includes("api_apps") && url.includes("select=id")) {
				return new Response(JSON.stringify([{ id: appId }]), { status: 200 });
			}
			if (url.includes("rpc/get_public_app_groups")) {
				return new Response(JSON.stringify([{
					reference: "my-app",
					app_id: appId,
					app_name: "My App",
					app_is_active: true,
					app_is_public: true,
					member_ids: [appId],
					public_slug: "my-app",
				}]), { status: 200 });
			}
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const [ids, detail, usage, recent] = await Promise.all([
			app.request("https://phaseo.app/api/_web/apps/ids", {}, env),
			app.request("https://phaseo.app/api/_web/apps/my-app", {}, env),
			app.request("https://phaseo.app/api/_web/apps/my-app/usage?range=4w", {}, env),
			app.request("https://phaseo.app/api/_web/apps/my-app/requests/recent?limit=5", {}, env),
		]);

		expect(ids.headers.get("cloudflare-cdn-cache-control")).toBe(
			"public, max-age=86400, stale-while-revalidate=604800",
		);
		await expect(ids.json()).resolves.toEqual({ ids: [appId] });
		expect(detail.headers.get("cloudflare-cdn-cache-control")).toBe(
			"public, max-age=900, stale-while-revalidate=3600",
		);
		const detailPayload = await detail.json() as any;
		expect(detailPayload).toMatchObject({
			app: { id: appId, slug: "my-app", total_tokens: 1_000, total_requests: 9 },
		});
		expect(detailPayload.app.member_ids).toBeUndefined();
		expect(usage.headers.get("cloudflare-cdn-cache-control")).toBe(
			"public, max-age=900, stale-while-revalidate=900",
		);
		await expect(usage.json()).resolves.toMatchObject({
			usage: [{ model_id: "openai/gpt-test", requests: 10, successful_requests: 9 }],
		});
		expect(recent.headers.get("cloudflare-cdn-cache-control")).toBe(
			"public, max-age=60, stale-while-revalidate=300",
		);
		await expect(recent.json()).resolves.toMatchObject({
			requests: [{ model_id: "openai/gpt-test", provider: "openai" }],
		});
	});

	it("does not cache missing or private app references", async () => {
		vi.stubGlobal("fetch", vi.fn(async () =>
			new Response(JSON.stringify([]), { status: 200 }),
		));
		const response = await app.request(
			"https://phaseo.app/api/_web/apps/private-app",
			{},
			env,
		);
		expect(response.status).toBe(404);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBeNull();
	});

	it("removes inactive placeholder apps from ranking responses", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("rpc/get_public_top_apps")) {
				return new Response(JSON.stringify([
					{ app_id: "active-app", app_name: "Named App", tokens: 100 },
					{ app_id: "placeholder-app", app_name: "App", tokens: 1_000 },
				]), { status: 200 });
			}
			if (url.includes("api_apps")) {
				return new Response(JSON.stringify([
					{ id: "active-app", title: "Named App", category: "chat,productivity", is_public: true, is_active: true },
				]), { status: 200 });
			}
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request(
			"https://phaseo.app/api/_web/apps/top?time_range=4w&limit=20",
			{},
			env,
		);

		await expect(response.json()).resolves.toEqual({
			data: [{ app_id: "active-app", app_name: "Named App", app_url: null, app_category: "chat,productivity", tokens: 100 }],
		});
	});
});
