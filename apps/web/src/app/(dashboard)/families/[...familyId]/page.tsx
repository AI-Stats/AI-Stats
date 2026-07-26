import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
	ArrowLeft,
	ArrowUpRight,
	Building2,
	CalendarDays,
	ChevronRight,
	Layers3,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";
import type { FamilyModelItem } from "@/lib/fetchers/families/types";
import { fetchFrontendFamily } from "@/lib/fetchers/frontend/fetchPublicCatalog";
import { buildMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
	Available:
		"border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
	Announced: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
	"Limited Access":
		"border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
	Withheld:
		"border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
	Rumoured:
		"border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
	Deprecated:
		"border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
	Retired:
		"border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
	default: "border-border bg-muted/40 text-muted-foreground",
};

const monthYearFormatter = new Intl.DateTimeFormat("en", {
	month: "short",
	year: "numeric",
});

const fullDateFormatter = new Intl.DateTimeFormat("en", {
	day: "numeric",
	month: "short",
	year: "numeric",
});

function parseFamilyId(input: string[] | string | undefined): string {
	if (!input) return "";
	return Array.isArray(input) ? input.join("/") : input;
}

function getMemberDate(member: FamilyModelItem): Date | null {
	const value = member.release_date ?? member.announcement_date;
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function sortMembers(members: FamilyModelItem[]) {
	return [...members].sort((left, right) => {
		const leftDate = getMemberDate(left);
		const rightDate = getMemberDate(right);
		if (leftDate && rightDate) return leftDate.getTime() - rightDate.getTime();
		if (leftDate) return -1;
		if (rightDate) return 1;
		return left.name.localeCompare(right.name);
	});
}

function getReleaseSpan(members: FamilyModelItem[]) {
	const dates = members
		.map(getMemberDate)
		.filter((date): date is Date => Boolean(date));
	if (!dates.length) return "Dates pending";

	const first = dates[0];
	const last = dates[dates.length - 1];
	if (!first || !last) return "Dates pending";
	const firstLabel = monthYearFormatter.format(first);
	const lastLabel = monthYearFormatter.format(last);
	return firstLabel === lastLabel ? firstLabel : `${firstLabel} — ${lastLabel}`;
}

async function fetchFamily(familyId: string) {
	try {
		return await fetchFrontendFamily(familyId);
	} catch (error) {
		console.warn("[seo] failed to load family metadata", { familyId, error });
		return null;
	}
}

export async function generateMetadata(props: {
	params: Promise<{ familyId: string[] }>;
}): Promise<Metadata> {
	const { familyId: rawFamilyId } = await props.params;
	const familyId = parseFamilyId(rawFamilyId);
	const family = await fetchFamily(familyId);
	const path = `/families/${familyId}`;

	if (!family) {
		return buildMetadata({
			title: "AI Model Family",
			description:
				"Explore related AI models within the same family and follow their release history on Phaseo.",
			path,
			keywords: ["AI model family", "AI models", "Phaseo"],
		});
	}

	return buildMetadata({
		title: `${family.family_name} Family - Related AI Models`,
		description: `${family.family_name} family on Phaseo. Explore ${family.models.length} related models and their release history.`,
		path,
		keywords: [
			family.family_name,
			`${family.family_name} family`,
			"AI model family",
			"Phaseo",
		],
	});
}

export default async function Page({
	params,
}: {
	params: Promise<{ familyId: string[] }>;
}) {
	const { familyId: rawFamilyId } = await params;
	const familyId = parseFamilyId(rawFamilyId);
	const family = await fetchFrontendFamily(familyId);

	if (!family) notFound();

	const members = sortMembers(family.models ?? []);
	const primaryOrganisationId = members[0]?.organisation_id ?? null;
	const primaryOrganisationName =
		members[0]?.organisation?.name ?? primaryOrganisationId;
	const organisationCount = new Set(
		members.map((member) => member.organisation_id).filter(Boolean),
	).size;
	const availableCount = members.filter(
		(member) => member.status === "Available",
	).length;
	const releaseSpan = getReleaseSpan(members);

	return (
		<main className="min-h-screen">
			<div className="container mx-auto px-4 py-8 md:py-12">
				<Link
					href="/families"
					className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
				>
					<ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
					All model families
				</Link>

				<header className="mt-10 grid gap-8 border-b border-border/70 pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.75fr)] lg:items-end">
					<div className="flex items-start gap-5 md:gap-7">
						<div className="relative mt-1 flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background md:size-16">
							{primaryOrganisationId ? (
								<div className="relative size-9 md:size-10">
									<Logo
										id={primaryOrganisationId}
										alt={primaryOrganisationName ?? family.family_name}
										fill
										className="object-contain"
									/>
								</div>
							) : (
								<Layers3 className="size-7 text-muted-foreground" />
							)}
						</div>
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Model family
							</p>
							<h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
								{family.family_name}
							</h1>
							<p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
								Follow the releases in this family from earliest launch to latest variant.
							</p>
							{primaryOrganisationId ? (
								<Link
									href={`/organisations/${primaryOrganisationId}`}
									className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
								>
									By {primaryOrganisationName}
									<ArrowUpRight className="size-3.5" />
								</Link>
							) : null}
						</div>
					</div>

					<dl className="grid grid-cols-2 border-y border-border/70 lg:border-y-0">
						{[
							{ label: "Models", value: String(members.length) },
							{ label: "Available", value: String(availableCount) },
							{ label: "Creators", value: String(organisationCount) },
							{ label: "Release span", value: releaseSpan },
						].map((stat) => (
							<div
								key={stat.label}
								className="border-b border-r border-border/70 px-4 py-4 even:border-r-0 [&:nth-child(n+3)]:border-b-0 lg:first:pl-0"
							>
								<dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
									{stat.label}
								</dt>
								<dd className="mt-2 text-sm font-semibold text-foreground">
									{stat.value}
								</dd>
							</div>
						))}
					</dl>
				</header>

				<section className="py-10 md:py-14" aria-labelledby="family-members-heading">
					<div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Release history
							</p>
							<h2
								id="family-members-heading"
								className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl"
							>
								Family members
							</h2>
						</div>
						<p className="text-sm text-muted-foreground">Oldest to newest</p>
					</div>

					{members.length ? (
						<ol className="border-y border-border/70 divide-y divide-border/70">
							{members.map((member, index) => {
								const date = getMemberDate(member);
								const organisationName =
									member.organisation?.name ?? member.organisation_id;
								const statusClass =
									STATUS_STYLES[member.status ?? "default"] ??
									STATUS_STYLES.default;

								return (
									<li key={member.model_id}>
										<Link
											href={`/models/${member.model_id}`}
											className="group grid gap-5 py-6 transition-colors hover:bg-muted/25 sm:grid-cols-[64px_minmax(0,1fr)_180px_150px_24px] sm:items-center sm:px-3 md:py-7"
										>
											<span className="font-mono text-sm text-muted-foreground">
												{String(index + 1).padStart(2, "0")}
											</span>
											<div className="min-w-0">
												<h3 className="text-lg font-semibold tracking-tight transition-colors group-hover:text-primary md:text-xl">
													{member.name}
												</h3>
												<p className="mt-1 text-sm text-muted-foreground">
													{organisationName}
												</p>
											</div>
											<div className="flex items-center gap-2 text-sm text-muted-foreground">
												<CalendarDays className="size-4" />
												{date ? fullDateFormatter.format(date) : "Date pending"}
											</div>
											<div>
												<Badge
													variant="outline"
													className={cn("rounded-full", statusClass)}
												>
													{member.status ?? "Status pending"}
												</Badge>
											</div>
											<ChevronRight className="hidden size-5 text-muted-foreground transition-transform group-hover:translate-x-1 sm:block" />
										</Link>
									</li>
								);
							})}
						</ol>
					) : (
						<div className="border-y border-dashed border-border/70 py-14 text-center">
							<Layers3 className="mx-auto size-6 text-muted-foreground" />
							<p className="mt-3 text-sm text-muted-foreground">
								No family members are recorded yet.
							</p>
						</div>
					)}
				</section>

				<footer className="flex flex-col gap-5 border-t border-border/70 py-8 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-start gap-3">
						<Building2 className="mt-0.5 size-5 text-muted-foreground" />
						<div>
							<p className="font-medium">Missing a model from this family?</p>
							<p className="mt-1 text-sm text-muted-foreground">
								Help us keep the release history complete.
							</p>
						</div>
					</div>
					<a
						href="https://github.com/phaseoteam/Phaseo/discussions/new"
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1.5 text-sm font-medium underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
					>
						Suggest an update
						<ArrowUpRight className="size-3.5" />
					</a>
				</footer>
			</div>
		</main>
	);
}
