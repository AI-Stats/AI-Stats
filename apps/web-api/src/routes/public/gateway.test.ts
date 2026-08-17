import { afterEach, describe, expect, it, vi } from "vitest";

const gatewayRow = { providerModelId: "pm-1", providerId: "openai", apiModelId: "openai/gpt-test", modelId: "openai/gpt-test", routingEnabled: true, effectiveFrom: null, effectiveTo: null, capabilityId: "responses", capabilityParams: { response_format: true }, providerName: "OpenAI", providerFamilyId: null, providerOfferLabel: null, providerOfferScope: "global", providerPromptTrainingPolicy: "unknown", modelName: "GPT Test", modelStatus: "Available", organisationId: "openai", previousModelId: null, releaseDate: null, announcementDate: null, retirementDate: null, organisationName: "OpenAI" };

vi.mock("@/repositories/gateway", () => ({
	listPublicGatewayRows: vi.fn(async () => [gatewayRow]),
	listEnabledModelAliases: vi.fn(async () => [{ aliasSlug: "gpt-test", modelSlug: "openai/gpt-test" }]),
}));

import app from "@/index";
import { listPublicGatewayRows } from "@/repositories/gateway";

const env = { ENV: "development" as const };
afterEach(() => vi.clearAllMocks());

describe("public gateway catalogue", () => {
	it("composes available provider models and capabilities", async () => {
		const response = await app.request("https://phaseo.app/api/_web/gateway/models", {}, env);
		expect(response.status).toBe(200);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=300, stale-while-revalidate=300");
		await expect(response.json()).resolves.toMatchObject({ models: [{ modelId: "openai/gpt-test", internalModelId: "openai/gpt-test", providerId: "openai", capabilities: ["responses"], capabilityParamsById: { responses: { response_format: true } }, organisationName: "OpenAI", isAvailable: true }] });
	});

	it("keeps deprecated models discoverable until retirement", async () => {
		vi.mocked(listPublicGatewayRows).mockResolvedValueOnce([{ ...gatewayRow, modelStatus: "Deprecated", retirementDate: "2099-01-01T00:00:00Z" }]);
		const response = await app.request("https://phaseo.app/api/_web/gateway/models", {}, env);
		await expect(response.json()).resolves.toMatchObject({ models: [{ modelStatus: "Deprecated", isAvailable: true }] });
	});

	it("resolves enabled aliases against available models", async () => {
		const response = await app.request("https://phaseo.app/api/_web/gateway/model-aliases", {}, env);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ aliases: [{ modelId: "gpt-test", selectorModelId: "gpt-test", providerId: "openai" }] });
	});

	it("fails closed when the catalogue query fails", async () => {
		vi.mocked(listPublicGatewayRows).mockRejectedValueOnce(new Error("database unavailable"));
		const response = await app.request("https://phaseo.app/api/_web/gateway/models", {}, env);
		expect(response.status).toBe(503);
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBeNull();
	});
});
