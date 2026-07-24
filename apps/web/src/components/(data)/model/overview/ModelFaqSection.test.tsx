import { renderToStaticMarkup } from "react-dom/server";

import type { ModelOverviewPage } from "@/lib/fetchers/models/getModel";
import ModelFaqSection from "./ModelFaqSection";

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
			/>,
		);

		expect(html).toContain("What is Alpha 1?");
		expect(html).toContain("How much does Alpha 1 cost?");
		expect(html).toContain("2 active Gateway providers");
		expect(html).toContain("4 benchmark results");
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
			/>,
		);

		expect(html).not.toContain("How much does Alpha 1 cost?");
		expect(html).not.toContain('href="#pricing"');
		expect(html).not.toContain('href="#benchmarks"');
	});
});
