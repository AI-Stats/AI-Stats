import {
	fetchFrontendModelBenchmarkHighlights,
	fetchFrontendModelAvailability,
	fetchFrontendModelHeader,
	fetchFrontendModelGatewayMetadata,
	fetchFrontendModelOverview,
	fetchFrontendModelPerformance,
	fetchFrontendModelPricing,
	fetchFrontendModelSubscriptionPlans,
	fetchFrontendModelTimeline,
} from "@/lib/fetchers/frontend/fetchPublicCatalog";
import type { ModelOverviewPage } from "@/lib/fetchers/models/getModel";
import ModelOverviewSections, {
	ModelCreatorModelsSection,
	ModelCreatorModelsSkeleton,
} from "@/components/(data)/model/overview/ModelOverviewSections";
import ModelDetailShell from "@/components/(data)/model/ModelDetailShell";
import ModelPageToc, {
	type ModelPageTocItem,
} from "@/components/(data)/model/ModelPageToc";
import type { Metadata } from "next";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import {
	getModelPath,
	getModelMetadataIdentity,
	resolveModelRouteIds,
	type ModelRouteParams,
} from "@/components/(data)/model/model-route-helpers";
import {
	buildModelOverviewMetadataDescription,
	buildModelOverviewMetadataTitle,
} from "@/lib/models/modelDescription";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { isFreeRouterModelId } from "@/lib/models/freeRouter";
import FreeRouterOverview from "@/components/(data)/model/free-router/FreeRouterOverview";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import ModelFaqSection from "@/components/(data)/model/overview/ModelFaqSection";
import {
	getModelLineageLinks,
	resolveModelLineageNames,
} from "@/components/(data)/model/overview/modelOverviewMetadata";

async function ModelCreatorModelsSectionContent({
	modelId,
	includeHidden,
	modelPromise,
}: {
	modelId: string;
	includeHidden: boolean;
	modelPromise: Promise<ModelOverviewPage | null>;
}) {
	const model = await modelPromise;
	if (!model) return null;

	return (
		<div className="mt-10">
			<ModelCreatorModelsSection
				modelId={modelId}
				includeHidden={includeHidden}
				model={model}
			/>
		</div>
	);
}

async function ModelFaqSectionContent({
	model,
	benchmarkCount,
	activeProviderCount,
	isGatewayActive,
	pricingPromise,
	gatewayMetadataPromise,
}: {
	model: ModelOverviewPage;
	benchmarkCount: number;
	activeProviderCount: number;
	isGatewayActive: boolean;
	pricingPromise: ReturnType<typeof fetchFrontendModelPricing>;
	gatewayMetadataPromise: Promise<
		Awaited<ReturnType<typeof fetchFrontendModelGatewayMetadata>> | null
	>;
}) {
	const [pricing, timeline, gatewayMetadata] = await Promise.all([
		pricingPromise,
		fetchFrontendModelTimeline(model.model_id).catch(() => null),
		gatewayMetadataPromise.catch(() => null),
	]);
	const relatedModels = await resolveModelLineageNames(
		getModelLineageLinks(timeline?.events, model.previous_model_id),
		async (relatedModelId) =>
			(
				await fetchFrontendModelHeader(relatedModelId).catch(() => null)
			)?.name,
	);
	return (
		<ModelFaqSection
			model={model}
			benchmarkCount={benchmarkCount}
			activeProviderCount={activeProviderCount}
			isGatewayActive={isGatewayActive}
			pricing={pricing}
			relatedModels={relatedModels}
			gatewayMetadata={gatewayMetadata}
		/>
	);
}

const baseModelPageTocItems: ModelPageTocItem[] = [
	{ id: "providers", label: "Providers" },
	{ id: "performance", label: "Performance" },
	{ id: "pricing", label: "Pricing" },
	{ id: "benchmarks", label: "Benchmarks" },
	{ id: "activity", label: "Activity" },
	{ id: "apps", label: "Apps" },
	{ id: "uptime", label: "Uptime" },
	{ id: "about", label: "About" },
	{ id: "subscriptions", label: "Subscriptions" },
	{ id: "faq", label: "FAQ" },
];

