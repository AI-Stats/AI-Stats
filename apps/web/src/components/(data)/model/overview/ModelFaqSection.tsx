import { ChevronDown } from "lucide-react";
import Link from "next/link";

import type { ModelOverviewPage } from "@/lib/fetchers/models/getModel";
import type {
	PricingRule,
	ProviderPricing,
} from "@/lib/fetchers/models/getModelPricing";
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

type PricingHighlight = {
	label: string;
	formattedPrice: string;
	providerId: string;
	providerName: string;
};

function isNonNull<T>(value: T | null): value is T {
	return value !== null;
}

const PRICING_METER_LABELS: Record<string, string> = {
	input_text_tokens: "text input",
	input_tokens: "input",
	output_text_tokens: "text output",
	output_tokens: "output",
	input_audio_tokens: "audio input",
	output_audio_tokens: "audio output",
	input_image_tokens: "image input",
	output_image_tokens: "image output",
	input_video_tokens: "video input",
	output_video_tokens: "video output",
	images: "image generation",
	requests: "request",
};

function formatCurrency(amount: number, currency: string): string {
	const normalizedCurrency = currency.trim().toUpperCase() || "USD";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: normalizedCurrency,
		minimumFractionDigits: amount === 0 ? 0 : amount < 0.01 ? 4 : 2,
		maximumFractionDigits: amount > 0 && amount < 0.01 ? 4 : 2,
	}).format(amount);
}

function normaliseRulePrice(rule: PricingRule): {
	price: number;
	formattedPrice: string;
} | null {
	const rawPrice = Number(rule.price_per_unit);
	const unitSize = Number(rule.unit_size);
	if (!Number.isFinite(rawPrice) || rawPrice < 0 || !Number.isFinite(unitSize) || unitSize <= 0) {
		return null;
	}

	const unit = rule.unit.trim().toLowerCase();
	if (unit === "token" || unit === "tokens" || rule.meter.includes("tokens")) {
		const price = rawPrice * (1_000_000 / unitSize);
		return {
			price,
			formattedPrice: `${formatCurrency(price, rule.currency)} per 1M tokens`,
		};
	}

	const unitLabel = unitSize === 1 ? unit : `${unitSize} ${unit}${unit.endsWith("s") ? "" : "s"}`;
	return {
		price: rawPrice,
		formattedPrice: `${formatCurrency(rawPrice, rule.currency)} per ${unitLabel}`,
	};
}

function getPricingHighlights(pricing: ProviderPricing[]): PricingHighlight[] {
	const candidates = pricing.flatMap((provider) =>
		provider.pricing_rules
			.filter((rule) => {
				const plan = rule.pricing_plan.trim().toLowerCase();
				return !plan || plan === "standard" || plan === "free";
			})
			.map((rule) => {
				const normalized = normaliseRulePrice(rule);
				if (!normalized) return null;
				return {
					meter: rule.meter,
					...normalized,
					providerId: provider.provider.api_provider_id,
					providerName: provider.provider.api_provider_name,
				};
			})
			.filter(isNonNull),
	);

	const lowestByMeter = new Map<string, (typeof candidates)[number]>();
	for (const candidate of candidates) {
		const current = lowestByMeter.get(candidate.meter);
		if (!current || candidate.price < current.price) lowestByMeter.set(candidate.meter, candidate);
	}

	const meterPriority = [
		"input_text_tokens",
		"input_tokens",
		"output_text_tokens",
		"output_tokens",
	];
	return Array.from(lowestByMeter.values())
		.sort((a, b) => {
			const aPriority = meterPriority.indexOf(a.meter);
			const bPriority = meterPriority.indexOf(b.meter);
			return (aPriority < 0 ? 100 : aPriority) - (bPriority < 0 ? 100 : bPriority);
		})
		.slice(0, 3)
		.map((candidate) => ({
			label: PRICING_METER_LABELS[candidate.meter] ?? candidate.meter.replace(/_/g, " "),
			formattedPrice: candidate.formattedPrice,
			providerId: candidate.providerId,
			providerName: candidate.providerName,
		}));
}

export default function ModelFaqSection({
	model,
	benchmarkCount,
	activeProviderCount,
	isGatewayActive,
	pricing,
}: {
	model: ModelOverviewPage;
	benchmarkCount: number;
	activeProviderCount: number;
	isGatewayActive: boolean;
	pricing: ProviderPricing[];
}) {
	const modelName = model.name;
	const organisationName = model.organisation.name;
	const releaseDate = model.release_date ?? model.announcement_date ?? null;
	const inputTypes = parseTypes(model.input_types);
	const outputTypes = parseTypes(model.output_types);
	const pricingHighlights = isGatewayActive ? getPricingHighlights(pricing) : [];

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
		...(pricingHighlights.length > 0
			? [
					{
						question: `How much does ${modelName} cost?`,
						answer: (
							<>
								The lowest base rates currently recorded for {modelName} are{" "}
								{pricingHighlights.map((highlight, index) => (
									<span key={`${highlight.label}-${highlight.providerId}`}>
										{index > 0 ? (index === pricingHighlights.length - 1 ? "; and " : "; ") : ""}
										{highlight.label} at {highlight.formattedPrice} through{" "}
										<Link
											href={`/api-providers/${highlight.providerId}`}
											className="font-medium underline underline-offset-4"
										>
											{highlight.providerName}
										</Link>
									</span>
								))}
								. The{" "}
								<Link href="#pricing" className="font-medium underline underline-offset-4">
									pricing section
								</Link>{" "}
								shows every recorded provider, pricing plan, meter, and condition.
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
					<details key={item.question} className="group px-4 md:px-5">
						<summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left marker:content-none [&::-webkit-details-marker]:hidden">
							<h3 className="text-base font-semibold">{item.question}</h3>
							<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
						</summary>
						<p className="pb-4 pr-8 text-sm leading-6 text-muted-foreground">{item.answer}</p>
					</details>
				))}
			</div>
		</section>
	);
}
