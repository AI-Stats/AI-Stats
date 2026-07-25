import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, RadioTower, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModelNotFoundStateProps {
	fullScreen?: boolean;
	modelId?: string;
}

export default function ModelNotFoundState({
	fullScreen = true,
	modelId,
}: ModelNotFoundStateProps) {
	const displayModelId = modelId?.trim() || "the requested model";

	return (
		<main className={fullScreen ? "flex flex-1 flex-col" : "flex flex-col"}>
			<div
				className={
					fullScreen
						? "container mx-auto flex min-h-[64vh] w-full flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-8"
						: "container mx-auto px-4 py-8"
				}
			>
				<div className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 shadow-2xl shadow-primary/5 backdrop-blur-sm">
					<div
						aria-hidden="true"
						className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,color-mix(in_oklch,var(--primary)_13%,transparent),transparent_32%),radial-gradient(circle_at_90%_85%,color-mix(in_oklch,var(--chart-2)_12%,transparent),transparent_28%)]"
					/>
					<div className="relative grid gap-0 lg:grid-cols-[0.72fr_1.28fr]">
						<div className="flex min-h-64 flex-col justify-between border-b border-border/70 bg-muted/20 p-6 sm:p-8 lg:border-b-0 lg:border-r">
							<div className="flex items-center justify-between text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
								<span>Model catalogue</span>
								<span>404</span>
							</div>
							<div className="relative mx-auto flex h-36 w-36 items-center justify-center sm:h-44 sm:w-44">
								<div className="absolute inset-0 rounded-full border border-primary/20" />
								<div className="absolute inset-5 rounded-full border border-dashed border-primary/30" />
								<div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-primary/30 bg-background/80 text-primary shadow-lg shadow-primary/10">
									<RadioTower className="h-9 w-9" strokeWidth={1.5} />
								</div>
							</div>
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_0_4px_color-mix(in_oklch,#f59e0b_15%,transparent)]" />
								Catalog sync pending
							</div>
						</div>

						<div className="p-6 sm:p-10">
							<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
								<Sparkles className="h-4 w-4" />
								Nearly there
							</div>
							<h1 className="mt-4 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
								This model is still catching up.
							</h1>
							<p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
								The link is valid, but the model has not reached Phaseo&apos;s public catalogue yet. Recent announcements can briefly arrive before the next catalogue sync completes.
							</p>

							<div className="mt-6 rounded-2xl border border-border/70 bg-background/70 p-3">
								<p className="px-2 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
									Requested identifier
								</p>
								<code className="block overflow-x-auto rounded-xl bg-muted/70 px-3 py-2.5 font-mono text-sm text-foreground">
									{displayModelId}
								</code>
							</div>

							<div className="mt-7 flex flex-wrap gap-2">
								<Button asChild>
									<Link href="/models">
										<ArrowLeft className="h-4 w-4" />
										Browse models
									</Link>
								</Button>
								<Button asChild variant="outline">
									<a href="https://discord.gg/aQyywCvgZ5" target="_blank" rel="noopener noreferrer">
										<Image src="/social/discord.svg" alt="" width={16} height={16} />
										Join Discord
									</a>
								</Button>
								<Button asChild variant="ghost">
									<a href="https://github.com/phaseoteam/Phaseo/issues/new" target="_blank" rel="noopener noreferrer">
										<Image src="/social/github_light.svg" alt="" width={16} height={16} className="dark:hidden" />
										<Image src="/social/github_dark.svg" alt="" width={16} height={16} className="hidden dark:block" />
										Suggest on GitHub
									</a>
								</Button>
							</div>
						</div>
					</div>

					<div className="relative flex flex-col gap-2 border-t border-border/70 bg-muted/10 px-6 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-10">
						<span>Model announcements land here first; catalogue availability follows shortly after.</span>
						<Link href="/contact" className="font-medium text-foreground underline-offset-4 hover:underline">
							Need help?
						</Link>
					</div>
				</div>
			</div>
		</main>
	);
}
