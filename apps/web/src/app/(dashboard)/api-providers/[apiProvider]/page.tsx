import APIProviderDetailShell from "@/components/(data)/api-providers/APIProviderDetailShell";
import ProviderTokenUsageChart from "@/components/(data)/api-providers/Gateway/ProviderTokenUsageChart";
import PerformanceCards from "@/components/(data)/api-providers/Gateway/PerformanceCards";
import {
	fetchFrontendAPIProviderHeader,
	fetchFrontendAPIProviderModels,
} from "@/lib/fetchers/frontend/fetchPublicCatalog";
import ProviderModelsClient from "./models/ProviderModelsClient";
import type { Metadata } from "next";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import Script from "next/script";
import { notFound } from "next/navigation";

async function fetchProviderMeta(apiProviderId: string) {
	try {
		return await fetchFrontendAPIProviderHeader(apiProviderId);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn("[seo] failed to load api provider metadata", {
			apiProviderId,
			error,
		});
		return null;
	}
}

export async function generateMetadata(props: {
	params: Promise<{ apiProvider: string }>;
}): Promise<Metadata> {
	const { apiProvider } = await props.params;
	const header = await fetchProviderMeta(apiProvider);
	if (!header) notFound();
	const imagePath = `/og/api-providers/${apiProvider}`;

	// Fallback: provider not found / fetch failed
	if (!header) {
		return buildMetadata({
			title: "AI API Provider Performance Analytics",
			description:
				"Inspect AI API provider performance on Phaseo with latency, throughput, and reliability metrics from real gateway traffic, plus model usage trends and provider-level rankings.",
			path: `/api-providers/${apiProvider}`,
			keywords: [
				"AI API provider",
				"API performance",
				"latency monitoring",
				"throughput metrics",
				"gateway analytics",
				"Phaseo",
			],
			imagePath,
			imageAlt: "Phaseo API provider insights",
			openGraph: {
				type: "website",
			},
		});
	}

	const providerName = header.api_provider_name ?? "AI API provider";

	const description = [
		`${providerName} on Phaseo - real-world performance analytics from the Phaseo Gateway.`,
		"Review token usage trends, latency, throughput, and average generation time, plus which apps and models drive this provider's traffic.",
	]
		.filter(Boolean)
		.join(" ");

	return buildMetadata({
		title: `${providerName} API`,
		description,
		path: `/api-providers/${apiProvider}`,
		keywords: [
			providerName,
			`${providerName} API`,
			`${providerName} performance`,
			"AI API provider",
			"API latency metrics",
			"gateway analytics",
			"Phaseo",
		],
		imagePath,
		imageAlt: `${providerName} gateway analytics on Phaseo`,
		openGraph: {
			type: "website",
		},
	});
}

export default async function Page({
	params,
}: {
	params: Promise<{ apiProvider: string }>;
}) {
	const resolved = await params;
	const apiProvider = resolved.apiProvider;
	const header = await fetchProviderMeta(apiProvider);
	if (!header) notFound();
	const models = await fetchFrontendAPIProviderModels(apiProvider);

	// Generate structured data for the provider page.
	const generateStructuredData = () => {
		if (!header) return null;

		const providerName = header.api_provider_name || "API Provider";

		// Organization Schema
		const organizationSchema = {
			"@context": "https://schema.org",
			"@type": "Organization",
			"name": providerName,
			"description": `${providerName} is an AI API provider tracked on Phaseo. View real-world performance analytics, latency metrics, throughput data, and popular models.`,
		};

		// Breadcrumb Schema
		const breadcrumbSchema = {
			"@context": "https://schema.org",
			"@type": "BreadcrumbList",
			"itemListElement": [
				{
					"@type": "ListItem",
					"position": 1,
					"name": "Home",
					"item": absoluteUrl("/"),
				},
				{
					"@type": "ListItem",
					"position": 2,
					"name": "API Providers",
					"item": absoluteUrl("/api-providers"),
				},
				{
					"@type": "ListItem",
					"position": 3,
					"name": providerName,
					"item": absoluteUrl(`/api-providers/${apiProvider}`),
				},
			],
		};

		return { organizationSchema, breadcrumbSchema };
	};

	const structuredData = generateStructuredData();

	return (
		<>
			{structuredData && (
				<>
					<Script
						id="provider-org-schema"
						type="application/ld+json"
						dangerouslySetInnerHTML={{
							__html: JSON.stringify(structuredData.organizationSchema),
						}}
					/>
					<Script
						id="provider-breadcrumb-schema"
						type="application/ld+json"
						dangerouslySetInnerHTML={{
							__html: JSON.stringify(structuredData.breadcrumbSchema),
						}}
					/>
				</>
			)}
			<APIProviderDetailShell apiProviderId={apiProvider} tocItems={[{ id: "performance", label: "Performance" }, { id: "token-usage", label: "Token Usage" }, { id: "top-models", label: "Top Models" }, { id: "top-apps", label: "Top Apps" }, { id: "models", label: "Models" }]}>
				<div className="flex flex-col gap-10 w-full">
					<section id="performance" className="scroll-mt-36 space-y-4">
						<div className="space-y-1">
							<h2 className="text-xl font-semibold tracking-tight">Performance</h2>
							<p className="text-sm text-muted-foreground">Latency and throughput from recent gateway traffic, with leading models for each signal.</p>
						</div>
						<PerformanceCards params={params} />
					</section>

					<ProviderTokenUsageChart apiProviderId={apiProvider} />

					<section id="models" className="scroll-mt-36 space-y-4 border-t border-border pt-10">
						<div className="space-y-1">
							<h2 className="text-xl font-semibold">Models</h2>
							<p className="text-sm text-muted-foreground">
								Browse models available through {header.api_provider_name}.
							</p>
						</div>
						<ProviderModelsClient
							apiProvider={apiProvider}
							providerLabel={header.api_provider_name}
							models={models}
						/>
					</section>
				</div>
			</APIProviderDetailShell>
		</>
	);
}
