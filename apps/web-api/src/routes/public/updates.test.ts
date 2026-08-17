import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/repositories/updates", () => ({ listModelEventRows: vi.fn(async () => [{
	model_id: "openai/gpt-test", name: "GPT Test", organisation_id: "openai",
	announcement_date: "2020-01-01", release_date: "2020-02-01", deprecation_date: "2099-01-01", retirement_date: null,
	organisation: { organisation_id: "openai", name: "OpenAI" },
}]) }));
import app from "@/index";

const env = {
	ENV: "development" as const,
};

afterEach(() => vi.clearAllMocks());

describe("public update routes", () => {
	it.each([
		"/api/_web/updates/web",
		"/api/_web/updates/youtube",
		"/api/_web/updates/latest",
		"/api/internal/watchers/web",
	])("does not expose retired watcher route %s", async (path) => {
		const response = await app.request(`https://phaseo.app${path}`, {}, env);
		expect(response.status).toBe(404);
	});

	it("returns model cards, split events, and organisation release events", async () => {
		const [cards, split, releases] = await Promise.all([
			app.request("https://phaseo.app/api/_web/updates/models/cards?limit=5", {}, env),
			app.request("https://phaseo.app/api/_web/updates/models?limit=5&upcoming_limit=5", {}, env),
			app.request("https://phaseo.app/api/_web/updates/organisations/openai/releases", {}, env),
		]);

		for (const response of [cards, split, releases]) {
			expect(response.status).toBe(200);
			expect(response.headers.get("cache-tag")).toContain("web-api-model-updates");
		}
		expect(await cards.json()).toMatchObject({
			updates: expect.arrayContaining([expect.objectContaining({
				title: "GPT Test",
				badges: expect.arrayContaining([
					expect.objectContaining({ label: "Release", iconName: "rocket" }),
				]),
				link: expect.objectContaining({ href: "/models/openai/gpt-test", cta: "View" }),
			})]),
		});
		await expect(split.json()).resolves.toMatchObject({
			past: expect.arrayContaining([
				expect.objectContaining({ types: ["Released"] }),
				expect.objectContaining({ types: ["Announced"] }),
			]),
			future: [expect.objectContaining({ types: ["Deprecated"] })],
		});
		await expect(releases.json()).resolves.toMatchObject({
			events: [{
				model: { model_id: "openai/gpt-test" },
				types: ["Released"],
			}],
		});
	});
});
