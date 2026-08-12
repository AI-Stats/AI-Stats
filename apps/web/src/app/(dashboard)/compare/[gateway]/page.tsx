import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Minus } from "lucide-react";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { buildMetadata } from "@/lib/seo";

type Comparison = {
	name: string;
	slug: string;
	intro: string;
	bestFor: string;
	phaseoAdvantage: string;
	competitorAdvantage: string;
	rows: Array<{ capability: string; phaseo: string; competitor: string }>;
	sources: Array<{ label: string; href: string }>;
};

const comparisons: Record<string, Comparison> = {
	openrouter: {
		name: "OpenRouter",
		slug: "openrouter",
		intro: "Compare two independent, OpenAI-compatible platforms for accessing and routing models across providers.",
		bestFor: "Choose OpenRouter when its broad catalogue, established routing controls, or existing ecosystem fit is the deciding factor. Choose Phaseo when you want model intelligence, gateway routing, and request observability in one open-source platform.",
		phaseoAdvantage: "Phaseo combines an open model database with provider pricing, availability, benchmarks, routing, and observability instead of treating the catalogue as only an API picker.",
		competitorAdvantage: "OpenRouter offers a mature multi-provider routing surface with extensive provider filters and a broad existing model ecosystem.",
		rows: [
			{ capability: "Primary product shape", phaseo: "Model database, gateway, and observability platform", competitor: "Unified model API and provider router" },
			{ capability: "Source availability", phaseo: "Open-source platform and public catalogue", competitor: "Hosted platform with public documentation" },
			{ capability: "Provider routing", phaseo: "Policies, fallbacks, presets, and provider compatibility", competitor: "Provider ordering, filtering, fallbacks, and price/latency/throughput sorting" },
			{ capability: "BYOK", phaseo: "First 1M requests monthly fee-free, then a service fee", competitor: "First 1M requests monthly fee-free, then 5% of equivalent inference cost" },
			{ capability: "Managed usage fees", phaseo: "Credit-purchase fee; catalogue model rates remain separate", competitor: "5.5% credit-purchase fee on pay-as-you-go" },
			{ capability: "Model research", phaseo: "Pricing, providers, lifecycle, capabilities, benchmarks, and related models", competitor: "Model catalogue, pricing, rankings, and provider availability" },
		],
		sources: [
			{ label: "OpenRouter pricing", href: "https://openrouter.ai/pricing" },
			{ label: "OpenRouter provider routing", href: "https://openrouter.ai/docs/guides/routing/provider-selection" },
			{ label: "OpenRouter BYOK", href: "https://openrouter.ai/docs/guides/overview/auth/byok" },
		],
	},
	"vercel-ai-gateway": {
		name: "Vercel AI Gateway",
		slug: "vercel-ai-gateway",
		intro: "Compare Phaseo with Vercel's gateway for unified model access, routing, billing, and usage visibility.",
		bestFor: "Choose Vercel AI Gateway when your stack is already centred on Vercel and the AI SDK. Choose Phaseo when you want an infrastructure-independent, open-source gateway joined to a deeper public model database.",
		phaseoAdvantage: "Phaseo is built around an open model-intelligence layer that connects research, provider routes, pricing, operational signals, and gateway usage.",
		competitorAdvantage: "Vercel AI Gateway integrates closely with Vercel projects and the AI SDK, and currently documents zero token markup including BYOK.",
		rows: [
			{ capability: "Primary product shape", phaseo: "Model database, gateway, and observability platform", competitor: "Managed gateway integrated with the Vercel platform" },
			{ capability: "Framework compatibility", phaseo: "OpenAI-compatible API and Phaseo SDKs", competitor: "AI SDK, OpenAI Chat Completions, Responses, and Anthropic Messages" },
			{ capability: "Routing", phaseo: "Provider policies, fallbacks, presets, and compatibility-aware routes", competitor: "Dynamic provider selection, load balancing, retries, and fallbacks" },
			{ capability: "BYOK", phaseo: "Workspace provider keys with routing controls", competitor: "Provider credentials with BYOK-first fallback behaviour" },
			{ capability: "Pricing model", phaseo: "Pay as you go with an explicit credit-purchase fee", competitor: "Provider list rates with zero token markup" },
			{ capability: "Model research", phaseo: "Public lifecycle, pricing, availability, benchmark, and provider intelligence", competitor: "Public model list plus gateway pricing and provider variations" },
		],
		sources: [
			{ label: "Vercel AI Gateway overview", href: "https://vercel.com/docs/ai-gateway" },
			{ label: "Vercel AI Gateway pricing", href: "https://vercel.com/docs/ai-gateway/pricing" },
			{ label: "Vercel provider options", href: "https://vercel.com/docs/ai-gateway/models-and-providers/provider-options" },
		],
	},
	"cloudflare-ai-gateway": {
		name: "Cloudflare AI Gateway",
		slug: "cloudflare-ai-gateway",
		intro: "Compare Phaseo's unified model platform with Cloudflare's control plane for observing and controlling AI application traffic.",
		bestFor: "Choose Cloudflare AI Gateway when edge caching, rate limiting, and the wider Cloudflare platform are central requirements. Choose Phaseo when model discovery, managed model access, routing, and observability need to live together.",
		phaseoAdvantage: "Phaseo provides a public model database and managed multi-provider model access alongside gateway routing and observability.",
		competitorAdvantage: "Cloudflare brings gateway analytics, logging, caching, and rate limiting into its global developer platform, with core gateway features currently offered free.",
		rows: [
			{ capability: "Primary product shape", phaseo: "Model database, managed gateway, and observability platform", competitor: "AI traffic control plane in the Cloudflare platform" },
			{ capability: "Traffic controls", phaseo: "Routing policies, fallbacks, guardrails, and provider controls", competitor: "Caching, rate limiting, retries, model fallback, and routing" },
			{ capability: "Managed model access", phaseo: "Managed credits or BYOK through one model API", competitor: "Unified billing and provider integrations, plus BYOK-style provider connections" },
			{ capability: "Observability", phaseo: "Request, cost, model, provider, reliability, and usage views", competitor: "Request, token, cost analytics, and persistent logs" },
			{ capability: "Pricing model", phaseo: "Pay as you go with an explicit credit-purchase fee", competitor: "Core gateway features free; provider inference passed through without markup" },
			{ capability: "Model research", phaseo: "Lifecycle, price, providers, benchmarks, capabilities, and related models", competitor: "Gateway model catalogue and provider integration documentation" },
		],
		sources: [
			{ label: "Cloudflare AI Gateway overview", href: "https://developers.cloudflare.com/ai-gateway/" },
			{ label: "Cloudflare AI Gateway pricing", href: "https://developers.cloudflare.com/ai-gateway/reference/pricing/" },
		],
	},
};

