"use client";

import { ErrorReporter } from "@/components/ErrorReporter";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<html lang="en">
			<body>
				<ErrorReporter error={error} source="global" />
				<main className="flex min-h-dvh items-center justify-center px-6 text-center">
					<div>
						<h1 className="text-2xl font-semibold">Something went wrong</h1>
						<p className="mt-2 text-sm text-zinc-600">Please try again.</p>
						<button className="mt-6 rounded-md bg-black px-4 py-2 text-sm text-white" onClick={reset} type="button">
							Try again
						</button>
					</div>
				</main>
			</body>
		</html>
	);
}