function getModelPageTocItems({
	showBenchmarks,
	showSubscriptions,
	status,
	isGatewayActive,
}: {
	showBenchmarks: boolean;
	showSubscriptions: boolean;
	status?: string | null;
	isGatewayActive: boolean;
}): ModelPageTocItem[] {
	if (status === "Retired") {
		return baseModelPageTocItems.filter((item) => {
			if (item.id === "benchmarks") return showBenchmarks;
			if (item.id === "subscriptions") return showSubscriptions;
			return item.id === "about" || item.id === "faq";
		});
	}

	return baseModelPageTocItems.filter((item) => {
		if (
			!isGatewayActive &&
			["performance", "pricing", "activity", "apps", "uptime"].includes(item.id)
		) {
			return false;
		}
		if (item.id === "benchmarks") return showBenchmarks;
		if (item.id === "subscriptions") return showSubscriptions;
		return true;
	});
}

export async function generateMetadata(props: {
	params: Promise<ModelRouteParams>;
}): Promise<Metadata> {
	const params = await props.params;
	const { modelId, modelName, organisationName } = await getModelMetadataIdentity(
		params,
		false,
	);
	const path = getModelPath(modelId);
	const imagePath = `/og/models/${modelId}`;
	return buildMetadata({
		title: buildModelOverviewMetadataTitle(modelName),
		description: buildModelOverviewMetadataDescription({
			modelName,
			organisationName,
		}),
		path,
		keywords: [
			modelName,
			`${modelName} benchmarks`,
			`${modelName} pricing`,
			organisationName ? `${organisationName} AI` : null,
			"Phaseo",
			"AI model comparison",
		].filter(Boolean) as string[],
		imagePath,
		robots: {
			index: true,
			follow: true,
		},
	});
}

