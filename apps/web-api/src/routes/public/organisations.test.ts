import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/organisations", () => ({
	findOrganisation: vi.fn(async (_env, id: string) => id === "missing" ? null : ({
		labSlug: "openai", name: "OpenAI", countryCode: "US", description: "AI research company",
		metadata: { colour: "#000000" }, updatedAt: "2026-07-14T00:00:00.000Z",
	})),
	listOrganisationModels: vi.fn(async () => [{
		modelSlug: "openai/gpt-test", name: "GPT Test", description: null, status: "active",
		releasedAt: "2026-07-01", announcedAt: "2026-06-30", hidden: false,
		inputModalities: ["text"], outputModalities: ["text"], updatedAt: "2026-07-01T00:00:00Z",
	}]),
	listOrganisationLinks: vi.fn(async () => [{ platform: "website", url: "https://openai.com" }]),
}));

import app from "@/index";
import { findOrganisation, listOrganisationModels } from "@/repositories/organisations";

const env = { ENV: "development" as const };

afterEach(() => vi.clearAllMocks());

describe("public organisation routes", () => {
	it("returns parity-shaped detail, header, and model resources", async () => {
		const [detail, header, models] = await Promise.all([
			app.request("https://phaseo.app/api/_web/organisations/openai?limit=12", {}, env),
			app.request("https://phaseo.app/api/_web/organisations/openai/header", {}, env),
			app.request("https://phaseo.app/api/_web/organisations/openai/models", {}, env),
		]);
		for (const response of [detail, header, models]) {
			expect(response.status).toBe(200);
			expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=86400, stale-while-revalidate=604800");
			expect(response.headers.get("cache-tag")).toContain("web-api-organisations");
		}
		await expect(detail.json()).resolves.toMatchObject({ organisation: {
			organisation_id: "openai", organisation_links: [{ platform: "website" }],
			recent_models: [{ model_id: "openai/gpt-test", organisation_name: "OpenAI", primary_group_key: "2026-07" }],
			models: { active: [{ model_id: "openai/gpt-test" }] },
		} });
		await expect(header.json()).resolves.toEqual({ organisation: { organisation_id: "openai", name: "OpenAI", country_code: "US" } });
		await expect(models.json()).resolves.toMatchObject({ models: [{ model_id: "openai/gpt-test", status: "active" }] });
		expect(vi.mocked(listOrganisationModels)).toHaveBeenCalledWith(expect.anything(), "openai", 12);
	});

	it("does not cache missing organisations", async () => {
		const response = await app.request("https://phaseo.app/api/_web/organisations/missing/header", {}, env);
		expect(response.status).toBe(404);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBeNull();
		expect(findOrganisation).toHaveBeenCalled();
	});

	it("fails closed when the organisation repository is unavailable", async () => {
		vi.mocked(findOrganisation).mockRejectedValueOnce(new Error("database unavailable"));
		const response = await app.request("https://phaseo.app/api/_web/organisations/openai/header", {}, env);
		expect(response.status).toBe(503);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBeNull();
	});
});
