import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ActiveModelFilter = {
	key: string;
	label: string;
	onRemove: () => void;
};

export function ActiveModelFilters({
	filters,
	onClear,
}: {
	filters: ActiveModelFilter[];
	onClear: () => void;
}) {
	if (filters.length === 0) return null;

	return (
		<div className="mt-2 flex min-w-0 items-center gap-2 lg:hidden" aria-live="polite">
			<div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				{filters.map((filter) => (
					<Button
						key={filter.key}
						type="button"
						variant="outline"
						size="sm"
						className="h-7 shrink-0 gap-1 rounded-md bg-muted/35 px-2 text-xs font-medium"
						onClick={filter.onRemove}
						aria-label={`Remove ${filter.label} filter`}
					>
						<span className="max-w-44 truncate">{filter.label}</span>
						<X className="size-3 text-muted-foreground" aria-hidden="true" />
					</Button>
				))}
			</div>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="h-7 shrink-0 rounded-md px-2 text-xs"
				onClick={onClear}
			>
				Clear all
			</Button>
		</div>
	);
}
