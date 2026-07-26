import { afterEach, describe, expect, it, vi } from "vitest";
import app from "@/index";

const env = {
	ENV: "development" as const,
	SUPABASE_URL: "https://example.supabase.co",
	SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("public pricing routes", () => {
	it("chunks large provider-model filters before querying PostgREST", async () => {
		const routes = Array.from({ length: 205 }, (_, index) => ({
			provider_model_id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
			provider_slug: "openai",
			provider_model_slug: "gpt-test",
			model_slug: "openai/gpt-test",
			routing_enabled: true,
			status: "active",
			effective_from: null,
			effective_to: null,
		}));
		let skuQueryCount = 0;

		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("v2_model_provider_routes")) return new Response(JSON.stringify(routes), { status: 200 });
			if (url.includes("v2_models")) return new Response(JSON.stringify([{
				model_slug: "openai/gpt-test", name: "GPT Test", released_at: null, announced_at: null,
			}]), { status: 200 });
			if (url.includes("v2_pricing_skus")) {
				skuQueryCount += 1;
				return new Response(JSON.stringify([{
					sku_id: "sku-1", provider_model_id: routes[0]?.provider_model_id, operation: "text.generate",
					service_tier_slug: "standard", currency: "USD", status: "active", effective_from: null,
					effective_to: null, metadata: {},
				}]), { status: 200 });
			}
			if (url.includes("v2_pricing_sku_meters")) return new Response(JSON.stringify([{
				sku_id: "sku-1", meter_key: "input_text_tokens", unit: "token", unit_quantity: 1_000_000,
				price_nanos: 5_000_000_000, metadata: {},
			}]), { status: 200 });
			return new Response("[]", { status: 200 });
		}));

		const response = await app.request("https://phaseo.app/api/_web/pricing/models", {}, env);
		const payload = await response.json() as { models: unknown[] };

		expect(response.status).toBe(200);
		expect(skuQueryCount).toBe(3);
		expect(payload.models).toHaveLength(1);
	});
});
