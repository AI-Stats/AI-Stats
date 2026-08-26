import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, Check, Clock3, Gauge, Route, ShieldCheck, Sparkles } from "lucide-react";

import ShowFooterStyle from "@/components/layout/ShowFooterStyle";
import { Button } from "@/components/ui/button";
import { buildMetadata } from "@/lib/seo";
import TokenSpeedSimulation from "./TokenSpeedSimulation";

const metrics = [
	{
		index: "01",
		name: "Time to first token",
		unit: "ms",
		description: "How long someone waits before the response begins. This is the metric users feel first.",
		goodFor: "Chat, copilots, voice and interactive agents",
		icon: Clock3,
	},
	{
		index: "02",
		name: "Output speed",
		unit: "tokens/s",
		description: "How quickly text arrives after generation starts. It determines whether a long answer feels fluid or laboured.",
		goodFor: "Long-form generation, coding and batch workloads",
		icon: Gauge,
	},
	{
		index: "03",
		name: "End-to-end latency",
		unit: "ms",
		description: "The complete request journey, including routing, provider queues, inference and network transfer.",
		goodFor: "Tools, structured outputs and multi-step workflows",
		icon: Route,
	},
];

const profiles = [
	{ name: "Instant interaction", note: "Optimise the start", latency: 22, throughput: 62, reliability: 92 },
	{ name: "Balanced product", note: "Optimise the whole request", latency: 48, throughput: 54, reliability: 88 },
	{ name: "Heavy reasoning", note: "Optimise useful work", latency: 84, throughput: 34, reliability: 82 },
];

const latencyJourney = [
	{ label: "Phaseo routing", value: 38, width: 13, tone: "bg-sky-500" },
	{ label: "Provider queue", value: 76, width: 25, tone: "bg-amber-500" },
	{ label: "First token", value: 188, width: 62, tone: "bg-foreground" },
];

const uptimeBudgets = [
	{ availability: "99.9%", monthly: "43m 50s", yearly: "8h 46m", width: 100 },
	{ availability: "99.95%", monthly: "21m 55s", yearly: "4h 23m", width: 50 },
	{ availability: "99.99%", monthly: "4m 23s", yearly: "52m 36s", width: 10 },
];

const decisions = [
	{
		title: "Building a conversational interface?",
		answer: "Prioritise time to first token.",
		detail: "A fast start usually matters more than peak output speed. Stream early and keep the response moving.",
	},
	{
		title: "Generating long answers or code?",
		answer: "Prioritise sustained throughput.",
		detail: "Measure generation separately so provider queues do not hide a slow model behind one average.",
	},
	{
		title: "Running tools or structured workflows?",
		answer: "Measure the full request path.",
		detail: "The model can be fast while orchestration is slow. Track routing, retries and tool calls separately.",
	},
];

export const metadata: Metadata = buildMetadata({
	title: "AI Model Performance",
	description: "Understand AI model latency, throughput, reliability, and the trade-offs that shape real product performance.",
	path: "/performance",
	keywords: ["AI model performance", "LLM latency", "LLM throughput", "time to first token", "AI model reliability"],
});