export function generateStaticParams() {
	return Object.keys(comparisons).map((gateway) => ({ gateway }));
}

export async function generateMetadata({ params }: { params: Promise<{ gateway: string }> }): Promise<Metadata> {
	const { gateway } = await params;
	const comparison = comparisons[gateway];
	if (!comparison) return {};
	return buildMetadata({
		title: `Phaseo vs ${comparison.name}`,
		description: `${comparison.intro} Review routing, pricing, BYOK, model intelligence, and observability differences.`,
		path: `/compare/${comparison.slug}`,
		keywords: [`${comparison.name} alternative`, `Phaseo vs ${comparison.name}`, "AI gateway comparison"],
	});
}

export default async function ComparisonPage({ params }: { params: Promise<{ gateway: string }> }) {
	const { gateway } = await params;
	const comparison = comparisons[gateway];
	if (!comparison) notFound();

	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
			<section className="max-w-4xl border-b border-border pb-12">
				<p className="text-sm font-medium text-muted-foreground">AI gateway comparison</p>
				<h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Phaseo vs {comparison.name}</h1>
				<p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">{comparison.intro}</p>
				<div className="mt-8 flex flex-wrap gap-3">
					<Button asChild><Link href="/sign-up">Try Phaseo <ArrowRight className="size-4" /></Link></Button>
					<Button asChild variant="outline"><Link href={comparison.slug === "cloudflare-ai-gateway" ? "/migrate" : `/migrate/${comparison.slug}`}>Migration guide</Link></Button>
				</div>
			</section>

			<section className="grid gap-6 border-b border-border py-12 md:grid-cols-2">
				<div><h2 className="text-xl font-semibold">Where Phaseo stands out</h2><p className="mt-3 leading-7 text-muted-foreground">{comparison.phaseoAdvantage}</p></div>
				<div><h2 className="text-xl font-semibold">Where {comparison.name} stands out</h2><p className="mt-3 leading-7 text-muted-foreground">{comparison.competitorAdvantage}</p></div>
			</section>

			<section className="py-12">
				<h2 className="text-2xl font-semibold">Capability comparison</h2>
				<div className="mt-6 overflow-hidden rounded-2xl border border-border">
					<div className="grid grid-cols-[0.75fr_1fr_1fr] bg-muted/40 text-sm font-semibold"><div className="p-4">Capability</div><div className="p-4">Phaseo</div><div className="p-4">{comparison.name}</div></div>
					{comparison.rows.map((row) => <div key={row.capability} className="grid grid-cols-1 border-t border-border md:grid-cols-[0.75fr_1fr_1fr]"><div className="p-4 font-medium">{row.capability}</div><div className="flex gap-2 p-4 text-sm leading-6 text-muted-foreground"><Check className="mt-1 size-4 shrink-0 text-foreground" />{row.phaseo}</div><div className="flex gap-2 p-4 text-sm leading-6 text-muted-foreground"><Minus className="mt-1 size-4 shrink-0" />{row.competitor}</div></div>)}
				</div>
			</section>

			<section className="border-y border-border py-12"><h2 className="text-2xl font-semibold">Which should you choose?</h2><p className="mt-4 max-w-4xl leading-7 text-muted-foreground">{comparison.bestFor}</p></section>
			<section className="pt-10"><h2 className="text-lg font-semibold">Official competitor sources</h2><ul className="mt-4 space-y-2">{comparison.sources.map((source) => <li key={source.href}><a className="inline-flex items-center gap-2 text-sm underline underline-offset-4" href={source.href} target="_blank" rel="noreferrer">{source.label}<ExternalLink className="size-3.5" /></a></li>)}</ul><p className="mt-5 text-xs text-muted-foreground">Last reviewed 12 August 2026. Product features and pricing can change; verify purchasing decisions with each provider.</p></section>
			<nav aria-label="Other gateway comparisons" className="mt-10 border-t border-border pt-8">
				<p className="text-sm font-medium">More gateway comparisons</p>
				<div className="mt-3 flex flex-wrap gap-4 text-sm">
					{Object.values(comparisons).filter((item) => item.slug !== comparison.slug).map((item) => <Link key={item.slug} className="underline underline-offset-4" href={`/compare/${item.slug}`}>Phaseo vs {item.name}</Link>)}
				</div>
			</nav>
		</main>
	);
}
