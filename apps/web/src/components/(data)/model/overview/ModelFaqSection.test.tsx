import { renderToStaticMarkup } from "react-dom/server";

import type { ModelOverviewPage } from "@/lib/fetchers/models/getModel";
import type { ProviderPricing } from "@/lib/fetchers/models/getModelPricing";
import ModelFaqSection from "./ModelFaqSection";

const pricing: ProviderPricing[] = [
	{
		provider: { api_provider_id: "fast-cloud", api_provider_name: "Fast Cloud" },
		provider_models: [],
		pricing_rules: [
			{
				id: "input",
				model_key: "fast-cloud:acme/alpha-1:chat",
				pricing_plan: "standard",
				meter: "input_text_tokens",
				unit: "token",
				unit_size: 1_000_000,
				price_per_unit: 0.5,
				currency: "USD",
				note: null,
				match: [],
				priority: 100,
				effective_from: "2026-07-01",
				effective_to: null,
			},
			{
				id: "output",
				model_key: "fast-cloud:acme/alpha-1:chat",
				pricing_plan: "standard",
				meter: "output_text_tokens",
				unit: "token",
				unit_size: 1_000_000,
				price_per_unit: 1.5,
				currency: "USD",
				note: null,
				match: [],
				priority: 100,
				effective_from: "2026-07-01",
				effective_to: null,
			},
			{
				id: "video-tokens",
				model_key: "fast-cloud:acme/alpha-1:video",
				pricing_plan: "standard",
				meter: "output_video_tokens",
				unit: "token",
				unit_size: 1_000_000,
				price_per_unit: 2,
				currency: "USD",
				note: null,
				match: [],
				priority: 100,
				effective_from: "2026-07-01",
				effective_to: null,
			},
			{
				id: "image",
				model_key: "fast-cloud:acme/alpha-1:image",
				pricing_plan: "standard",
				meter: "output_image",
				unit: "image",
				unit_size: 1,
				price_per_unit: 0.04,
				currency: "USD",
				note: null,
				match: [],
				priority: 100,
				effective_from: "2026-07-01",
				effective_to: null,
			},
			{
				id: "video-seconds",
				model_key: "fast-cloud:acme/alpha-1:video",
				pricing_plan: "standard",
				meter: "output_video_seconds",
				unit: "second",
				unit_size: 60,
				price_per_unit: 6,
				currency: "USD",
				note: null,
				match: [],
				priority: 100,
				effective_from: "2026-07-01",
				effective_to: null,
			},
		],
	},
];

const model: ModelOverviewPage = {
	model_id: "acme/alpha-1",
	name: "Alpha 1",
	organisation_id: "acme",
	status: "Available",
	release_date: "2026-07-01",
	input_types: "text,image",
	output_types: "text",
	organisation: { name: "Acme" },
	model_links: [],
	model_details: [],
};

describe("ModelFaqSection", () => {
	it("renders answers backed by the model-page data", () => {
		const html = renderToStaticMarkup(
			<ModelFaqSection
				model={model}
				benchmarkCount={4}
				activeProviderCount={2}
				isGatewayActive
				pricing={pricing}
			/>,
		);

		expect(html).toContain("What is Alpha 1?");
		expect(html).toContain("How much does Alpha 1 cost?");
		expect(html).toContain("2 active Gateway providers");
		expect(html).toContain("4 benchmark results");
		expect(html).toContain("Input Text Tokens at $0.50 per 1M tokens");
		expect(html).toContain("Output Text Tokens at $1.50 per 1M tokens");
		expect(html).toContain("Output Image at $0.04 per image");
		expect(html).toContain("Output Video Tokens at $2.00 per 1M tokens");
		expect(html).toContain("Output Video Seconds at $0.10 per second");
		expect(html).toContain("Fast Cloud");
		expect(html).toContain("<details");
		expect(html).toContain('href="#pricing"');
		expect(html).toContain('href="/organisations/acme"');
	});

	it("does not link to a pricing section for an inactive model", () => {
		const html = renderToStaticMarkup(
			<ModelFaqSection
				model={model}
				benchmarkCount={0}
				activeProviderCount={0}
				isGatewayActive={false}
				pricing={pricing}
			/>,
		);

		expect(html).not.toContain("How much does Alpha 1 cost?");
		expect(html).not.toContain('href="#pricing"');
		expect(html).not.toContain('href="#benchmarks"');
	});

	it("omits the pricing question when no concrete rates are recorded", () => {
		const html = renderToStaticMarkup(
			<ModelFaqSection
				model={model}
				benchmarkCount={0}
				activeProviderCount={1}
				isGatewayActive
				pricing={[]}
			/>,
		);

		expect(html).not.toContain("How much does Alpha 1 cost?");
	});
});
