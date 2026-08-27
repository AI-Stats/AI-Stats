"use client";

import { useEffect } from "react";
import { ArrowLeft, RotateCw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const externalLinks = {
	github: "https://github.com/phaseoteam/Phaseo",
	discord: "https://discord.gg/aQyywCvgZ5",
};

export function ErrorState({ error, reset }: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// eslint-disable-next-line no-console
		console.error(error);
	}, [error]);

	return (
		<div className="text-center">
			<h1 className="text-xl font-semibold tracking-tight sm:text-2xl">500: Something went wrong</h1>
			<p className="mt-2 text-sm text-muted-foreground">The page hit an unexpected problem. Please try again.</p>
			<div className="mt-6 flex flex-wrap items-center justify-center gap-2">
				<Button type="button" variant="outline" className="rounded-md" onClick={reset}>
					<RotateCw className="size-4" aria-hidden="true" />
					Try Again
				</Button>
				<span className="text-sm text-muted-foreground">or</span>
				<Button asChild variant="outline" className="rounded-md">
					<Link href="/"><ArrowLeft className="size-4" aria-hidden="true" />Go Home</Link>
				</Button>
			</div>
			<div className="mt-8 border-t border-border/70 pt-5 text-sm">
				<p className="text-muted-foreground">If the problem continues, please let us know:</p>
				<div className="mt-2 flex flex-wrap justify-center gap-2">
					<Button asChild size="sm" variant="ghost" className="rounded-md">
						<Link href={externalLinks.github} target="_blank" rel="noopener noreferrer">
							<span className="inline-flex size-4 items-center justify-center">
								<Image src="/social/github_light.svg" alt="" width={16} height={16} className="block dark:hidden" />
								<Image src="/social/github_dark.svg" alt="" width={16} height={16} className="hidden dark:block" />
							</span>
							GitHub
						</Link>
					</Button>
					<Button asChild size="sm" variant="ghost" className="rounded-md">
						<Link href={externalLinks.discord} target="_blank" rel="noopener noreferrer">
							<Image src="/social/discord.svg" alt="" width={16} height={16} />
							Discord
						</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
