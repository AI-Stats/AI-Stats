import "./globals.css";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { RootDocument } from "@/components/layout/RootDocument";
import { englishAuthMessages } from "@/i18n/default-messages";
import { Button } from "@/components/ui/button";

export const metadata = {
	title: "Page not found",
	robots: {
		index: false,
		follow: false,
	},
};

export default function GlobalNotFound() {
	return (
		<RootDocument
			cookieConsentCopy={englishAuthMessages.CookieConsent}
			locale="en-GB"
			direction="ltr"
			fontProfile="latin"
		>
			<main className="flex min-h-dvh items-center justify-center px-4 py-16 sm:px-6">
				<div className="text-center">
					<h1 className="text-2xl font-semibold tracking-tight">
						404: Page not found
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						The page may have moved or the address may be incorrect.
					</p>
					<div className="mt-6 flex flex-wrap items-center justify-center gap-2">
						<Button asChild variant="outline">
							<Link href="/">
								<ArrowLeft className="size-4" aria-hidden="true" />
								Go home
							</Link>
						</Button>
						<Button asChild variant="outline">
							<Link href="/models">
								Browse models
								<ArrowRight className="size-4" aria-hidden="true" />
							</Link>
						</Button>
					</div>
				</div>
			</main>
		</RootDocument>
	);
}
