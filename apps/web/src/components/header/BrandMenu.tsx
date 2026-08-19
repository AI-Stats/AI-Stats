"use client";

import Image from "next/image";
import { Check, Copy } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const brandAssets = [
	{ name: "Wordmark", file: "wordmark", width: 1441, height: 300 },
	{ name: "Logo", file: "logo", width: 64, height: 64 },
] as const;

export function BrandMenu() {
	const { resolvedTheme } = useTheme();
	const [copiedAsset, setCopiedAsset] = useState<string | null>(null);
	const assetTheme = resolvedTheme === "dark" ? "dark" : "light";

	async function copyAsset(name: string, file: string) {
		try {
			const response = await fetch(`/${file}_${assetTheme}.svg`);
			if (!response.ok) throw new Error("Could not load brand asset");

			await navigator.clipboard.writeText(await response.text());
			setCopiedAsset(name);
			toast.success(`${name} copied to clipboard`);
			window.setTimeout(() => setCopiedAsset(null), 2000);
		} catch {
			toast.error(`Could not copy ${name.toLowerCase()}`);
		}
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label="Open Phaseo brand assets"
					className="inline-flex h-[var(--site-header-control-h,2.25rem)] shrink-0 items-center rounded-lg px-[var(--site-header-nav-px,0.75rem)] transition-colors hover:bg-zinc-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 data-[state=open]:bg-zinc-100/70 dark:hover:bg-zinc-900/60 dark:focus-visible:ring-zinc-600/50 dark:data-[state=open]:bg-zinc-900/60"
				>
					<Image
						src="/wordmark_light.svg"
						alt="Phaseo"
						width={154}
						height={40}
						className="h-[var(--site-header-logo-height,2.5rem)] w-auto select-none dark:hidden"
						style={{ width: "auto" }}
						priority
					/>
					<Image
						src="/wordmark_dark.svg"
						alt="Phaseo"
						width={154}
						height={40}
						className="hidden h-[var(--site-header-logo-height,2.5rem)] w-auto select-none dark:block"
						style={{ width: "auto" }}
						priority
					/>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-[22rem] rounded-xl p-2">
				<div className="grid grid-cols-2 gap-2">
					{brandAssets.map(({ name, file, width, height }) => {
						const copied = copiedAsset === name;

						return (
							<DropdownMenuItem
								key={name}
								onSelect={() => void copyAsset(name, file)}
								className="group flex cursor-pointer flex-col items-stretch gap-2 rounded-lg p-2 focus:bg-zinc-100 dark:focus:bg-zinc-900"
							>
								<div className="flex h-20 items-center justify-center rounded-md border bg-white p-4 dark:bg-black">
									<Image
										src={`/${file}_${assetTheme}.svg`}
										alt={`Phaseo ${name.toLowerCase()}`}
										width={width}
										height={height}
										className={file === "logo" ? "size-10" : "h-8 w-auto"}
									/>
								</div>
								<span className="flex w-full items-center justify-between px-1 text-sm font-medium">
									Copy {name}
									{copied ? (
										<Check className="size-4 text-emerald-500" aria-hidden="true" />
									) : (
										<Copy className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100" aria-hidden="true" />
									)}
								</span>
							</DropdownMenuItem>
						);
					})}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
