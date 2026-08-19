import Link from "next/link";
import { ArrowRight, BookOpen, House, Layers3, Network } from "lucide-react";
import { Button } from "@/components/ui/button";

const destinations = [
	{
		href: "/models",
		label: "Model catalogue",
		description: "Compare models, capabilities, pricing, and availability.",
		icon: Layers3,
		external: false,
	},
	{
		href: "/api-providers",
		label: "Provider directory",
		description: "Explore providers and their supported model routes.",
		icon: Network,
		external: false,
	},
	{
		href: "https://phaseo.app/docs/v1",
		label: "Documentation",
		description: "Find integration guides, SDKs, and API references.",
		icon: BookOpen,
		external: true,
	},
];

export default function NotFound() {
	return (
		<main className="relative isolate flex min-h-[calc(100dvh-3.75rem)] overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_18%_14%,color-mix(in_oklch,var(--foreground)_6%,transparent),transparent_32%),linear-gradient(to_bottom,var(--background),color-mix(in_oklch,var(--muted)_45%,var(--background)))]"
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18] [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]"
			/>

			<div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
				<section className="relative min-w-0">
					<p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
						Route not found
					</p>
					<div className="relative mt-3">
						<div
							aria-hidden="true"
							className="absolute -left-2 top-1/2 h-px w-[min(42rem,92vw)] -translate-y-1/2 bg-gradient-to-r from-transparent via-border to-transparent"
						/>
						<h1 className="relative w-fit bg-background/80 pr-5 text-[clamp(5.5rem,22vw,12rem)] font-semibold leading-[0.78] tracking-[-0.09em] text-foreground">
							404
						</h1>
					</div>
					<h2 className="mt-8 max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
						This route leads nowhere.
					</h2>
					<p className="mt-4 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
						The page may have moved or the address may be incomplete. Continue into
						the model catalogue, or return to the Phaseo home page.
					</p>
					<div className="mt-8 flex flex-col gap-3 sm:flex-row">
						<Button asChild size="lg" className="w-full sm:w-auto">
							<Link href="/models">
								Browse models
								<ArrowRight className="size-4" />
							</Link>
						</Button>
						<Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
							<Link href="/">
								<House className="size-4" />
								Return home
							</Link>
						</Button>
					</div>
				</section>

				<nav aria-label="Useful destinations" className="grid min-w-0 gap-2">
					{destinations.map((destination, index) => {
						const Icon = destination.icon;
						return (
							<Link
								key={destination.href}
								href={destination.href}
								target={destination.external ? "_blank" : undefined}
								rel={destination.external ? "noreferrer" : undefined}
								className="group grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm backdrop-blur transition-colors hover:border-foreground/25 hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:p-5"
							>
								<span className="grid size-10 place-items-center rounded-xl border bg-muted/50 text-muted-foreground transition-colors group-hover:text-foreground">
									<Icon className="size-4" aria-hidden="true" />
								</span>
								<span className="min-w-0">
									<span className="block font-medium">
										{String(index + 1).padStart(2, "0")} · {destination.label}
									</span>
									<span className="mt-1 block text-sm leading-6 text-muted-foreground">
										{destination.description}
									</span>
								</span>
								<ArrowRight
									className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
									aria-hidden="true"
								/>
							</Link>
						);
					})}
				</nav>
			</div>
		</main>
	);
}
