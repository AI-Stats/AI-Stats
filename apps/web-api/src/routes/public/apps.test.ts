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
			if (url.includes("rpc/get_public_app_groups")) {
				return new Response(JSON.stringify([
					{ reference: "active-app", app_id: "active-app", app_name: "Named App", app_category: "chat,productivity", app_is_public: true, app_is_active: true, member_ids: ["active-app"], public_slug: "named-app" },
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
			data: [{ app_id: "active-app", app_name: "Named App", app_slug: "named-app", app_url: null, app_category: "chat,productivity", tokens: 100 }],
		});
	});

	it("keeps caller-attributed app rows isolated from same-host rows", async () => {
		const chatId = "11111111-1111-4111-8111-111111111111";
		const validationId = "22222222-2222-4222-8222-222222222222";
		const requests: string[] = [];
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			requests.push(url);
			if (url.includes("rpc/get_public_app_groups")) {
				return new Response(JSON.stringify([
					{ reference: "phaseo-chat", app_id: chatId, app_name: "Phaseo Chat", app_url: "https://phaseo.app/chat", app_created_at: "2026-01-01T00:00:00Z", app_is_public: true, app_is_active: true, member_ids: [chatId], public_slug: "phaseo-chat" },
					{ reference: "phaseo-validation", app_id: validationId, app_name: "Phaseo Validation", app_url: "https://phaseo.app/validate", app_created_at: "2026-01-02T00:00:00Z", app_is_public: true, app_is_active: true, member_ids: [validationId], public_slug: "phaseo-validation" },
				]), { status: 200 });
			}
			if (url.includes("v2_web_public_usage_daily")) {
				return new Response(JSON.stringify([
					{ requests: 10, success_requests: 9, total_tokens: 1_000 },
				]), { status: 200 });
			}
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request(
			"https://phaseo.app/api/_web/apps/phaseo-chat",
			{},
			env,
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			app: {
				id: chatId,
				slug: "phaseo-chat",
				total_tokens: 1_000,
				total_requests: 9,
			},
		});
		expect(requests.some((url) => url.includes("app_id=in.") && url.includes(chatId) && !url.includes(validationId))).toBe(true);
	});

	it("keeps public slugs unique when unrelated apps share a title", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("rpc/get_public_top_apps")) {
				return new Response(JSON.stringify([
					{ app_id: "first-app", tokens: 200 },
					{ app_id: "second-app", tokens: 100 },
				]), { status: 200 });
			}
			if (url.includes("rpc/get_public_app_groups")) {
				return new Response(JSON.stringify([
					{ reference: "first-app", app_id: "first-app", app_name: "My App", app_url: "https://example.com", app_is_public: true, app_is_active: true, member_ids: ["first-app"], public_slug: "my-app--111111111111" },
					{ reference: "second-app", app_id: "second-app", app_name: "My App", app_url: "https://other.example", app_is_public: true, app_is_active: true, member_ids: ["second-app"], public_slug: "my-app--222222222222" },
				]), { status: 200 });
			}
			return new Response(JSON.stringify([]), { status: 200 });
		}));

		const response = await app.request(
			"https://phaseo.app/api/_web/apps/top?time_range=4w&limit=20",
			{},
			env,
		);

		await expect(response.json()).resolves.toMatchObject({
			data: [
				{ app_id: "first-app", app_slug: "my-app--111111111111" },
				{ app_id: "second-app", app_slug: "my-app--222222222222" },
			],
		});

		const detail = await app.request(
			"https://phaseo.app/api/_web/apps/my-app--111111111111",
			{},
			env,
		);
		expect(detail.status).toBe(200);
		await expect(detail.json()).resolves.toMatchObject({
			app: { id: "first-app", slug: "my-app--111111111111" },
		});
	});
});
