"use client";

import { Check, ChevronDown } from "lucide-react";
import { Logo } from "@/components/Logo";
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
import { cn } from "@/lib/utils";

export type ModelSearchDropdownOption = {
  value: string;
  label: string;
  description?: string;
  logoId?: string;
  keywords?: string[];
};

export function ModelSearchDropdown({
  value,
  onValueChange,
  options,
  open,
  onOpenChange,
  disabled,
  placeholder = "Select a model",
  searchPlaceholder = "Search models...",
  emptyMessage = "No models found.",
  className,
  contentClassName,
}: {
  value?: string;
  onValueChange: (value: string) => void;
  options: ModelSearchDropdownOption[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  contentClassName?: string;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between gap-3 rounded-xl px-3 font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {selected?.logoId ? (
              <Logo
                id={selected.logoId}
                alt={selected.description ?? selected.label}
                width={18}
                height={18}
                className="size-[18px] shrink-0 rounded-sm object-contain"
              />
            ) : null}
            <span className="min-w-0 truncate text-left">
              {selected
                ? `${selected.label}${selected.description ? ` · ${selected.description}` : ""}`
                : placeholder}
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className={cn(
          "w-(--anchor-width) max-w-[calc(100vw-2rem)] gap-0 rounded-2xl p-1",
          contentClassName
        )}
      >
        <Command>
          <CommandInput autoFocus placeholder={searchPlaceholder} />
          <CommandList className="max-h-[min(52vh,24rem)] p-1 [scrollbar-width:thin]! [scrollbar-color:var(--muted-foreground)_transparent] [&::-webkit-scrollbar]:block! [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/35 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/55">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup heading="Models">
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, option.description ?? "", ...(option.keywords ?? [])]}
                  onSelect={() => {
                    onValueChange(option.value);
                    onOpenChange?.(false);
                  }}
                  className="min-h-11 gap-3 rounded-xl px-3 py-2"
                >
                  {option.logoId ? (
                    <Logo
                      id={option.logoId}
                      alt={option.description ?? option.label}
                      width={20}
                      height={20}
                      className="size-5 shrink-0 rounded-sm object-contain"
                    />
                  ) : (
                    <span className="size-5 shrink-0" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {option.label}
                    </span>
                    {option.description ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {selected?.value === option.value ? (
                    <Check className="size-4 shrink-0" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
