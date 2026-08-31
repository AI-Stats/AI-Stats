import { Suspense, type ReactNode } from "react";
import {
	Montserrat,
	Noto_Sans_Arabic,
	Noto_Sans_Devanagari,
	Noto_Sans_JP,
	Noto_Sans_SC,
} from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { NextIntlClientProvider } from "next-intl";
import {
	CookieConsentManager,
	type CookieConsentCopy,
} from "@/components/analytics/CookieConsentManager";
import { DeferredVercelAnalytics } from "@/components/analytics/DeferredVercelAnalytics";
import { ProductAnalyticsGaBridge } from "@/components/analytics/ProductAnalyticsGaBridge";
import { ConsoleEasterEgg } from "@/components/ConsoleEasterEgg";
import AdminDeveloperMenuLauncher from "@/components/developer-menu/AdminDeveloperMenuLauncher";
import { PublicSWRProvider } from "@/components/providers/PublicSWRProvider";
import SiteNoticeSlot from "@/components/site-notice/SiteNoticeSlot";
import { TailwindIndicator } from "@/components/tailwind-indicator";
import { ThemeProvider } from "@/components/theme-provider";
import ThemeAwareFavicon from "@/components/ThemeAwareFavicon";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { FontProfile, LocaleDirection, RuntimeLocale } from "@/i18n/routing";
import { englishMessages, type SourceMessages } from "@/i18n/default-messages";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const montserrat = Montserrat({
	display: "swap",
	subsets: ["latin", "latin-ext"],
	variable: "--font-montserrat",
});

// Script-specific families are exposed as variables and only selected by the
// locale that needs them. Disabling preload avoids downloading every writing
// system on an English request.
const notoSansArabic = Noto_Sans_Arabic({
	display: "swap",
	preload: false,
	subsets: ["arabic"],
	variable: "--font-noto-sans-arabic",
});
const notoSansDevanagari = Noto_Sans_Devanagari({
	display: "swap",
	preload: false,
	subsets: ["devanagari"],
	variable: "--font-noto-sans-devanagari",
});
const notoSansJapanese = Noto_Sans_JP({
	display: "swap",
	preload: false,
	variable: "--font-noto-sans-japanese",
});
const notoSansSimplifiedChinese = Noto_Sans_SC({
	display: "swap",
	preload: false,
	variable: "--font-noto-sans-simplified-chinese",
});

const fontVariables = cn(
	montserrat.variable,
	notoSansArabic.variable,
	notoSansDevanagari.variable,
	notoSansJapanese.variable,
	notoSansSimplifiedChinese.variable,
);

export type RootDocumentProps = {
	children: ReactNode;
	cookieConsentCopy: CookieConsentCopy;
	direction: LocaleDirection;
	fontProfile: FontProfile;
	locale: RuntimeLocale;
	messages?: SourceMessages;
};

/**
 * The complete document shell shared by Phaseo's independent root layouts.
 * Keeping the document in one component lets the localized and existing route
 * trees use identical providers while still emitting request-correct html
 * language, direction and script font attributes on the server.
 */
export function RootDocument({
	children,
	cookieConsentCopy,
	direction,
	fontProfile,
	locale,
	messages = englishMessages,
}: RootDocumentProps) {
	return (
		<html
			lang={locale}
			dir={direction}
			data-font={fontProfile}
			className={cn(fontVariables, "h-full")}
			suppressHydrationWarning
		>
			{/* eslint-disable-next-line @next/next/no-head-element -- App Router root document owns this stable, theme-mutated favicon node. */}
			<head>
				{/* The theme client mutates this exact link as the colour scheme changes. */}
				<link
					id="phaseo-favicon"
					rel="icon"
					href="/api/favicon?theme=dark"
					type="image/svg+xml"
					sizes="any"
				/>
			</head>
			<body className="min-h-screen h-full bg-background antialiased">
				<CookieConsentManager
					copy={cookieConsentCopy}
					gaMeasurementId={GA_MEASUREMENT_ID}
				/>
				<ProductAnalyticsGaBridge />
				<ConsoleEasterEgg />
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<TooltipProvider>
						<ThemeAwareFavicon />
						<Suspense fallback={null}>
							<SiteNoticeSlot />
						</Suspense>
						<Suspense fallback={null}>
							<PublicSWRProvider>
							<NuqsAdapter>
								<NextIntlClientProvider
									locale={locale}
									messages={messages}
								>
									{children}
								</NextIntlClientProvider>
							</NuqsAdapter>
							</PublicSWRProvider>
						</Suspense>
						<AdminDeveloperMenuLauncher />
						<TailwindIndicator />
						<Toaster richColors />
					</TooltipProvider>
				</ThemeProvider>
				<DeferredVercelAnalytics />
			</body>
		</html>
	);
}
