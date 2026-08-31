import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { buildMetadata } from "@/lib/seo";
import {
	formatSupportWait,
	getSupportAvailability,
	getLondonInfo,
} from "@/lib/support/schedule";
import { ContactClient } from "@/components/contact/ContactClient";
import { fetchContactPersonalization } from "@/lib/fetchers/internal/fetchContactPersonalization";
import { getTranslations } from "next-intl/server";
import type { PublicLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale: locale as PublicLocale, namespace: "Site.contact" });
	return buildMetadata({
		title: t("title"),
		description: t("intro"),
		path: "/contact",
		keywords: ["Phaseo support", "contact Phaseo", "AI gateway support", "AI model database help"],
	});
}

function getTawkConfig() {
	return {
		tawkPropertyId:
			process.env.TAWK_PROPERTY_ID ?? process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID,
		tawkWidgetId:
			process.env.TAWK_WIDGET_ID ??
			process.env.NEXT_PUBLIC_TAWK_WIDGET_ID ??
			"default",
	};
}

async function ContactPersonalization() {
	await connection();

	const { isOpen, minutesUntilNextWindow } = getSupportAvailability();
	const londonInfo = getLondonInfo();
	const backOnlineLabel = formatSupportWait(minutesUntilNextWindow);
	const statusLabel = isOpen
		? "Available now"
		: backOnlineLabel
			? `Back in ${backOnlineLabel}`
			: "Outside hours";
	const statusTone = isOpen
		? "bg-emerald-500 ring-emerald-400/60"
		: "bg-amber-500 ring-amber-400/60";
	const waitText = isOpen
		? "I'm available right now. Expect a direct human reply within 30 minutes."
		: backOnlineLabel
			? `Support will be back online in ${backOnlineLabel}. Replies may be delayed, but you will still get a direct human response from me as soon as possible.`
			: "I'm away right now. Replies may be delayed, but you will still get a direct human response from me as soon as possible.";
	const personalization = await fetchContactPersonalization();
	const { tawkPropertyId, tawkWidgetId } = getTawkConfig();

	return (
		<ContactClient
			isOpen={isOpen}
			isAuthenticated={personalization.isAuthenticated}
			londonTimeLabel={londonInfo.label}
			statusLabel={statusLabel}
			statusTone={statusTone}
			waitText={waitText}
			userEmail={personalization.userEmail}
			tierLabel={personalization.tierLabel}
			defaultInternalId={personalization.defaultInternalId}
			tawkPropertyId={tawkPropertyId}
			tawkWidgetId={tawkWidgetId}
		/>
	);
}

export default function ContactPage() {
	const { tawkPropertyId, tawkWidgetId } = getTawkConfig();

	return (
		<Suspense
			fallback={
				<ContactClient
					isOpen={false}
					isAuthenticated={false}
					londonTimeLabel=""
					statusLabel="Checking availability"
					statusTone="bg-amber-500 ring-amber-400/60"
					waitText="Loading current support hours..."
					userEmail={null}
					tierLabel=""
					defaultInternalId=""
					tawkPropertyId={tawkPropertyId}
					tawkWidgetId={tawkWidgetId}
				/>
			}
		>
			<ContactPersonalization />
		</Suspense>
	);
}
