import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Check, KeyRound, ShieldCheck } from "lucide-react";
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
	available: "border-emerald-600/25 bg-emerald-500/7 text-emerald-700 dark:text-emerald-300",
	gated: "border-amber-600/25 bg-amber-500/7 text-amber-700 dark:text-amber-300",
	"self-attested": "border-sky-600/25 bg-sky-500/7 text-sky-700 dark:text-sky-300",
	planned: "border-violet-600/25 bg-violet-500/7 text-violet-700 dark:text-violet-300",
	"independently-certified": "border-border bg-muted/40 text-muted-foreground",
};

const stateLabels = new Map(trustStates.map((state) => [state.id, state.label]));

function StateBadge({ state }: { state: TrustState }) {
	return <Badge variant="outline" className={`rounded-md font-normal ${stateStyles[state]}`}>{stateLabels.get(state)}</Badge>;
}

function PracticeList({ items }: { items: typeof trustPractices }) {
	return (
		<div className="border-t border-border">
			{items.map((item) => (
				<article key={item.title} className="grid gap-2 border-b border-border py-5 sm:grid-cols-[minmax(0,1fr)_9rem] sm:gap-8">
					<div>
						<h3 className="text-sm font-medium text-foreground">{item.title}</h3>
						<p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{item.description}</p>
					</div>
					<div className="sm:text-right"><StateBadge state={item.state} /></div>
				</article>
			))}
		</div>
	);
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
	return <Link href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline decoration-border underline-offset-4 hover:decoration-foreground">{children}<ArrowUpRight className="size-3.5" /></Link>;
}

const sectionLinks = [
	["security", "Security"],
	["data", "Data handling"],
	["providers", "Service providers"],
	["availability", "Availability"],
	["compliance", "Compliance"],
	["disclosure", "Disclosure"],
] as const;

