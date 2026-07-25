"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// eslint-disable-next-line no-console
		console.error(error);
	}, [error]);

	return (
		<main className="flex min-h-[70vh] flex-1 items-center justify-center px-4 py-16 sm:px-6">
			<div className="w-full max-w-xl text-center">
				<p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
					Phaseo / temporary error
				</p>
				<h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
					Something went wrong.
				</h1>
				<p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
					The page hit an unexpected problem. Try again, or return to the catalogue while we investigate.
				</p>

				<div className="mt-8 flex flex-wrap justify-center gap-3">
					<Button type="button" onClick={() => reset()}>
						Try again
					</Button>
					<Button asChild variant="outline">
						<Link href="/models">Browse models</Link>
					</Button>
				</div>

				<p className="mt-7 text-sm text-muted-foreground">
					Still stuck?{" "}
					<a
						href="https://discord.gg/aQyywCvgZ5"
						target="_blank"
						rel="noopener noreferrer"
						className="font-medium text-foreground underline-offset-4 hover:underline"
					>
						Contact us on Discord
					</a>
				</p>
			</div>
		</main>
	);
}
