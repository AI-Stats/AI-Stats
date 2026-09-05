"use client";

import { ErrorState } from "@/components/ErrorState";
import { ErrorReporter } from "@/components/ErrorReporter";

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<main className="flex min-h-dvh items-center justify-center px-4 py-16 sm:px-6">
			<ErrorReporter error={error} source="root" />
			<div className="-translate-y-16">
				<ErrorState error={error} reset={reset} />
			</div>
		</main>
	);
}
