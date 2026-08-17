import type { Metadata } from "next";
import Link from "next/link";
import {
	ArrowRight,
	ArrowUpRight,
	Check,
	Code2,
	Heart,
	Search,
	Scale,
	Sparkles,
} from "lucide-react";

import { OrbSpecimen } from "@/components/acknowledgements/orbSpecimen";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
	title: "Acknowledgements",
	description:
		"The open-source projects, platforms, and design work that Phaseo relies on and learns from.",
	path: "/acknowledgements",
	keywords: [
		"Phaseo acknowledgements",
		"Phaseo open source",
		"AI gateway dependencies",
		"thinking orbs",
	],
});

type Acknowledgement = {
	name: string;
	description: string;
	usedFor: string;
	href: string;
	note?: string;
	demo?: "orbs" | "primitives" | "streaming" | "icons";
};

const groups: Array<{
	label: string;
	description: string;
	items: Acknowledgement[];
}> = [
	{
		label: "Interface",
		description: "The foundations behind Phaseo's web experience and interaction language.",
		items: [
			{
				name: "React",
				description: "The declarative component and state model underlying Phaseo's interactive product surfaces.",
				usedFor: "Chat, model comparison, settings, observability, and every stateful interface are composed as React components.",
				href: "https://react.dev/",
			},
			{
				name: "Next.js",
				description: "The application framework that joins server rendering, routing, metadata, caching, and client interaction.",
				usedFor: "The public catalogue, authenticated workspace, API bridges, and this page all share one App Router application.",
				href: "https://nextjs.org/",
			},
			{
				name: "Tailwind CSS",
				description: "A utility-first styling system that keeps visual decisions close to the components they affect.",
				usedFor: "Responsive layout, typography, color, motion, and dark mode are expressed through a shared set of design tokens and utilities.",
				href: "https://tailwindcss.com/",
			},
			{
				name: "shadcn/ui & Base UI",
				description: "Open component patterns and accessible headless primitives that provide strong behavior without prescribing the final visual design.",
				usedFor: "Dialogs, menus, tooltips, buttons, selectors, and keyboard interactions throughout Phaseo build on these foundations.",
				href: "https://ui.shadcn.com/",
				demo: "primitives",
			},
			{
				name: "Lucide",
				description: "A consistent, readable icon family with a broad vocabulary for product interfaces.",
				usedFor: "Icons clarify navigation, model actions, request status, settings, and compact controls where text alone would be cumbersome.",
				href: "https://lucide.dev/",
				demo: "icons",
			},
			{
				name: "Thinking Orbs",
				description: "A family of carefully tuned canvas animations that gives background work a visible state without relying on a generic spinner.",
				usedFor: "Phaseo Chat uses the working state in the send and queue control, and the composing state while an assistant is preparing a response.",
				href: "https://orbs.jakubantalik.com/",
				note: "Created by Jakub Antalík",
				demo: "orbs",
			},
		],
	},
	{
		label: "AI Experience",
		description: "Projects that help Phaseo stream, render, and explain model output.",
		items: [
			{
				name: "Streamdown",
				description: "A Markdown renderer designed for incomplete text that is still arriving token by token.",
				usedFor: "Phaseo can render headings, lists, links, code, and mathematics while a response is streaming without waiting for the final document.",
				href: "https://streamdown.ai/",
				demo: "streaming",
			},
			{
				name: "Shiki",
				description: "A TextMate-compatible syntax highlighter that renders code with editor-quality grammar support.",
				usedFor: "Code in model responses remains legible across languages and themes, including during technical comparisons and debugging.",
				href: "https://shiki.style/",
			},
		],
	},
	{
		label: "Platform",
		description: "Infrastructure and services that help Phaseo operate reliably.",
		items: [
			{
				name: "Cloudflare",
				description: "A global application platform spanning edge compute, durable coordination, storage, networking, and security.",
				usedFor: "Phaseo's gateway and supporting APIs use Workers and related services to execute close to users and coordinate long-running workloads.",
				href: "https://www.cloudflare.com/",
			},
			{
				name: "PlanetScale",
				description: "A managed Postgres platform designed for reliable, scalable production databases.",
				usedFor: "Phaseo stores account, workspace, usage, credit, and gateway configuration data in PlanetScale Postgres.",
				href: "https://planetscale.com/",
			},
			{
				name: "Better Auth",
				description: "An authentication framework for TypeScript applications.",
				usedFor: "Phaseo uses Better Auth for account sessions, social sign-in, passkeys, MFA, and enterprise SSO.",
				href: "https://better-auth.com/",
			},
			{
				name: "Vercel",
				description: "Deployment and application infrastructure optimized for Next.js and modern web delivery.",
				usedFor: "The Phaseo website is built, previewed, and served through Vercel while private APIs connect to the wider platform.",
				href: "https://vercel.com/",
			},
			{
				name: "Hono",
				description: "A small, standards-based web framework designed for modern JavaScript runtimes.",
				usedFor: "It provides routing, middleware, and typed request handling across Phaseo's Cloudflare Workers APIs.",
				href: "https://hono.dev/",
			},
			{
				name: "Stripe",
				description: "Payment infrastructure for secure checkout, payment methods, invoices, and billing events.",
				usedFor: "Stripe handles the financial transaction layer when customers purchase and manage Phaseo credits.",
				href: "https://stripe.com/",
			},
		],
	},
	{
		label: "Product Intelligence",
		description: "Tools that help us understand releases, reliability, and product behavior.",
		items: [
			{
				name: "PostHog",
				description: "An open product analytics platform covering events, funnels, session diagnostics, and feature behavior.",
				usedFor: "Phaseo uses measured product signals to understand reliability and improve flows without treating intuition as evidence.",
				href: "https://posthog.com/",
			},
			{
				name: "Statsig",
				description: "A feature-management and experimentation platform for controlled product delivery.",
				usedFor: "Feature gates let Phaseo introduce changes gradually, compare outcomes, and recover quickly when a rollout behaves unexpectedly.",
				href: "https://www.statsig.com/",
			},
		],
	},
];

