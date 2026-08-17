import { describe, expect, it, vi } from "vitest";

const lab = { labSlug: "openai", name: "OpenAI", countryCode: "US", metadata: { colour: "#000" } };
vi.mock("@/repositories/reference-data", () => ({
	labOrganisation: vi.fn((row) => ({ organisation_id: row.labSlug, name: row.name, country_code: row.countryCode, colour: row.metadata?.colour ?? null })),
	listReferenceLabs: vi.fn(async () => [lab]),
	listReferenceBenchmarks: vi.fn(async () => [{ benchmark_id: "mmlu", benchmark_name: "MMLU", total_models: 42 }]),
	findReferenceProvider: vi.fn(async () => ({ providerSlug: "openai", name: "OpenAI", countryCode: "US" })),
	listReferenceProviders: vi.fn(async () => [{ providerSlug: "openai", name: "OpenAI", countryCode: "US" }]),
	getReferenceBenchmark: vi.fn(async () => ({ id: "mmlu", name: "MMLU", results: [{ id: "visible", model: { organisation: { organisation_id: "openai" } } }] })),
	listReferenceFamilies: vi.fn(async () => [{ family_id: "openai/gpt", family_name: "GPT", organisation_id: "openai", organisation_name: "OpenAI", created_at: "2026-07-01T00:00:00.000Z" }]),
	getReferenceFamily: vi.fn(async () => ({ family_id: "openai/gpt", family_name: "GPT", models: [{ model_id: "openai/gpt-test", organisation: { name: "OpenAI" } }] })),
	listReferencePlans: vi.fn(async () => [{ plan_id: "pro", prices: [{ price: 20 }] }]),
	getReferencePlan: vi.fn(async () => ({ plan_id: "pro", features: [{ feature_name: "Requests" }], models: [{ model_id: "openai/gpt-test" }] })),
}));
vi.mock("@/models/page-catalogue", () => ({ fetchModelsPageCatalogue: vi.fn(async () => ({ models: [{ model_id: "openai/gpt-test", name: "GPT Test", organisation_id: "openai", primary_timestamp: Date.parse("2026-07-01"), gateway_status: "active", gateway_execution_regions: ["us"] }] })) }));

import app from "@/index";
const env = { ENV: "development" as const };

describe("public reference-data routes", () => {
	it("returns stable public datasets with a long-lived edge policy", async () => {
		const responses = await Promise.all(["/organisations", "/benchmarks?sort=coverage", "/api-providers/openai/header", "/sources"].map((path) => app.request(`https://phaseo.app/api/_web${path}`, {}, env)));
		for (const response of responses) { expect(response.status).toBe(200); expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=86400, stale-while-revalidate=604800"); }
		await expect(responses[0].json()).resolves.toMatchObject({ organisations: [{ organisation_id: "openai" }] }); await expect(responses[1].json()).resolves.toMatchObject({ benchmarks: [{ benchmark_id: "mmlu" }] }); await expect(responses[2].json()).resolves.toMatchObject({ provider: { api_provider_id: "openai" } });
	});
	it("preserves family and subscription-plan payloads", async () => { const [families, family, plans, plan] = await Promise.all(["/families", "/families/openai%2Fgpt", "/subscription-plans", "/subscription-plans/pro"].map((path) => app.request(`https://phaseo.app/api/_web${path}`, {}, env))); await expect(families.json()).resolves.toMatchObject({ families: [{ family_id: "openai/gpt" }] }); await expect(family.json()).resolves.toMatchObject({ models: [{ model_id: "openai/gpt-test" }] }); await expect(plans.json()).resolves.toMatchObject({ subscription_plans: [{ plan_id: "pro" }] }); await expect(plan.json()).resolves.toMatchObject({ subscription_plan: { features: [{ feature_name: "Requests" }] } }); });
	it("returns benchmark detail", async () => { const response = await app.request("https://phaseo.app/api/_web/benchmarks/mmlu", {}, env); expect(response.status).toBe(200); await expect(response.json()).resolves.toMatchObject({ benchmark: { id: "mmlu", results: [{ id: "visible" }] } }); });
	it("composes country models from the catalogue", async () => { const response = await app.request("https://phaseo.app/api/_web/countries/US", {}, env); expect(response.status).toBe(200); await expect(response.json()).resolves.toMatchObject({ country: { iso: "US", organisations: [{ organisation_id: "openai", models: [{ model_id: "openai/gpt-test", organisation: { name: "OpenAI", colour: "#000" } }] }] } }); });
});
