import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
	ArrowUpRight,
	Check,
	CircleDot,
	CloudCog,
	Database,
	FileWarning,
	Fingerprint,
	KeyRound,
	LockKeyhole,
	Radar,
	Scale,
	ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildMetadata } from "@/lib/seo";
import {
	dataPractices,
	deliberatelyUnclaimed,
	disclosedServiceProviders,
	trustPractices,
	trustStates,
	type TrustState,
} from "@/lib/trust-centre";

export const metadata: Metadata = buildMetadata({
	title: "Trust Centre",
	description:
		"Phaseo's current security, privacy, data-handling, availability, and compliance posture—clearly separated from planned or independently certified work.",
	path: "/trust",
	keywords: ["Phaseo security", "Phaseo trust centre", "Phaseo privacy", "Phaseo subprocessors"],
});

const stateStyles: Record<TrustState, string> = {
	available: "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
	gated: "border-amber-500/25 bg-amber-500/8 text-amber-700 dark:text-amber-300",
	"self-attested": "border-sky-500/25 bg-sky-500/8 text-sky-700 dark:text-sky-300",
	planned: "border-violet-500/25 bg-violet-500/8 text-violet-700 dark:text-violet-300",
	"independently-certified": "border-zinc-500/25 bg-zinc-500/8 text-zinc-700 dark:text-zinc-300",
};

const stateLabels = new Map(trustStates.map((state) => [state.id, state.label]));

function StateBadge({ state }: { state: TrustState }) {
	return (
		<Badge variant="outline" className={stateStyles[state]}>
			{stateLabels.get(state)}
		</Badge>
	);
}

function PracticeList({ items }: { items: typeof trustPractices }) {
	return (
		<div className="divide-y divide-border/70 border-y border-border/70">
			{items.map((item) => (
				<article key={item.title} className="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
					<div>
						<h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
						<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{item.description}</p>
					</div>
					<StateBadge state={item.state} />
				</article>
			))}
		</div>
	);
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
	return (
		<Link href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline decoration-border underline-offset-4 hover:decoration-foreground">
			{children}<ArrowUpRight className="size-3.5" />
		</Link>
	);
}

