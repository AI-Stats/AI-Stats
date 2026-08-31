import Link from "next/link";
import type { Metadata } from "next";
import {
	ArrowRight,
	Database,
	GitBranch,
	Handshake,
	LineChart,
	Route,
	ShieldCheck,
	Sparkles,
	Users,
	Wallet,
} from "lucide-react";
import { buildMetadata } from "@/lib/seo";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = buildMetadata({
	title: "Our Mission",
	description:
		"Phaseo's mission is to make access to AI models broad, affordable, transparent, portable, and open.",
	path: "/mission",
	keywords: [
		"Phaseo mission",
		"open source AI gateway",
		"affordable AI",
		"AI model access",
		"AI gateway principles",
	],
});

function SectionTitle({
	eyebrow,
	title,
	description,
}: {
	eyebrow?: string;
	title: string;
	description?: string;
}) {
	return (
		<div className="space-y-2">
			{eyebrow ? (
				<div className="text-[11px] font-semibold tracking-[0.26em] uppercase text-muted-foreground">
					{eyebrow}
				</div>
			) : null}
			<h2 className="max-w-4xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
				{title}
			</h2>
			{description ? (
				<p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
			) : null}
		</div>
	);
}

const principles = [
	{
		title: "Broad access",
		description:
			"Support as many useful models, providers, modalities, and capabilities as we responsibly can through one consistent interface.",
		icon: Database,
	},
	{
		title: "The lowest sustainable price",
		description:
			"Keep improving routing, infrastructure, and software efficiency, then use those gains to reduce prices and improve the service.",
		icon: Wallet,
	},
	{
		title: "Open by default",
		description:
			"Keep Phaseo open source so the gateway can be inspected, extended, challenged, and improved by the people who depend on it.",
		icon: GitBranch,
	},
	{
		title: "Users before investors",
		description:
			"Make decisions around long-term user benefit, product quality, and fair access rather than pressure for short-term financial returns.",
		icon: Users,
	},
	{
		title: "Transparency without lock-in",
		description:
			"Make pricing, routing, availability, lifecycle changes, and operational behaviour understandable while keeping data and integrations portable.",
		icon: ShieldCheck,
	},
	{
		title: "Technical excellence",
		description:
			"Compete through accurate data, reliable routing, strong compatibility, useful observability, and a developer experience that feels simple.",
		icon: Sparkles,
	},
	{
		title: "Built with everyone",
		description:
			"Give users, contributors, model creators, and providers meaningful ways to shape the platform and the standards around it.",
		icon: Handshake,
	},
] as const;

const principleKeys = [
	{ title: "broadAccess", body: "broadAccessBody" },
	{ title: "lowestPrice", body: "lowestPriceBody" },
	{ title: "openByDefault", body: "openByDefaultBody" },
	{ title: "usersFirst", body: "usersFirstBody" },
	{ title: "transparency", body: "transparencyBody" },
	{ title: "technicalExcellence", body: "technicalExcellenceBody" },
	{ title: "builtWithEveryone", body: "builtWithEveryoneBody" },
] as const;

const measures = [
	"Models, providers, modalities, and regions covered",
	"Routes available through more than one provider",
	"Price reductions and efficiency gains delivered to users",
	"Gateway reliability, latency, and Phaseo overhead",
	"Open-source contributors and community-led improvements",
	"Time taken to publish releases, corrections, and lifecycle changes",
] as const;

