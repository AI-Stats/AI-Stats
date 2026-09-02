import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Languages } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { AuthLocalisationPreview } from "@/components/internal/localisation/AuthLocalisationPreview";
import { Spinner } from "@/components/ui/spinner";
import { requireInternalAdmin } from "@/lib/auth/requireInternalAdmin";
import { appleAppStoreLocales } from "@/i18n/apple-locales";
import { getTypedCatalogMessages } from "@/i18n/catalogs";
import {
	catalogLocales,
	getLocaleDefinition,
	isCatalogLocale,
} from "@/i18n/routing";

type LocalisationPreviewPageProps = {
	params: Promise<{ previewLocale: string }>;
};

export const metadata: Metadata = {
	title: "Localisation preview",
	description: "Internal review surface for draft Phaseo translations.",
	robots: {
		index: false,
		follow: false,
	},
};

export function generateStaticParams(): Array<{ previewLocale: string }> {
	return catalogLocales.map((previewLocale) => ({ previewLocale }));
}

export default function LocalisationPreviewPage(
	props: LocalisationPreviewPageProps,
) {
	return (
		<Suspense
			fallback={
				<div className="grid min-h-[60vh] place-items-center">
					<Spinner className="size-5 text-muted-foreground" />
				</div>
			}
		>
			<LocalisationPreviewContent {...props} />
		</Suspense>
	);
}

async function LocalisationPreviewContent({
	params,
}: LocalisationPreviewPageProps) {
	await requireInternalAdmin("/internal");
	const { previewLocale: requestedLocale } = await params;
	if (!isCatalogLocale(requestedLocale)) notFound();

	const locale = requestedLocale;
	const definition = getLocaleDefinition(locale);
	const messages = getTypedCatalogMessages(locale);
	const appleLocaleCount = catalogLocales.filter(
		(candidate) => getLocaleDefinition(candidate).role !== "pseudo",
	).length;

	return (
		<div className="container mx-auto max-w-6xl space-y-8 px-4 py-8">
			<header className="space-y-3">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Languages className="size-4" aria-hidden="true" />
					Draft localisation preview
				</div>
				<div className="space-y-2">
					<h1 className="text-3xl font-bold">{definition.englishName}</h1>
					<p className="max-w-3xl text-muted-foreground">
						This admin-only surface renders the real auth catalogs without
						publishing localized routes. Authentication actions are disabled.
					</p>
				</div>
				<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
					<span className="rounded-full border px-2.5 py-1">
						{locale}
					</span>
					<span className="rounded-full border px-2.5 py-1">
						{definition.reviewState}
					</span>
					<span className="rounded-full border px-2.5 py-1">
						{definition.dir.toUpperCase()}
					</span>
					<span className="rounded-full border px-2.5 py-1">
						{appleLocaleCount} of {appleAppStoreLocales.length} Apple matrix locales
					</span>
				</div>
			</header>

			<nav
				aria-label="Preview locale"
				className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
			>
				{catalogLocales.map((candidate) => {
					const candidateDefinition = getLocaleDefinition(candidate);
					const selected = candidate === locale;
					return (
						<Link
							key={candidate}
							href={`/internal/localisation-preview/${candidate}`}
							aria-current={selected ? "page" : undefined}
							className={
								selected
									? "rounded-lg border border-foreground bg-foreground px-3 py-2 text-sm text-background"
									: "rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted"
							}
						>
							<bdi
								lang={candidate}
								dir={candidateDefinition.dir}
								className="font-medium"
							>
								{candidateDefinition.nativeName}
							</bdi>
							<bdi dir="ltr" className="ms-2 opacity-70">
								{candidate}
							</bdi>
						</Link>
					);
				})}
			</nav>

			<section
				lang={locale}
				dir={definition.dir}
				className="rounded-2xl border bg-muted/20 p-4 sm:p-8"
			>
				<NextIntlClientProvider locale={locale} messages={messages}>
					<AuthLocalisationPreview />
				</NextIntlClientProvider>
			</section>
		</div>
	);
}
