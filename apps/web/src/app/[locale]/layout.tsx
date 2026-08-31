import "../globals.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { RootDocument } from "@/components/layout/RootDocument";
import { getPublicMessages } from "@/i18n/messages";
import {
	getLocaleDefinition,
	isPublicLocale,
	publicLocales,
	type PublicLocale,
} from "@/i18n/routing";
import { buildLocalizedRootMetadata } from "@/lib/rootMetadata";

export function generateStaticParams() {
	return publicLocales.map((locale) => ({ locale }));
}

async function getValidatedLocale(
	params: LayoutProps<"/[locale]">["params"],
): Promise<PublicLocale> {
	const { locale } = await params;
	if (!isPublicLocale(locale)) notFound();
	return locale;
}

export async function generateMetadata({
	params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
	return buildLocalizedRootMetadata(await getValidatedLocale(params));
}

export default async function LocaleRootLayout({
	children,
	params,
}: LayoutProps<"/[locale]">) {
	const locale = await getValidatedLocale(params);
	const definition = getLocaleDefinition(locale);
	const messages = await getPublicMessages(locale);

	// Enables static rendering for the locale samples returned above while the
	// request configuration remains authoritative for next-intl server APIs.
	setRequestLocale(locale);

	return (
		<RootDocument
			cookieConsentCopy={messages.CookieConsent}
			locale={locale}
			direction={definition.dir}
			fontProfile={definition.font}
			messages={messages}
		>
			{children}
		</RootDocument>
	);
}