export default function PerformancePage() {
	return (
		<main className="min-h-screen overflow-hidden bg-background">
			<ShowFooterStyle />
			<section className="relative border-b border-border/70">
				<div
					className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20"
					style={{
						backgroundImage:
							"linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
						backgroundSize: "48px 48px",
						maskImage: "linear-gradient(to bottom, black, transparent 90%)",
					}}
				/>
				<div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-end lg:px-8">
					<div className="max-w-3xl">
						<h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-6xl lg:text-7xl">
							Fast is not one number.
						</h1>
						<p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
							Model performance is the shape of an experience: when an answer starts, how smoothly it arrives, and whether the system stays dependable under load.
						</p>
						<div className="mt-8 flex flex-wrap gap-3">
							<Button className="rounded-md" asChild><Link href="/compare">Compare models <ArrowRight /></Link></Button>
							<Button className="rounded-md" variant="outline" asChild><Link href="/how-phaseo-measures-latency-throughput">Read the methodology</Link></Button>
						</div>
					</div>
					<div className="border-l border-border/70 pl-6 lg:pb-2">
						<p className="text-sm font-medium text-muted-foreground">A useful performance view asks</p>
						<ol className="mt-5 space-y-4 text-sm">
							{["How quickly does useful work begin?", "How fast does the result arrive?", "How often does the path succeed?"].map((item, index) => (
								<li key={item} className="flex items-start gap-3">
									<span className="mt-0.5 font-mono text-xs text-muted-foreground">0{index + 1}</span>
									<span className="font-medium">{item}</span>
								</li>
							))}
						</ol>
					</div>
				</div>
			</section>

			<PageSection intro={{ title: "Three measures, three different questions", description: "Treating these as one score makes model selection simpler—and usually wrong." }}>
				<div className="border-y border-border/70">
					{metrics.map((metric) => {
						const Icon = metric.icon;
						return (
							<article key={metric.name} className="group grid gap-5 border-b border-border/70 py-7 last:border-b-0 sm:grid-cols-[3rem_minmax(0,1fr)_9rem]">
								<div className="flex size-10 items-center justify-center rounded-md border border-border/70 bg-muted/30 text-muted-foreground transition-colors group-hover:text-foreground"><Icon className="size-4" /></div>
								<div>
									<div className="flex flex-wrap items-baseline gap-3"><h2 className="text-xl font-semibold tracking-tight">{metric.name}</h2><span className="font-mono text-xs text-muted-foreground">{metric.unit}</span></div>
									<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{metric.description}</p>
								</div>
								<div className="sm:text-right"><p className="font-mono text-xs text-muted-foreground">{metric.index}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{metric.goodFor}</p></div>
							</article>
						);
					})}
				</div>
			</PageSection>

			<div className="border-y border-border/70 bg-muted/20">
				<PageSection intro={{ title: "Watch generation happen", description: "The same response streams below at three different relative speeds. Compare the pause before generation with the pace after the first token arrives." }}>
					<TokenSpeedSimulation />
				</PageSection>
			</div>

			<div className="border-y border-border/70 bg-muted/20">
				<PageSection intro={{ title: "The best model depends on the experience", description: "Illustrative profiles show why a single leaderboard cannot describe every product. Shorter latency bars are better; longer throughput and reliability bars are better." }}>
					<div className="overflow-hidden rounded-md border border-border/70 bg-background">
						<div className="hidden grid-cols-[minmax(11rem,1fr)_repeat(3,minmax(7rem,0.7fr))] border-b border-border/70 bg-muted/30 px-5 py-3 text-xs font-medium text-muted-foreground sm:grid">
							<span>Product profile</span><span>Start latency</span><span>Throughput</span><span>Reliability</span>
						</div>
						{profiles.map((profile) => (
							<div key={profile.name} className="grid gap-5 border-b border-border/70 px-5 py-6 last:border-b-0 sm:grid-cols-[minmax(11rem,1fr)_repeat(3,minmax(7rem,0.7fr))] sm:items-center">
								<div><h3 className="font-medium">{profile.name}</h3><p className="mt-1 text-xs text-muted-foreground">{profile.note}</p></div>
								<MetricBar label="Start latency" value={profile.latency} inverse />
								<MetricBar label="Throughput" value={profile.throughput} />
								<MetricBar label="Reliability" value={profile.reliability} />
							</div>
						))}
						<div className="flex items-start gap-2 border-t border-border/70 bg-muted/20 px-5 py-3 text-xs leading-5 text-muted-foreground"><Sparkles className="mt-0.5 size-3.5 shrink-0" />These profiles explain trade-offs; they are not live measurements or model rankings.</div>
					</div>
				</PageSection>
			</div>

			<PageSection intro={{ title: "See where the wait happens", description: "Total latency is a chain, not a single model measurement. Breaking the request into stages shows where optimisation will actually help." }}>
				<div className="grid overflow-hidden rounded-md border border-border/70 bg-background lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
					<div className="border-b border-border/70 p-6 lg:border-b-0 lg:border-r">
						<div className="flex items-end justify-between gap-4">
							<div><p className="text-sm font-medium">Illustrative request journey</p><p className="mt-1 text-xs text-muted-foreground">Browser to first generated token</p></div>
							<p className="font-mono text-2xl font-semibold">302 ms</p>
						</div>
						<div className="mt-10 flex h-12 overflow-hidden rounded-md border border-border/70">
							{latencyJourney.map((stage) => <div key={stage.label} className={`${stage.tone} h-full border-r border-background/40 last:border-r-0`} style={{ width: `${stage.width}%` }} />)}
						</div>
						<div className="mt-5 grid gap-3 sm:grid-cols-3">
							{latencyJourney.map((stage) => (
								<div key={stage.label} className="border-l-2 border-border pl-3"><p className="text-xs text-muted-foreground">{stage.label}</p><p className="mt-1 font-mono text-sm font-medium">{stage.value} ms</p></div>
							))}
						</div>
					</div>
					<div className="flex flex-col justify-between bg-muted/20 p-6">
						<Route className="size-5 text-muted-foreground" />
						<div className="mt-12"><p className="text-lg font-medium">Optimise the longest stage first.</p><p className="mt-3 text-sm leading-6 text-muted-foreground">Faster routing cannot compensate for a long provider queue. A faster model cannot fix repeated tool calls.</p></div>
					</div>
				</div>
			</PageSection>

			<div className="border-y border-border/70 bg-muted/20">
				<PageSection intro={{ title: "Uptime becomes a time budget", description: "Availability percentages are easier to reason about when translated into the interruption they allow." }}>
					<div className="overflow-hidden rounded-md border border-border/70 bg-background">
						<div className="grid grid-cols-[5rem_minmax(0,1fr)_6rem] gap-4 border-b border-border/70 bg-muted/30 px-5 py-3 text-xs font-medium text-muted-foreground sm:grid-cols-[7rem_minmax(0,1fr)_8rem]">
							<span>Availability</span><span>Monthly downtime budget</span><span className="text-right">Per year</span>
						</div>
						{uptimeBudgets.map((budget) => (
							<div key={budget.availability} className="grid grid-cols-[5rem_minmax(0,1fr)_6rem] items-center gap-4 border-b border-border/70 px-5 py-6 last:border-b-0 sm:grid-cols-[7rem_minmax(0,1fr)_8rem]">
								<div className="flex items-center gap-2"><ShieldCheck className="hidden size-4 text-emerald-500 sm:block" /><span className="font-mono font-medium">{budget.availability}</span></div>
								<div><div className="h-2 overflow-hidden rounded-md bg-muted"><div className="h-full rounded-md bg-emerald-500" style={{ width: `${budget.width}%` }} /></div><p className="mt-2 font-mono text-xs text-muted-foreground">{budget.monthly}</p></div>
								<p className="text-right font-mono text-xs text-muted-foreground">{budget.yearly}</p>
							</div>
						))}
					</div>
				</PageSection>
			</div>

			<PageSection intro={{ title: "Start with the product constraint", description: "Performance work becomes clearer when the user experience—not an abstract score—sets the target." }}>
				<div className="grid gap-px overflow-hidden rounded-md border border-border/70 bg-border/70 md:grid-cols-3">
					{decisions.map((decision, index) => (
						<article key={decision.title} className="flex min-h-64 flex-col bg-background p-6">
							<span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
							<h3 className="mt-8 text-lg font-medium tracking-tight">{decision.title}</h3>
							<p className="mt-4 flex items-start gap-2 text-sm font-medium"><Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />{decision.answer}</p>
							<p className="mt-auto pt-6 text-sm leading-6 text-muted-foreground">{decision.detail}</p>
						</article>
					))}
				</div>
			</PageSection>

			<section className="border-t border-border/70">
				<div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center lg:px-8">
					<div className="flex items-start gap-4">
						<div className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/30"><BarChart3 className="size-4" /></div>
						<div><h2 className="text-2xl font-semibold tracking-tight">Put the framework to work</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Compare real models across benchmarks, pricing and Phaseo Gateway performance signals.</p></div>
					</div>
					<Button className="rounded-md" size="lg" asChild><Link href="/compare">Open model comparison <ArrowRight /></Link></Button>
				</div>
			</section>
		</main>
	);
}

function PageSection({ intro, children }: { intro: { title: string; description: string }; children: React.ReactNode }) {
	return (
		<section className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[16rem_minmax(0,1fr)] lg:px-8">
			<header>
				<h2 className="text-balance text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">{intro.title}</h2>
				<p className="mt-4 text-sm leading-6 text-muted-foreground">{intro.description}</p>
			</header>
			{children}
		</section>
	);
}

function MetricBar({ label, value, inverse = false }: { label: string; value: number; inverse?: boolean }) {
	return (
		<div>
			<div className="mb-2 flex items-center justify-between sm:hidden"><span className="text-xs text-muted-foreground">{label}</span></div>
			<div className="h-1.5 overflow-hidden rounded-md bg-muted"><div className={`h-full rounded-md ${inverse ? "bg-amber-500" : "bg-foreground"}`} style={{ width: `${value}%` }} /></div>
		</div>
	);
}
