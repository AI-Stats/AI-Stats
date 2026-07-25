"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModelNotFoundStateProps {
	modelId?: string;
}

function getModelIdFromPathname(pathname: string | null): string | null {
	if (!pathname) return null;
	const segments = pathname.split("/").filter(Boolean).slice(1, 3);
	if (segments.length !== 2) return null;
	return segments.map((segment) => decodeURIComponent(segment)).join("/");
}

export default function ModelNotFoundState({ modelId }: ModelNotFoundStateProps) {
	const pathname = usePathname();
	const requestedModelId = modelId ?? getModelIdFromPathname(pathname) ?? "the requested model";

	return (
		<main className="flex flex-1 flex-col">
			<div className="container mx-auto flex min-h-[62vh] w-full flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
				<div className="w-full max-w-2xl text-center">
					<h1 className="mx-auto max-w-2xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
						The model <code className="font-mono text-[0.9em]">{`\`${requestedModelId}\``}</code> is not available yet
					</h1>
					<p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
						Recent announcements can arrive before the public catalogue cache catches up. Try again shortly, or tell us where you found the link.
					</p>

					<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
						<Button asChild>
							<Link href="/models">
								<ArrowLeft className="h-4 w-4" />
								Browse models
							</Link>
						</Button>
					</div>

					<div className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
						<span>Request a Model</span>
						<a
							href="https://discord.gg/aQyywCvgZ5"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
						>
							<Image src="/social/discord.svg" alt="" width={15} height={15} />
							Discord
						</a>
						<a
							href="https://github.com/phaseoteam/Phaseo/issues/new"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
						>
							<Image src="/social/github_light.svg" alt="" width={15} height={15} className="dark:hidden" />
							<Image src="/social/github_dark.svg" alt="" width={15} height={15} className="hidden dark:block" />
							GitHub
						</a>
					</div>
				</div>
			</div>
		</main>
	);
}
