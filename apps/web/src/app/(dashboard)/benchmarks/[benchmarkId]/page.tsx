import BenchmarkDetailShell from "@/components/(data)/benchmark/BenchmarkDetailShell";
import BenchmarkOverview from "@/components/(data)/benchmark/BenchmarkOverview";
import { fetchFrontendBenchmark } from "@/lib/fetchers/frontend/fetchPublicCatalog";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import Script from "next/script";

function parseScore(score: string | number | null | undefined): number | null {
	if (score == null) return null;
	if (typeof score === "number") return Number.isFinite(score) ? score : null;
	if (typeof score === "string") {
		const match = score.match(/[-+]?[0-9]*\.?[0-9]+/);
		if (!match) return null;
		const parsed = Number.parseFloat(match[0]);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

async function fetchBenchmark(benchmarkId: string) {
	try {
		return await fetchFrontendBenchmark(benchmarkId);
	} catch (error) {
		console.warn("[seo] failed to load benchmark metadata", {
			benchmarkId,
			error,
		});
		return null;
	}
}

export async function generateMetadata(props: {
	params: Promise<{ benchmarkId: string }>;
}): Promise<Metadata> {
	const { benchmarkId } = await props.params;
	const benchmark = await fetchBenchmark(benchmarkId);
	const path = `/benchmarks/${benchmarkId}`;
	const imagePath = `/og/benchmarks/${benchmarkId}`;

	// Fallback if the benchmark can't be loaded
	if (!benchmark) {
		return buildMetadata({
			title: "AI Benchmark Leaderboard",
			description:
				"Explore AI benchmark leaderboards on Phaseo to compare model performance across tasks, datasets, methodology details, and historical score movement.",
			path,
			keywords: [
				"AI benchmark",
				"AI benchmark leaderboard",
				"model evaluation",
				"AI model performance",
				"Phaseo",
			],
			imagePath,
		});
	}

	const cleanName: string = benchmark.name ?? "AI benchmark";
	const results = benchmark.results ?? [];
	const orderHints = results
		.map(
			(result: any) => result?.benchmark?.order ?? result?.benchmark_order
		)
		.filter((value: unknown): value is string => typeof value === "string");
	const isLowerBetter = orderHints.some(
		(order) => order.toLowerCase() === "lower"
	);

	let bestScore: { value: number; modelName: string } | null = null;
	for (const result of results) {
		const numericScore = parseScore(result.score);
		if (numericScore != null) {
			const shouldReplace =
				!bestScore ||
				(isLowerBetter
					? numericScore < bestScore.value
					: numericScore > bestScore.value);
			if (shouldReplace) {
				bestScore = {
					value: numericScore,
					modelName:
						result.model?.name ??
						result.model_id ??
						"Unknown model",
				};
			}
		}
	}

	const topPerformer = bestScore?.modelName ?? null;
	const modelCount = benchmark.results?.length ?? 0;

	const descriptionParts: (string | undefined)[] = [
		`${cleanName} benchmark leaderboard on Phaseo.`,
		modelCount
			? `See ${modelCount} scored models, track historical performance, and inspect the underlying methodology.`
			: undefined,
		topPerformer ? `Current top model: ${topPerformer}.` : undefined,
	];

	return buildMetadata({
		title: `${cleanName} Benchmark`,
		description: descriptionParts.filter(Boolean).join(" "),
		path,
		keywords: [
			cleanName,
			`${cleanName} benchmark`,
			`${cleanName} leaderboard`,
			"AI benchmark",
			"model evaluation",
			"AI model performance",
			"Phaseo",
		],
		imagePath,
	});
}

export default async function Page({
	params,
}: {
	params: Promise<{ benchmarkId: string }>;
}) {
	const { benchmarkId } = await params;
	const benchmark = await fetchFrontendBenchmark(benchmarkId);

	if (!benchmark) {
		notFound();
	}

	// Generate structured data for the benchmark page.
	const generateStructuredData = () => {
		const benchmarkName = benchmark.name || "Benchmark";

		// Dataset Schema
		const datasetSchema = {
			"@context": "https://schema.org",
			"@type": "Dataset",
			"name": benchmarkName,
			"description": `${benchmarkName} is an AI benchmark leaderboard tracked on Phaseo. Compare model performance, view historical results, and understand evaluation methodology.`,
			"keywords": `${benchmarkName}, AI benchmark, model evaluation, leaderboard, AI performance`,
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
					"name": "Benchmarks",
					"item": absoluteUrl("/benchmarks"),
				},
				{
					"@type": "ListItem",
					"position": 3,
					"name": benchmarkName,
					"item": absoluteUrl(`/benchmarks/${benchmarkId}`),
				},
			],
		};

		return { datasetSchema, breadcrumbSchema };
	};

	const structuredData = generateStructuredData();

	return (
		<>
			{structuredData && (
				<>
					<Script
						id="benchmark-dataset-schema"
						type="application/ld+json"
						dangerouslySetInnerHTML={{
							__html: JSON.stringify(structuredData.datasetSchema),
						}}
					/>
					<Script
						id="benchmark-breadcrumb-schema"
						type="application/ld+json"
						dangerouslySetInnerHTML={{
							__html: JSON.stringify(structuredData.breadcrumbSchema),
						}}
					/>
				</>
			)}
			<BenchmarkDetailShell benchmark={benchmark}>
				<BenchmarkOverview benchmark={benchmark} />
			</BenchmarkDetailShell>
		</>
	);
}