function Demo({ type }: { type: NonNullable<Acknowledgement["demo"]> }) {
	if (type === "orbs") return <OrbSpecimen />;
	if (type === "primitives") {
		return (
			<div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
				<Button size="sm">Continue</Button>
				<Button size="sm" variant="outline">Review</Button>
				<Button size="icon-sm" variant="ghost" aria-label="Search example"><Search /></Button>
				<span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
					<Check className="h-3 w-3" /> Accessible states
				</span>
			</div>
		);
	}
	if (type === "icons") {
		return (
			<div className="flex items-center gap-5 rounded-xl border border-zinc-200/80 bg-zinc-50 px-5 py-4 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
				<Search className="h-5 w-5" aria-label="Search" />
				<Sparkles className="h-5 w-5" aria-label="Sparkles" />
				<Code2 className="h-5 w-5" aria-label="Code" />
				<ArrowRight className="h-5 w-5" aria-label="Arrow right" />
			</div>
		);
	}
	return (
		<div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-950 p-4 font-mono text-xs leading-6 dark:border-zinc-800">
			<p className="text-zinc-500">Streaming response</p>
			<p className="text-zinc-100"><span className="text-emerald-400">##</span> A reliable gateway</p>
			<p className="text-zinc-300">Route by health, price, and capability<span className="ml-0.5 inline-block h-3.5 w-1 animate-pulse bg-zinc-400 align-middle" /></p>
		</div>
	);
}

function AcknowledgementRow({ item }: { item: Acknowledgement }) {
	return (
		<li className="group grid gap-4 py-7 sm:grid-cols-[minmax(10rem,0.36fr)_minmax(0,1fr)] sm:items-start sm:gap-8">
			<div>
				<Link
					href={item.href}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
				>
					{item.name}
					<ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
				</Link>
				{item.note ? (
					<p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.note}</p>
				) : null}
			</div>
			<div className="max-w-3xl space-y-3">
				<p className="text-sm leading-6 text-foreground/85">{item.description}</p>
				<p className="text-sm leading-6 text-muted-foreground">
					<span className="font-medium text-foreground">How Phaseo uses it.</span>{" "}{item.usedFor}
				</p>
				{item.demo ? <div className="pt-2"><Demo type={item.demo} /></div> : null}
			</div>
		</li>
	);
}

export default function AcknowledgementsPage() {
	return (
		<div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
			<header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
				<div className="space-y-5">
					<h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
						Built with the work of many.
					</h1>
					<p className="max-w-3xl text-base leading-7 text-muted-foreground">
						Phaseo stands on open-source software, thoughtful design work, and dependable infrastructure. This page recognizes the projects and teams that materially shape what we build.
					</p>
				</div>
				<div className="border-l border-zinc-200 pl-5 text-sm leading-6 text-muted-foreground dark:border-zinc-800">
					<Heart className="mb-3 h-5 w-5 text-foreground" />
					Thank you to every maintainer, contributor, researcher, and designer whose work makes Phaseo possible.
				</div>
			</header>

			<Separator className="my-10 bg-zinc-200/70 dark:bg-zinc-800/70" />

			<div className="space-y-10">
				{groups.map((group) => (
					<section key={group.label} aria-labelledby={`group-${group.label.replaceAll(" ", "-").toLowerCase()}`}>
						<div className="grid gap-2 border-b border-zinc-200/80 pb-4 dark:border-zinc-800 sm:grid-cols-[minmax(10rem,0.36fr)_minmax(0,1fr)] sm:gap-8">
							<h2 id={`group-${group.label.replaceAll(" ", "-").toLowerCase()}`} className="text-lg font-semibold text-foreground">
								{group.label}
							</h2>
							<p className="max-w-2xl text-sm leading-6 text-muted-foreground">{group.description}</p>
						</div>
						<ul className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
							{group.items.map((item) => (
								<AcknowledgementRow key={item.name} item={item} />
							))}
						</ul>
					</section>
				))}
			</div>

			<div className="mt-12 flex items-start gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50 p-5 text-sm leading-6 text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900/40">
				<Scale className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
				<p>
					This is a maintained product acknowledgement, not an exhaustive software bill of materials or license notice. Package-level copyright and license terms remain with their respective projects.
				</p>
			</div>
		</div>
	);
}