export default function MissionPage() {
	const t = useTranslations("Site.mission");
	return (
		<main className="relative min-h-screen overflow-hidden">
			<div className="mx-4 px-2 py-12 sm:mx-6 sm:px-0 sm:py-16 lg:mx-8 xl:mx-10 2xl:mx-auto 2xl:max-w-[1460px]">
				<section className="space-y-7 animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="secondary" className="text-[11px]">
							{t("title")}
						</Badge>
						<Badge variant="outline" className="text-[11px]">
							Open Source
						</Badge>
						<Badge variant="outline" className="text-[11px]">
							User First
						</Badge>
					</div>

					<h1 className="max-w-5xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
						{t("title")}
					</h1>

					<p className="max-w-3xl text-base leading-7 text-muted-foreground">
						{t("intro")}
					</p>

					<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
						<Button asChild className="h-10">
							<Link href="/models">
								{t("exploreModels")}
								<ArrowRight className="ml-2 h-4 w-4" />
							</Link>
						</Button>
						<Button asChild variant="outline" className="h-10">
							<Link href="https://github.com/phaseoteam/Phaseo" target="_blank" rel="noopener noreferrer">
								{t("viewSource")}
								<ArrowRight className="ml-2 h-4 w-4" />
							</Link>
						</Button>
						<Button asChild variant="ghost" className="h-10 sm:px-3">
							<Link href="/roadmap">{t("roadmap")}</Link>
						</Button>
					</div>
				</section>

				<div className="my-10 sm:my-12">
					<Separator className="bg-zinc-200/70 dark:bg-zinc-800/70" />
				</div>

				<section className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-start animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
					<SectionTitle
						eyebrow="Why Phaseo Exists"
						title="AI access should not require choosing a permanent gatekeeper."
						description="The model ecosystem is fragmented across laboratories, inference providers, clouds, prices, interfaces, and policies. Phaseo exists to make that complexity understandable and usable without hiding it behind another closed platform."
					/>

					<Card className="border-zinc-200/70 bg-white/75 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950/60">
						<CardHeader>
							<CardTitle className="text-lg">What success means</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
							<p>
								We want to build the best possible gateway with the people who use it. Success means people can reach the right model, through the right provider, at a fair price, with a clear understanding of what happened.
							</p>
							<p>
								We will also consider the mission successful when Phaseo&apos;s open-source work, public data, or standards help other products make AI more accessible, even when a request never passes through Phaseo.
							</p>
						</CardContent>
					</Card>
				</section>

				<div className="my-10 sm:my-12">
					<Separator className="bg-zinc-200/70 dark:bg-zinc-800/70" />
				</div>

				<section className="space-y-7 animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
					<SectionTitle
						eyebrow={t("principles")}
						title={t("principlesTitle")}
						description={t("principlesDescription")}
					/>

					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{principles.map((principle, index) => {
							const Icon = principle.icon;
							return (
								<Card
									key={principle.title}
									className={`border-zinc-200/70 bg-white/75 dark:border-zinc-800/70 dark:bg-zinc-950/60 ${
										index === principles.length - 1 ? "md:col-span-2 xl:col-span-3" : ""
									}`}
								>
									<CardHeader className="space-y-3">
										<div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200/70 bg-white dark:border-zinc-800/70 dark:bg-zinc-950">
											<Icon className="h-4 w-4 text-foreground" />
										</div>
										<CardTitle className="text-base">{t(principleKeys[index].title)}</CardTitle>
										<p className="text-sm leading-6 text-muted-foreground">{t(principleKeys[index].body)}</p>
									</CardHeader>
								</Card>
							);
						})}
					</div>
				</section>

				<div className="my-10 sm:my-12">
					<Separator className="bg-zinc-200/70 dark:bg-zinc-800/70" />
				</div>

				<section className="space-y-7 animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
					<SectionTitle
						eyebrow="Independent by Design"
						title="A sustainable business that remains accountable to its users."
						description="Phaseo is not being built around conventional venture capital or pressure to maximise investor returns."
					/>

					<div className="grid gap-4 lg:grid-cols-3">
						<Card className="border-zinc-200/70 bg-white/75 dark:border-zinc-800/70 dark:bg-zinc-950/60">
							<CardHeader className="space-y-2">
								<CardTitle className="text-base">No planned VC dependency</CardTitle>
								<p className="text-sm leading-6 text-muted-foreground">
									Phaseo does not plan to pursue conventional venture capital. We want to grow through sustainable revenue, careful spending, and a product people choose because it serves them well.
								</p>
							</CardHeader>
						</Card>

						<Card className="border-zinc-200/70 bg-white/75 dark:border-zinc-800/70 dark:bg-zinc-950/60">
							<CardHeader className="space-y-2">
								<CardTitle className="text-base">Revenue serves the product</CardTitle>
								<p className="text-sm leading-6 text-muted-foreground">
									Revenue matters because Phaseo must remain reliable and keep improving. It is a way to sustain the mission, not a reason to compromise fair pricing, openness, or the user experience.
								</p>
							</CardHeader>
						</Card>

						<Card className="border-zinc-200/70 bg-white/75 dark:border-zinc-800/70 dark:bg-zinc-950/60">
							<CardHeader className="space-y-2">
								<CardTitle className="text-base">Mission-aligned financing only</CardTitle>
								<p className="text-sm leading-6 text-muted-foreground">
									If financing is ever considered, it must preserve Phaseo&apos;s independence, open-source commitment, fair treatment of users, and freedom to make long-term product decisions.
								</p>
							</CardHeader>
						</Card>
					</div>
				</section>

				<div className="my-10 sm:my-12">
					<Separator className="bg-zinc-200/70 dark:bg-zinc-800/70" />
				</div>

				<section className="grid gap-6 lg:grid-cols-[1fr_0.92fr] lg:items-start animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
					<div className="space-y-6">
						<SectionTitle
							eyebrow="Working With Partners"
							title="Lower prices require cooperation across the whole service."
							description="Phaseo relies on an ecosystem of model creators, inference providers, cloud and network platforms, deployment hosts, data services, observability tools, and payment providers to operate every day."
						/>

						<div className="space-y-4 text-sm leading-6 text-muted-foreground">
							<p>
								We want to work directly with these operational and infrastructure partners to reduce the cost of inference, compute, delivery, storage, observability, and payments while improving reliability.
							</p>
							<p>
								Better commercial terms, shared technical work, credits, more efficient software, and smarter routing can all lower the cost of serving a request. We intend to use those gains to make Phaseo cheaper and better for its users.
							</p>
						</div>
					</div>

					<Card className="border-zinc-200/70 bg-white/75 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950/60">
						<CardHeader className="space-y-2">
							<div className="flex items-center gap-2 text-sm font-semibold text-foreground">
								<Route className="h-4 w-4" />
								The partnership test
							</div>
							<p className="text-sm leading-6 text-muted-foreground">
								A partnership should improve at least one of price, access, reliability, privacy, portability, or developer experience without undermining the others.
							</p>
						</CardHeader>
						<CardContent>
							<Button asChild variant="outline" className="w-full justify-between">
								<Link href="/contact">
									Work with Phaseo
									<ArrowRight className="h-4 w-4" />
								</Link>
							</Button>
						</CardContent>
					</Card>
				</section>

				<div className="my-10 sm:my-12">
					<Separator className="bg-zinc-200/70 dark:bg-zinc-800/70" />
				</div>

				<section className="space-y-7 animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
					<SectionTitle
						eyebrow="Measuring Progress"
						title="A mission should be visible in the product."
						description="We intend to judge progress using evidence that users can see, question, and help improve."
					/>

					<Card className="border-zinc-200/70 bg-white/75 dark:border-zinc-800/70 dark:bg-zinc-950/60">
						<CardContent className="grid gap-3 p-5 md:grid-cols-2">
							{measures.map((measure) => (
								<div key={measure} className="flex items-start gap-3 rounded-lg border border-zinc-200/70 p-3 dark:border-zinc-800/70">
									<LineChart className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
									<span className="text-sm leading-6 text-muted-foreground">{measure}</span>
								</div>
							))}
						</CardContent>
					</Card>
				</section>

				<div className="my-10 sm:my-12">
					<Separator className="bg-zinc-200/70 dark:bg-zinc-800/70" />
				</div>

				<section className="rounded-2xl border border-zinc-200/70 bg-white/75 p-6 dark:border-zinc-800/70 dark:bg-zinc-950/60 sm:p-8 animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
					<div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
						<div className="space-y-2">
							<h2 className="text-2xl font-semibold tracking-tight text-foreground">Built in public, improved together.</h2>
							<p className="max-w-3xl text-sm leading-6 text-muted-foreground">
								This mission is a living commitment. If Phaseo falls short, open an issue, propose a change, or help us build the better version.
							</p>
						</div>
						<div className="flex flex-col gap-3 sm:flex-row">
							<Button asChild>
								<Link href="https://github.com/phaseoteam/Phaseo/issues" target="_blank" rel="noopener noreferrer">
									Open an issue
									<ArrowRight className="ml-2 h-4 w-4" />
								</Link>
							</Button>
							<Button asChild variant="outline">
								<Link href="/about">About Phaseo</Link>
							</Button>
						</div>
					</div>
				</section>
			</div>
		</main>
	);
}
