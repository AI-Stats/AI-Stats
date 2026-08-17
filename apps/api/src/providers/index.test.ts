import { beforeEach, describe, expect, it, vi } from "vitest";

const { listActiveProviderSlugsForCapabilityMock } = vi.hoisted(() => ({
	listActiveProviderSlugsForCapabilityMock: vi.fn(),
}));

vi.mock("@/repositories/gateway-context", () => ({
	listActiveProviderSlugsForCapability: (...args: unknown[]) =>
		listActiveProviderSlugsForCapabilityMock(...args),
}));

import { adapterFor, adapterById, providersFor } from "./index";

describe("provider adapter registry", () => {
	beforeEach(() => listActiveProviderSlugsForCapabilityMock.mockReset());

	it("resolves the venice adapter for text endpoints", () => {
		expect(adapterFor("venice", "responses")).toBeTruthy();
		expect(adapterFor("venice", "chat.completions")).toBeTruthy();
		expect(adapterById("venice")).toBeTruthy();
	});

	it("resolves active capability routes through the Drizzle repository", async () => {
		listActiveProviderSlugsForCapabilityMock.mockResolvedValue([
			{ provider_id: "openai" },
			{ provider_id: "missing-provider" },
		]);

		const providers = await providersFor("openai/gpt-5.4", "responses");

		expect(listActiveProviderSlugsForCapabilityMock).toHaveBeenCalledWith({
			modelSlug: "openai/gpt-5.4",
			capabilityId: "responses",
		});
		expect(providers).toHaveLength(1);
		expect(providers[0]).toBe(adapterFor("openai", "responses"));
	});
});
