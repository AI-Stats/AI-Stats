"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CatalogResourceType = "model" | "organisation" | "country" | "provider";

const resourceConfig: Record<
	CatalogResourceType,
	{
		articleNoun: string;
		browseHref: string;
		browseLabel: string;
		requestLabel: string;
		description: string;
		pathSegments: number;
	}
> = {
	model: {
		articleNoun: "model",
		browseHref: "/models",
		browseLabel: "Browse models",
		requestLabel: "Request a Model",
		description:
			"Recent announcements can arrive before the public catalogue cache catches up. Try again shortly, or tell us where you found the link.",
		pathSegments: 2,
	},
	organisation: {
		articleNoun: "organisation",
		browseHref: "/organisations",
		browseLabel: "Browse organisations",
		requestLabel: "Request an Organisation",
		description:
			"New labs and organisations can arrive before their public profile is available. Try again shortly, or tell us where you found the link.",
		pathSegments: 1,
	},
	country: {
		articleNoun: "country",
		browseHref: "/countries",
		browseLabel: "Browse countries",
		requestLabel: "Request a Country",
		description:
			"Country coverage is still expanding. Try again shortly, or tell us which AI ecosystem you would like to see tracked.",
		pathSegments: 1,
	},
	provider: {
		articleNoun: "API provider",
		browseHref: "/api-providers",
		browseLabel: "Browse providers",
		requestLabel: "Request a Provider",
		description:
			"Provider coverage can arrive after a model or route is announced. Try again shortly, or tell us where you found the link.",
		pathSegments: 1,
	},
};

function getResourceIdFromPathname(
	pathname: string | null,
	resourceType: CatalogResourceType,
): string | null {
	if (!pathname) return null;
	const segments = pathname.split("/").filter(Boolean);
	const config = resourceConfig[resourceType];
	const resourceIndex = segments.findIndex((segment) =>
		(resourceType === "model" && segment === "models") ||
		(resourceType === "organisation" && segment === "organisations") ||
		(resourceType === "country" && segment === "countries") ||
		(resourceType === "provider" && segment === "api-providers"),
	);
	if (resourceIndex === -1) return null;
	const resourceId = segments.slice(resourceIndex + 1, resourceIndex + 1 + config.pathSegments);
	if (resourceId.length !== config.pathSegments) return null;
	return resourceId.map((segment) => decodeURIComponent(segment)).join("/");
}

export default function CatalogNotFoundState({
	resourceType,
	resourceId,
}: {
	resourceType: CatalogResourceType;
	resourceId?: string;
}) {
	const pathname = usePathname();
	const config = resourceConfig[resourceType];
	const requestedId = resourceId ?? getResourceIdFromPathname(pathname, resourceType) ?? `the requested ${config.articleNoun}`;

	return (
		<main className="flex flex-1 flex-col">
			<div className="container mx-auto flex min-h-[62vh] w-full flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
				<div className="w-full max-w-2xl text-center">
					<h1 className="mx-auto max-w-2xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
						<span className="block break-words">
							The {config.articleNoun}{" "}
							<span className="font-mono text-[0.9em]">{requestedId}</span>
						</span>
						<span className="block">is not available yet</span>
					</h1>
					<p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
						{config.description}
					</p>

					<div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
						<span>{config.requestLabel}</span>
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

					<div className="mt-5 flex flex-wrap items-center justify-center gap-3">
						<Button asChild>
							<Link href={config.browseHref}>
								<ArrowLeft className="h-4 w-4" />
								{config.browseLabel}
							</Link>
						</Button>
					</div>
				</div>
			</div>
		</main>
	);
}
