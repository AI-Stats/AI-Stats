"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TableSortDirection = "asc" | "desc" | null;

export function TableSortButton({
	children,
	direction,
	onClick,
	align = "start",
	className,
}: {
	children: ReactNode;
	direction: TableSortDirection;
	onClick: () => void;
	align?: "start" | "end";
	className?: string;
}) {
	const Icon = direction == null
		? ChevronsUpDown
		: direction === "desc"
			? ChevronDown
			: ChevronUp;

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className={cn(
				"group h-7 rounded-sm px-2 text-xs hover:bg-transparent dark:hover:bg-transparent",
				align === "end" ? "ml-auto justify-end" : "justify-start",
				className,
			)}
			onClick={onClick}
		>
			{align === "end" ? <SortIcon Icon={Icon} direction={direction} /> : null}
			{children}
			{align === "start" ? <SortIcon Icon={Icon} direction={direction} /> : null}
		</Button>
	);
}

function SortIcon({
	Icon,
	direction,
}: {
	Icon: typeof ChevronsUpDown;
	direction: TableSortDirection;
}) {
	return (
		<Icon
				className={cn(
					"size-3.5 transition-opacity",
					direction == null
						? "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60"
						: "opacity-100",
				)}
		/>
	);
}
