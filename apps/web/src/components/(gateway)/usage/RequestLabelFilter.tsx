"use client";

import * as React from "react";
import { parseAsString, useQueryStates } from "nuqs";
import { Check, Tag, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { UsageLabelFacet } from "@/lib/fetchers/internal/settingsTypes";

export default function RequestLabelFilter({ facets }: { facets: UsageLabelFacet[] }) {
	const [queryState, setQueryState] = useQueryStates({
		label_key: parseAsString.withDefault(""),
		label_value: parseAsString.withDefault(""),
	}, { shallow: false });
	const [open, setOpen] = React.useState(false);
	const active = queryState.label_key && queryState.label_value
		? { key: queryState.label_key, value: queryState.label_value }
		: null;

	const clear = () => {
		void setQueryState({ label_key: null, label_value: null });
	};

	return (
		<div className="inline-flex items-center gap-1">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant={active ? "secondary" : "outline"}
						size="sm"
						className="h-8 max-w-[min(320px,50vw)] gap-1.5 rounded-md px-2 text-xs"
						aria-label={active ? `Change label filter ${active.key} equals ${active.value}` : "Filter requests by label"}
					>
						<Tag className="size-3.5 shrink-0" />
						<span className="truncate">{active ? `${active.key} = ${active.value}` : "Label"}</span>
					</Button>
				</PopoverTrigger>
				<PopoverContent align="end" className="w-[340px] gap-0 overflow-hidden rounded-md p-0">
					<Command>
						<CommandInput placeholder="Search labels…" />
						<CommandList className="max-h-[320px]">
							<CommandEmpty>{facets.length ? "No matching labels." : "No request labels in this time range."}</CommandEmpty>
							<CommandGroup heading="Request labels">
								{facets.map((facet) => {
									const selected = active?.key === facet.key && active.value === facet.value;
									return (
										<CommandItem
											key={`${facet.key}\u0000${facet.value}`}
											value={`${facet.key} ${facet.value}`}
											onSelect={() => {
												void setQueryState({ label_key: facet.key, label_value: facet.value });
												setOpen(false);
											}}
										>
											<span className="min-w-0 flex-1 truncate">
												<span className="font-medium">{facet.key}</span>
												<span className="px-1 text-muted-foreground">=</span>
												<span>{facet.value}</span>
											</span>
											{selected ? <Check className="size-4" /> : null}
										</CommandItem>
									);
								})}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
			{active ? (
				<button
					type="button"
					className="inline-flex size-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground"
					onClick={clear}
					aria-label="Clear label filter"
				>
					<X className="size-3.5" />
				</button>
			) : null}
		</div>
	);
}
