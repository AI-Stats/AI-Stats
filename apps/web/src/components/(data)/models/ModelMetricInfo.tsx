"use client";

import { CircleHelp } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export function ModelMetricInfo({
	label,
	description,
}: {
	label: string;
	description: string;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label={`About ${label}`}
					className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					<CircleHelp className="size-3.5" />
				</button>
			</TooltipTrigger>
			<TooltipContent side="top" sideOffset={6} className="max-w-72 leading-5">
				{description}
			</TooltipContent>
		</Tooltip>
	);
}
