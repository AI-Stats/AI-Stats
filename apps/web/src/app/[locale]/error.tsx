"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AuthErrorCard } from "@/components/(gateway)/auth/AuthErrorCard";
import { resolveAuthLocale } from "@/lib/auth/localized-paths";

export default function LocalizedError({
	error,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const locale = resolveAuthLocale(useLocale());
	const t = useTranslations("Auth.error");

	useEffect(() => {
		// eslint-disable-next-line no-console
		console.error(error);
	}, [error]);

	return (
		<main className="flex min-h-dvh items-center justify-center px-4 py-16 sm:px-6">
			<AuthErrorCard
				heading={t("heading")}
				message={t("default")}
				backToSignInLabel={t("backToSignIn")}
				locale={locale}
			/>
		</main>
	);
}
