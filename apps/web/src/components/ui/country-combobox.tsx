"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
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
import { COUNTRY_OPTIONS, countryFlag } from "@/lib/countryCodes";
import { cn } from "@/lib/utils";

type CountryComboboxProps = {
	id?: string;
	value: string;
	onValueChange: (value: string) => void;
	disabled?: boolean;
	placeholder?: string;
};

export function CountryCombobox({
	id,
	value,
	onValueChange,
	disabled = false,
	placeholder = "Select a country",
}: CountryComboboxProps) {
	const [open, setOpen] = React.useState(false);
	const selected = COUNTRY_OPTIONS.find((country) => country.code === value);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-label="Select country"
					disabled={disabled}
					className="h-10 w-full justify-between rounded-md px-3 font-normal"
				>
					<span className="flex min-w-0 items-center gap-2">
						{selected ? <span aria-hidden="true" className="text-base">{countryFlag(selected.code)}</span> : null}
						<span className={cn("truncate", !selected && "text-muted-foreground")}>
							{selected?.name ?? placeholder}
						</span>
					</span>
					<ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-[var(--anchor-width)] min-w-72 gap-0 rounded-xl p-1">
				<Command>
					<CommandInput placeholder="Search country, ISO-2 or ISO-3…" autoFocus />
					<CommandList>
						<CommandEmpty>No country found.</CommandEmpty>
						<CommandGroup>
							{COUNTRY_OPTIONS.map((country) => (
								<CommandItem
									key={country.code}
									value={`${country.name} ${country.code} ${country.alpha3}`}
									data-checked={country.code === value}
									onSelect={() => {
										onValueChange(country.code);
										setOpen(false);
									}}
								>
									<span aria-hidden="true" className="text-base">{countryFlag(country.code)}</span>
									<span className="min-w-0 flex-1 truncate">{country.name}</span>
									<span className="text-xs text-muted-foreground">{country.code}</span>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
