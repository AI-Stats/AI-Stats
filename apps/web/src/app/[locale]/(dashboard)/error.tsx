"use client";

import { ErrorState } from "@/components/ErrorState";

export default function DashboardError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<div className="flex min-h-dvh flex-none items-center justify-center px-4 py-16 sm:px-6">
			<div className="-translate-y-16">
				<ErrorState error={error} reset={reset} />
			</div>
		</div>
	);
}
