import { describe, expect, it } from "vitest";
import { publicProviderDisplayName, publicProviderPayload } from "@/models/provider-identity";

describe("publicProviderDisplayName", () => {
	it("uses Stealth as the display label while preserving ordinary names", () => {
		expect(publicProviderDisplayName("stealth", "stealth")).toBe("Stealth");
		expect(publicProviderDisplayName("stealth", "unexpected internal name")).toBe("Stealth");
		expect(publicProviderDisplayName("provider-a", "Provider A")).toBe("Provider A");
	});

	it("capitalizes stealth provider names throughout public response payloads", () => {
		expect(publicProviderPayload({
			provider: { api_provider_id: "stealth", api_provider_name: "stealth" },
			provider_models: [{ provider_id: "stealth", provider_name: "stealth" }],
		})).toEqual({
			provider: { api_provider_id: "stealth", api_provider_name: "Stealth" },
			provider_models: [{ provider_id: "stealth", provider_name: "Stealth" }],
		});
	});
});