export default async function Page({
	params,
}: {
	params: Promise<ModelRouteParams>;
}) {
	const routeParams = await params;
	const includeHidden = false;
	const { requestedModelId, canonicalModelId } = await resolveModelRouteIds(
		routeParams,
		includeHidden,
	);
	if (canonicalModelId !== requestedModelId) {
		permanentRedirect(getModelPath(canonicalModelId));
	}
	const modelId = canonicalModelId;
	if (isFreeRouterModelId(modelId)) {
		return (
			<ModelDetailShell modelId={modelId} tab="overview" includeHidden={includeHidden}>
				<FreeRouterOverview />
			</ModelDetailShell>
		);
	}
	const modelPromise = fetchFrontendModelOverview(modelId).catch(() => null);
	const benchmarkPromise = fetchFrontendModelBenchmarkHighlights(modelId).catch(() => []);
	const subscriptionPromise = fetchFrontendModelSubscriptionPlans(modelId).catch(() => []);
	const availabilityPromise = fetchFrontendModelAvailability(modelId).catch(() => undefined);
	const pricingPromise = fetchFrontendModelPricing(modelId).catch(() => []);
	const gatewayMetadataPromise = fetchFrontendModelGatewayMetadata(modelId).catch(
		() => null,
	);
	const [modelOverview, benchmarkHighlights, subscriptionPlans, availability] =
		await Promise.all([
			modelPromise,
			benchmarkPromise,
			subscriptionPromise,
			availabilityPromise,
		]);
	if (!modelOverview) notFound();
	const showBenchmarks = benchmarkHighlights.length > 0;
	const showSubscriptions = subscriptionPlans.length > 0;
	const isGatewayActive =
		availability?.isGatewayActive ?? true;
	const resolvedPerformancePromise = isGatewayActive
		? fetchFrontendModelPerformance(modelId, 24).catch(() => null)
		: Promise.resolve(null);
	const isRetired = modelOverview?.status === "Retired";
	const modelPageTocItems = getModelPageTocItems({
		showBenchmarks,
		showSubscriptions,
		status: modelOverview?.status,
		isGatewayActive,
	});
	const modelName = modelOverview?.name ?? modelId.split("/").slice(-1)[0] ?? modelId;
	const organisationName =
		modelOverview?.organisation?.name ?? routeParams.organisationId;
	const modelHeader = modelOverview ? {
		model_id: modelOverview.model_id,
		name: modelOverview.name,
		organisation_id: modelOverview.organisation_id,
		organisation: {
			name: modelOverview.organisation.name,
			country_code: modelOverview.organisation.country_code ?? "",
		},
		aliases: modelOverview.aliases ?? [],
		family_id: modelOverview.family_id ?? undefined,
		status: modelOverview.status,
		hidden: false,
	} : undefined;
	const datasetSchema = {
		"@context": "https://schema.org",
		"@type": "Dataset",
		name: `${organisationName} ${modelName}`.trim(),
		description: `Phaseo profile for ${modelName} with pricing, benchmarks, providers, latency signals, and gateway compatibility details.`,
		url: absoluteUrl(getModelPath(modelId)),
		creator: {
			"@type": "Organization",
			name: organisationName,
		},
		keywords: [
			modelName,
			`${modelName} pricing`,
			`${modelName} benchmarks`,
			`${modelName} providers`,
		],
		dateModified:
			modelOverview?.updated_at ??
			modelOverview?.release_date ??
			modelOverview?.announcement_date ??
			undefined,
	};
	const breadcrumbSchema = {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: [
			{
				"@type": "ListItem",
				position: 1,
				name: "Home",
				item: absoluteUrl("/"),
			},
			{
				"@type": "ListItem",
				position: 2,
				name: "Models",
				item: absoluteUrl("/models"),
			},
			{
				"@type": "ListItem",
				position: 3,
				name: modelName,
				item: absoluteUrl(getModelPath(modelId)),
			},
		],
	};

	return (
		<>
			<JsonLdScript
				id="model-dataset-schema"
				data={datasetSchema}
			/>
			<JsonLdScript
				id="model-breadcrumb-schema"
				data={breadcrumbSchema}
			/>
			<ModelDetailShell modelId={modelId} tab="overview" includeHidden={includeHidden} header={modelHeader} modelOverview={modelOverview}>
				<div className="space-y-10">
					<div className="flex flex-col gap-6 lg:flex-row lg:items-start">
						<ModelPageToc
							items={modelPageTocItems}
							className="lg:h-full lg:w-40 lg:shrink-0 xl:w-44"
						/>
						<div className="min-w-0 flex-1 space-y-10">
							<ModelOverviewSections
								modelId={modelId}
								model={modelOverview}
								includeHidden={includeHidden}
								showBenchmarks={showBenchmarks}
								showSubscriptions={showSubscriptions}
								status={modelOverview?.status}
								isGatewayActive={isGatewayActive}
								performancePromise={resolvedPerformancePromise}
							/>
							{modelOverview ? (
								<Suspense fallback={null}>
									<ModelFaqSectionContent
										model={modelOverview}
										benchmarkCount={benchmarkHighlights.length}
										activeProviderCount={availability?.activeProviderCount ?? 0}
										isGatewayActive={isGatewayActive}
										pricingPromise={pricingPromise}
										gatewayMetadataPromise={gatewayMetadataPromise}
									/>
								</Suspense>
							) : null}
						</div>
					</div>
					{isRetired ? null : (
						<Suspense fallback={<ModelCreatorModelsSkeleton />}>
							<ModelCreatorModelsSectionContent
								modelId={modelId}
								includeHidden={includeHidden}
								modelPromise={modelPromise}
							/>
						</Suspense>
					)}
				</div>
			</ModelDetailShell>
		</>
	);
}
