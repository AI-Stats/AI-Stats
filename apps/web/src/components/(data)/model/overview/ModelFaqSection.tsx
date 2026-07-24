import Link from "next/link";

import type { ModelOverviewPage } from "@/lib/fetchers/models/getModel";
import { formatModelLifecycleDate } from "@/lib/dates/modelLifecycleDates";

function parseTypes(value: string | null | undefined): string[] {
	if (!value) return [];
	return Array.from(
		new Set(
			value
				.split(",")
				.map((item) => item.trim().replace(/[_-]+/g, " "))
				.filter(Boolean),
		),
	);
}

function joinNaturalList(values: string[]): string {
	if (values.length === 0) return "";
	if (values.length === 1) return values[0]!;
	if (values.length === 2) return `${values[0]} and ${values[1]}`;
	return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function getStatusDescription(status: ModelOverviewPage["status"]): string {
	switch (status) {
		case "Rumoured":
			return "a rumoured AI model";
		case "Announced":
			return "an announced AI model";
		case "Limited Access":
			return "a limited-access AI model";
		case "Withheld":
			return "a withheld AI model";
		case "Deprecated":
			return "a deprecated AI model";
		case "Retired":
			return "a retired AI model";
		default:
			return "an AI model";
	}
}

export default function ModelFaqSection({
	model,
	benchmarkCount,
	activeProviderCount,
	isGatewayActive,
}: {
	model: ModelOverviewPage;
	benchmarkCount: number;
	activeProviderCount: number;
	isGatewayActive: boolean;
}) {
	const modelName = model.name;
	const organisationName = model.organisation.name;
	const releaseDate = model.release_date ?? model.announcement_date ?? null;
	const inputTypes = parseTypes(model.input_types);
	const outputTypes = parseTypes(model.output_types);

	const items = [
		{
			question: `What is ${modelName}?`,
			answer: (
				<>
					{modelName} is {getStatusDescription(model.status)} from{" "}
					<Link
						href={`/organisations/${model.organisation_id}`}
						className="font-medium underline underline-offset-4"
					>
						{organisationName}
					</Link>
					. This profile brings together its specifications, pricing, provider
					availability, benchmark results, and performance signals where those
					data are available.
				</>
			),
		},
		...(isGatewayActive
			? [
					{
						question: `How much does ${modelName} cost?`,
						answer: (
							<>
								Pricing can vary by provider, capability, and effective date. The{" "}
								<Link href="#pricing" className="font-medium underline underline-offset-4">
									pricing section
								</Link>{" "}
								compares the currently recorded routes and billing units for {modelName}.
							</>
						),
					},
				]
			: []),
		{
			question: `Which providers offer ${modelName}?`,
			answer: (
				<>
					{activeProviderCount > 0
						? `Phaseo currently records ${activeProviderCount} active Gateway ${activeProviderCount === 1 ? "provider" : "providers"} for ${modelName}. `
						: "Provider availability can change over time. "}
					The{" "}
					<Link href="#providers" className="font-medium underline underline-offset-4">
						providers section
					</Link>{" "}
					shows the routes and availability currently recorded by Phaseo.
				</>
			),
		},
		...(benchmarkCount > 0
			? [
					{
						question: `What benchmark results are available for ${modelName}?`,
						answer: (
							<>
								Phaseo currently tracks {benchmarkCount}{" "}
								{benchmarkCount === 1 ? "benchmark result" : "benchmark results"}
								{" "}for {modelName}. Review the{" "}
								<Link href="#benchmarks" className="font-medium underline underline-offset-4">
									benchmark section
								</Link>{" "}
								for scores, ranks, methodology context, and available sources.
							</>
						),
					},
				]
			: []),
		...(inputTypes.length > 0 || outputTypes.length > 0
			? [
					{
						question: `What modalities does ${modelName} support?`,
						answer: (
							<>
								{inputTypes.length > 0
									? `${modelName} accepts ${joinNaturalList(inputTypes)} input${inputTypes.length === 1 ? "" : "s"}. `
									: ""}
								{outputTypes.length > 0
									? `It produces ${joinNaturalList(outputTypes)} output${outputTypes.length === 1 ? "" : "s"}.`
									: ""}
							</>
						),
					},
				]
			: []),
		...(releaseDate
			? [
					{
						question: `When was ${modelName} released?`,
						answer: `${modelName} was ${model.release_date ? "released" : "announced"} on ${formatModelLifecycleDate(releaseDate)}.`,
					},
				]
			: []),
	];

	return (
		<section id="faq" className="scroll-mt-28 space-y-4 border-t border-border/60 pt-6">
			<div className="space-y-1">
				<h2 className="text-xl font-semibold tracking-tight">
					Frequently asked questions
				</h2>
				<p className="text-sm text-muted-foreground">
					Quick answers based on the model and route data currently recorded by Phaseo.
				</p>
			</div>
			<div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-background">
				{items.map((item) => (
					<div key={item.question} className="space-y-2 px-4 py-4 md:px-5">
						<h3 className="text-base font-semibold">{item.question}</h3>
						<p className="text-sm leading-6 text-muted-foreground">{item.answer}</p>
					</div>
				))}
			</div>
		</section>
	);
}
