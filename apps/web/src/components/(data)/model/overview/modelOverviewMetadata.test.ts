import {
	getModelLicenseUrl,
	getModelLineageLinks,
	getGenericModelLinks,
	isLicenseModelLink,
} from "./modelOverviewMetadata";

describe("model overview metadata", () => {
	it("prefers the canonical license URL and recognizes license link aliases", () => {
		expect(isLicenseModelLink({ kind: "licence-text" })).toBe(true);
		expect(
			getModelLicenseUrl({
				license_url: " https://example.com/canonical-license ",
				model_links: [
					{ kind: "license", url: "https://example.com/legacy-license" },
				],
			}),
		).toBe("https://example.com/canonical-license");
	});

	it("falls back to a typed model license link", () => {
		const links = [
			{ kind: "paper", url: "https://example.com/paper" },
			{ platform: "License", url: "https://example.com/license" },
		];
		expect(
			getModelLicenseUrl({
				model_links: links,
			}),
		).toBe("https://example.com/license");
		expect(getGenericModelLinks(links)).toEqual([
			{ kind: "paper", url: "https://example.com/paper" },
		]);
	});

	it("resolves explicit previous and earliest next lineage without inferring names", () => {
		expect(
			getModelLineageLinks(
				[
					{
						date: "2026-09-01",
						eventType: "FutureModel",
						modelId: "openai/gpt-later",
						modelName: "GPT Later",
					},
					{
						date: "2026-08-01",
						eventType: "FutureModel",
						modelId: "openai/gpt-next",
						modelName: "GPT Next",
					},
				],
				"openai/gpt-previous",
			),
		).toEqual({
			previous: {
				modelId: "openai/gpt-previous",
				modelName: "openai/gpt-previous",
			},
			next: { modelId: "openai/gpt-next", modelName: "GPT Next" },
		});
	});
});