export default function TrustCentrePage() {
	return (
		<main className="min-h-screen bg-background">
			<div className="mx-auto w-full max-w-[1120px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
				<header className="border-b border-border pb-10">
					<div className="flex items-center gap-2 text-sm font-medium text-foreground"><ShieldCheck className="size-4" /> Phaseo Trust Centre</div>
					<div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-end">
						<div>
							<h1 className="max-w-2xl text-balance text-4xl font-semibold tracking-[-0.035em] text-foreground sm:text-5xl">Security and trust at Phaseo</h1>
							<p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">Current product safeguards, data practices, and assurance status. Claims on this page are limited to what Phaseo can support today.</p>
						</div>
						<dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-l border-border pl-5 text-sm lg:grid-cols-1">
							<div><dt className="text-xs text-muted-foreground">Assurance</dt><dd className="mt-1"><StateBadge state="self-attested" /></dd></div>
							<div><dt className="text-xs text-muted-foreground">Last reviewed</dt><dd className="mt-1 font-medium">23 August 2026</dd></div>
						</dl>
					</div>
				</header>

				<div className="grid gap-12 pt-10 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-16">
					<aside className="lg:sticky lg:top-24 lg:self-start">
						<nav aria-label="Trust Centre sections" className="border-l border-border">
							{sectionLinks.map(([id, label]) => <Link key={id} href={`#${id}`} className="block border-l border-transparent py-1.5 pl-4 text-sm text-muted-foreground hover:border-foreground hover:text-foreground">{label}</Link>)}
						</nav>
						<div className="mt-8 border-t border-border pt-5">
							<h2 className="text-xs font-medium text-foreground">Claim labels</h2>
							<dl className="mt-3 space-y-3">
								{trustStates.map((state) => <div key={state.id}><dt><StateBadge state={state.id} /></dt><dd className="mt-1 text-xs leading-5 text-muted-foreground">{state.description}</dd></div>)}
							</dl>
							<p className="mt-5 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">Phaseo is not SOC 2 or ISO 27001 certified. Its security programme has not been independently audited.</p>
						</div>
					</aside>

					<div className="min-w-0 space-y-16">
						<section id="security" className="scroll-mt-24">
							<h2 className="text-xl font-semibold tracking-tight">Security</h2>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">Product and operational safeguards supported by current code and documentation.</p>
							<div className="mt-6"><PracticeList items={trustPractices} /></div>
						</section>

						<section id="data" className="scroll-mt-24">
							<h2 className="text-xl font-semibold tracking-tight">Data handling</h2>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">How gateway content is handled by default, where exceptions apply, and what remains provider-dependent.</p>
							<div className="mt-6"><PracticeList items={dataPractices} /></div>
						</section>

						<section id="providers" className="scroll-mt-24">
							<h2 className="text-xl font-semibold tracking-tight">Service providers</h2>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">Categories disclosed in Phaseo&apos;s current privacy policy.</p>
							<div className="mt-6 overflow-x-auto border-y border-border">
								<table className="w-full min-w-[640px] table-fixed text-left">
									<colgroup><col className="w-40" /><col className="w-48" /><col /></colgroup>
									<thead><tr className="border-b border-border text-xs font-medium text-muted-foreground"><th scope="col" className="py-3 pr-4 font-medium">Provider</th><th scope="col" className="py-3 pr-4 font-medium">Purpose</th><th scope="col" className="py-3 font-medium">Data involved</th></tr></thead>
									<tbody>{disclosedServiceProviders.map((provider) => <tr key={provider.name} className="border-b border-border last:border-0"><th scope="row" className="py-4 pr-4 align-top text-sm font-medium">{provider.name}</th><td className="py-4 pr-4 align-top text-sm text-muted-foreground">{provider.purpose}</td><td className="py-4 align-top text-sm leading-6 text-muted-foreground">{provider.data}</td></tr>)}</tbody>
								</table>
							</div>
							<p className="mt-3 text-xs leading-5 text-muted-foreground">This is a public summary, not a contractual subprocessor schedule. Model providers vary by route. See the <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link>.</p>
						</section>

						<section id="availability" className="scroll-mt-24">
							<h2 className="text-xl font-semibold tracking-tight">Availability and incidents</h2>
							<div className="mt-6 border-y border-border">
								<div className="grid gap-2 border-b border-border py-5 sm:grid-cols-[10rem_1fr]"><h3 className="text-sm font-medium">Service status</h3><p className="text-sm leading-6 text-muted-foreground">Current health and incidents are published at <ExternalLink href="https://status.phaseo.app">status.phaseo.app</ExternalLink>. Phaseo does not claim a contractual public uptime SLA.</p></div>
								<div className="grid gap-2 py-5 sm:grid-cols-[10rem_1fr]"><h3 className="text-sm font-medium">Incident response</h3><p className="text-sm leading-6 text-muted-foreground">Operational code includes incident notification and outreach paths. Internal playbooks are not public, and the process has not been independently tested.</p></div>
							</div>
						</section>

						<section id="compliance" className="scroll-mt-24">
							<h2 className="text-xl font-semibold tracking-tight">Compliance</h2>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">Phaseo does not currently hold an independent security certification. A formal assurance programme may be considered when customer need and budget justify it; no framework or date is committed.</p>
							<ul className="mt-6 border-y border-border">{deliberatelyUnclaimed.map((claim) => <li key={claim} className="flex gap-3 border-b border-border py-3 text-sm leading-6 text-muted-foreground last:border-0"><span aria-hidden="true" className="mt-2.5 size-1 shrink-0 rounded-full bg-muted-foreground" />{claim}</li>)}</ul>
						</section>

						<section id="disclosure" className="scroll-mt-24 border-t border-border pt-8">
							<h2 className="text-xl font-semibold tracking-tight">Responsible disclosure</h2>
							<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Report security issues privately. Do not access other people&apos;s data, run denial-of-service tests, or disclose a vulnerability before a fix is available.</p>
							<div className="mt-5 flex flex-col gap-2 sm:flex-row">
								<Button asChild><Link href="mailto:security@phaseo.app"><KeyRound className="mr-2 size-4" />Email security</Link></Button>
								<Button asChild variant="outline"><Link href="https://github.com/phaseoteam/Phaseo/security/advisories/new" target="_blank" rel="noopener noreferrer">Private GitHub report<ArrowUpRight className="ml-2 size-4" /></Link></Button>
							</div>
						</section>
					</div>
				</div>

				<footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground">
					<div className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link><Link href="/terms" className="hover:text-foreground">Terms of Service</Link><Link href="/contact" className="hover:text-foreground">Contact</Link></div>
					<span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> Reviewed against repository evidence</span>
				</footer>
			</div>
		</main>
	);
}