export default function TrustCentrePage() {
	return (
		<main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_80%_8%,color-mix(in_oklab,var(--color-emerald-500)_8%,transparent),transparent_28%)]">
			<div className="mx-auto w-full max-w-[1280px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
				<header className="grid gap-10 border-b border-border/70 pb-12 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-end">
					<div className="max-w-3xl">
						<div className="mb-6 flex items-center gap-2 text-xs font-medium text-muted-foreground">
							<ShieldCheck className="size-4 text-emerald-600" /> Phaseo Trust Centre
						</div>
						<h1 className="text-balance text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-6xl">
							Trust is a record of what is true now.
						</h1>
						<p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
							A plain account of Phaseo&apos;s current security and data posture. Product capabilities, internal assertions, gated features, plans, and external certifications are labelled separately.
						</p>
					</div>
					<div className="rounded-2xl border border-border/70 bg-background/80 p-5 shadow-sm backdrop-blur">
						<div className="flex items-center justify-between gap-3">
							<span className="text-sm font-medium">Assurance level</span>
							<StateBadge state="self-attested" />
						</div>
						<p className="mt-4 text-sm leading-6 text-muted-foreground">
							Phaseo is not SOC 2 or ISO 27001 certified. The practices on this page are supported by current product code, public policies, and operating documentation, but have not been independently audited as a programme.
						</p>
						<p className="mt-4 text-xs text-muted-foreground">Reviewed 23 August 2026</p>
					</div>
				</header>

				<section aria-labelledby="legend-heading" className="py-8">
					<h2 id="legend-heading" className="sr-only">Claim labels</h2>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
						{trustStates.map((state) => (
							<div key={state.id} className="rounded-xl border border-border/60 bg-background/60 p-3">
								<StateBadge state={state.id} />
								<p className="mt-2 text-xs leading-5 text-muted-foreground">{state.description}</p>
							</div>
						))}
					</div>
				</section>

				<div className="grid gap-x-14 gap-y-16 py-10 lg:grid-cols-[13rem_minmax(0,1fr)]">
					<div>
						<LockKeyhole className="size-5 text-emerald-600" />
						<h2 className="mt-3 text-xl font-semibold tracking-tight">Security practices</h2>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">Controls we can point to without disclosing sensitive configuration.</p>
					</div>
					<PracticeList items={trustPractices} />

					<div>
						<Database className="size-5 text-sky-600" />
						<h2 className="mt-3 text-xl font-semibold tracking-tight">Data handling</h2>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">The default path, explicit exceptions, and provider boundary.</p>
					</div>
					<PracticeList items={dataPractices} />

					<div>
						<CloudCog className="size-5 text-violet-600" />
						<h2 className="mt-3 text-xl font-semibold tracking-tight">Service providers</h2>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">The categories publicly disclosed in Phaseo&apos;s privacy posture.</p>
					</div>
					<div className="overflow-hidden rounded-xl border border-border/70">
						<div className="hidden grid-cols-[11rem_13rem_1fr] gap-4 border-b bg-muted/35 px-4 py-3 text-xs font-medium text-muted-foreground sm:grid">
							<span>Provider</span><span>Purpose</span><span>Data involved</span>
						</div>
						{disclosedServiceProviders.map((provider) => (
							<div key={provider.name} className="grid gap-2 border-b border-border/70 px-4 py-4 last:border-0 sm:grid-cols-[11rem_13rem_1fr] sm:gap-4">
								<div className="text-sm font-medium">{provider.name}</div>
								<div className="text-sm text-muted-foreground">{provider.purpose}</div>
								<div className="text-sm leading-6 text-muted-foreground">{provider.data}</div>
							</div>
						))}
						<div className="border-t border-border/70 bg-muted/20 px-4 py-3 text-xs leading-5 text-muted-foreground">
							This is a concise public disclosure, not a contractual subprocessor schedule. Model providers vary by the route selected. See the <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link> for the governing description.
						</div>
					</div>

					<div>
						<Radar className="size-5 text-amber-600" />
						<h2 className="mt-3 text-xl font-semibold tracking-tight">Availability & incidents</h2>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="rounded-xl border border-border/70 p-5">
							<div className="flex items-center gap-2 text-sm font-semibold"><CircleDot className="size-4 text-emerald-600" /> Public status</div>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">Current service health and component incidents are published at <ExternalLink href="https://status.phaseo.app">status.phaseo.app</ExternalLink>.</p>
							<p className="mt-3 text-xs text-muted-foreground">No contractual public uptime SLA is claimed.</p>
						</div>
						<div className="rounded-xl border border-border/70 p-5">
							<div className="flex items-center gap-2 text-sm font-semibold"><FileWarning className="size-4 text-amber-600" /> Incident response</div>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">Operational code includes incident notification and outreach paths. Phaseo does not publish internal playbooks or claim that this process has been independently tested.</p>
							<StateBadge state="self-attested" />
						</div>
					</div>

					<div>
						<Scale className="size-5 text-rose-600" />
						<h2 className="mt-3 text-xl font-semibold tracking-tight">Compliance posture</h2>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">Clear negative claims matter as much as positive ones.</p>
					</div>
					<div>
						<div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.035] p-5">
							<div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">No independent certification today</h3><StateBadge state="planned" /></div>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">A formal assurance programme may be considered as customer need and budget justify it. No framework, auditor, scope, or completion date is committed.</p>
						</div>
						<ul className="mt-5 grid gap-3 sm:grid-cols-2">
							{deliberatelyUnclaimed.map((claim) => (
								<li key={claim} className="flex gap-3 text-sm leading-6 text-muted-foreground"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/45" />{claim}</li>
							))}
						</ul>
					</div>
				</div>

				<section className="grid gap-5 border-t border-border/70 pt-10 lg:grid-cols-[1fr_auto] lg:items-center">
					<div>
						<div className="flex items-center gap-2 text-sm font-semibold"><Fingerprint className="size-4" /> Responsible disclosure</div>
						<h2 className="mt-3 text-2xl font-semibold tracking-tight">Found something that could put users at risk?</h2>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Please report it privately. Avoid accessing other people&apos;s data, denial-of-service testing, or public disclosure before a fix is available.</p>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row">
						<Button asChild><Link href="mailto:security@phaseo.app"><KeyRound className="mr-2 size-4" />Email security</Link></Button>
						<Button asChild variant="outline"><Link href="https://github.com/phaseoteam/Phaseo/security/advisories/new" target="_blank" rel="noopener noreferrer">Private GitHub report<ArrowUpRight className="ml-2 size-4" /></Link></Button>
					</div>
				</section>

				<footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-6 text-xs text-muted-foreground">
					<div className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link><Link href="/terms" className="hover:text-foreground">Terms of Service</Link><Link href="/contact" className="hover:text-foreground">Contact support</Link></div>
					<span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> Claims reviewed against repository evidence</span>
				</footer>
			</div>
		</main>
	);
}
