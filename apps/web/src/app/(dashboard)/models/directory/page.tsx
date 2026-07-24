import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { fetchFrontendModels } from "@/lib/fetchers/frontend/fetchPublicCatalog";
import { buildMetadata } from "@/lib/seo";
import { getModelPath } from "@/components/(data)/model/model-route-helpers";

const MODELS_PER_PAGE = 100;

type DirectorySearchParams = Promise<{ page?: string | string[] }>;

function parsePage(value: string | string[] | undefined): number {
	const rawValue = Array.isArray(value) ? value[0] : value;
	if (!rawValue) return 1;
	const parsed = Number(rawValue);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function getDirectoryPath(page: number): string {
	return page <= 1 ? "/models/directory" : `/models/directory?page=${page}`;
}

export async function generateMetadata({
	searchParams,
}: {
	searchParams: DirectorySearchParams;
}): Promise<Metadata> {
	const page = parsePage((await searchParams).page);
	const pageLabel = page > 1 ? ` - Page ${page}` : "";

	return buildMetadata({
		title: `AI Model Directory${pageLabel}`,
		description:
			"Browse Phaseo's complete alphabetical AI model directory, with direct links to model pricing, benchmark results, providers, latency signals, and specifications.",
		path: getDirectoryPath(Math.max(page, 1)),
		keywords: [
			"AI model directory",
			"AI models",
			"model pricing",
			"model benchmarks",
		],
		robots: { index: true, follow: true },
	});
}

export default async function ModelDirectoryPage({
	searchParams,
}: {
	searchParams: DirectorySearchParams;
}) {
	const requestedPage = parsePage((await searchParams).page);
	if (requestedPage === 0) notFound();
	if (requestedPage === 1 && (await searchParams).page) {
		permanentRedirect("/models/directory");
	}

	const models = (await fetchFrontendModels()).sort((left, right) => {
		const organisationComparison = (left.organisation_name ?? left.organisation_id)
			.localeCompare(right.organisation_name ?? right.organisation_id);
		if (organisationComparison !== 0) return organisationComparison;
		return (left.name ?? left.model_id).localeCompare(right.name ?? right.model_id);
	});
	const pageCount = Math.max(1, Math.ceil(models.length / MODELS_PER_PAGE));
	if (requestedPage > pageCount) notFound();

	const startIndex = (requestedPage - 1) * MODELS_PER_PAGE;
	const pageModels = models.slice(startIndex, startIndex + MODELS_PER_PAGE);

	return (
		<main className="container mx-auto max-w-6xl px-4 py-8">
			<div className="max-w-3xl">
				<p className="text-sm font-medium text-muted-foreground">Model database</p>
				<h1 className="mt-1 text-3xl font-bold tracking-tight">
					AI Model Directory
				</h1>
				<p className="mt-3 text-muted-foreground">
					Browse every public model profile on Phaseo. Each profile links to the
					available pricing, providers, benchmark results, performance signals,
					and specifications for that model.
				</p>
			</div>

			<div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-y py-3 text-sm text-muted-foreground">
				<span>
					Showing {(startIndex + 1).toLocaleString()}-
					{Math.min(startIndex + MODELS_PER_PAGE, models.length).toLocaleString()} of{" "}
					{models.length.toLocaleString()} models
				</span>
				<Link href="/models" className="font-medium text-foreground underline underline-offset-4">
					Open the searchable model catalogue
				</Link>
			</div>

			<ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{pageModels.map((model) => {
					const organisationName = model.organisation_name ?? model.organisation_id;
					return (
						<li key={model.model_id} className="rounded-xl border bg-card p-4">
							<Link
								href={getModelPath(model.model_id)}
								className="font-semibold text-foreground underline decoration-transparent underline-offset-4 hover:decoration-current"
							>
								{model.name ?? model.model_id}
							</Link>
							<div className="mt-1 text-sm text-muted-foreground">
								by{" "}
								<Link
									href={`/organisations/${model.organisation_id}`}
									className="underline underline-offset-4"
								>
									{organisationName}
								</Link>
							</div>
						</li>
					);
				})}
			</ul>

			<nav aria-label="Model directory pages" className="mt-8 flex flex-wrap items-center justify-center gap-2">
				{requestedPage > 1 ? (
					<Link href={getDirectoryPath(requestedPage - 1)} className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm font-medium hover:bg-muted">
						<ChevronLeft className="h-4 w-4" /> Previous
					</Link>
				) : null}
				{Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
					<Link
						key={page}
						href={getDirectoryPath(page)}
						aria-current={page === requestedPage ? "page" : undefined}
						className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm font-medium ${
							page === requestedPage ? "bg-foreground text-background" : "hover:bg-muted"
						}`}
					>
						{page}
					</Link>
				))}
				{requestedPage < pageCount ? (
					<Link href={getDirectoryPath(requestedPage + 1)} className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm font-medium hover:bg-muted">
						Next <ChevronRight className="h-4 w-4" />
					</Link>
				) : null}
			</nav>
		</main>
	);
}
