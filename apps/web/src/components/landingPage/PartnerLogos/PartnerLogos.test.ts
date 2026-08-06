import { getProviderLogos } from "./providerLogos";

describe("getProviderLogos", () => {
	it("only returns known logos that belong to API providers", () => {
		const logos = getProviderLogos([
			"anthropic",
			"openai",
			"vercel",
		]);

		expect(logos).toEqual(expect.arrayContaining(["anthropic", "openai", "vercel"]));
		expect(logos).not.toContain("cursor");
		expect(logos).not.toContain("github");
	});

	it("retains explicit provider exclusions", () => {
		expect(getProviderLogos(["openrouter", "phaseo"])).toEqual([]);
	});
});
