import { Metadata } from "next";
import { Suspense } from "react";
import { buildMetadata } from "@/lib/seo";
import PricingCalculator from "@/components/(tools)/PricingCalculator";
import { fetchFrontendModels } from "@/lib/fetchers/frontend/fetchPublicCatalog";
import { fetchFrontendPricingModels } from "@/lib/fetchers/frontend/fetchFrontendPricingModels";
import { fetchFrontendGatewayModels } from "@/lib/fetchers/frontend/fetchFrontendGatewayModels";
import type { PricingModel } from "@/lib/fetchers/pricing/getPricingModels";
import { loadPricingCalculatorSearchParams } from "./search-params";
import { sanitizeModelSelections } from "@/components/(tools)/pricing-calculator/calculatorState";

export const metadata: Metadata = buildMetadata({
	title: "AI Pricing Calculator: Compare LLM API Costs",
	description:
		"Estimate token costs and compare LLM API pricing across major providers using daily pricing data.",
	path: "/tools/pricing-calculator",
	keywords: [
		"AI pricing calculator",
		"LLM pricing calculator",
		"token cost calculator",
		"LLM cost comparison",
		"compare AI model prices",
		"AI API pricing",
		"AI model pricing",
	],
});

export default async function PricingCalculatorPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	return (
		<Suspense fallback={<PricingCalculator initialModels={[]} totalModelsCount={0} providersCount={0} />}>
			<PricingCalculatorPageContent searchParams={searchParams} />
		</Suspense>
	);
}

async function PricingCalculatorPageContent({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const [catalogueResult, cachedModelsResult, resolvedSearchParams] = await Promise.all([
		fetchFrontendModels().catch(() => []),
		fetchFrontendGatewayModels().catch(() => []),
		searchParams,
	]);
	const parsedParams =
		loadPricingCalculatorSearchParams(resolvedSearchParams);
	const selectedModelIds = sanitizeModelSelections(parsedParams.selections).map(
		(selection) => selection.modelId,
	);
	if (selectedModelIds.length === 0) {
		selectedModelIds.push(...parsedParams.models);
	}
	if (selectedModelIds.length === 0 && parsedParams.model) {
		selectedModelIds.push(parsedParams.model);
	}
	const pricingModels: PricingModel[] = selectedModelIds.length > 0
		? await fetchFrontendPricingModels(selectedModelIds).catch(() => [])
		: [];
	const catalogModels = catalogueResult.map((model) => ({
		modelId: model.model_id,
		displayName: model.name || model.model_id,
		organisationId: model.organisation_id || model.model_id.split("/")[0] || "unknown",
		organisationName: model.organisation_name || model.organisation_id || "Unknown",
		releaseDate: model.release_date,
		announcementDate: model.announcement_date,
	}));
	const cachedModels = cachedModelsResult;

	const providers = Array.from(new Set(cachedModels.map((model) => model.providerId))).sort();

	return (
		<PricingCalculator
			initialModels={pricingModels}
			catalogModels={catalogModels}
			cachedModels={cachedModels}
			initialModel={parsedParams.model || undefined}
			initialEndpoint={parsedParams.endpoint || undefined}
			initialProvider={parsedParams.provider || undefined}
			initialPlan={parsedParams.plan || undefined}
			initialSelectedModels={parsedParams.models}
			initialSelections={parsedParams.selections}
			initialModelConfigs={parsedParams.configs}
			initialMeterInputs={parsedParams.usage}
			initialRequestMultiplier={parsedParams.requests}
			initialPricingTimeUtc={parsedParams.time || undefined}
			totalModelsCount={catalogModels.length}
			providersCount={providers.length}
		/>
	);
}
