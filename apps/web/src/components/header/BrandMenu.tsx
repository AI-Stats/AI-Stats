"use client";

import Image from "next/image";
import { Check, Copy } from "lucide-react";
import { useTheme } from "next-themes";
import {
	cloneElement,
	type KeyboardEvent,
	type MouseEvent,
	type ReactElement,
	useState,
} from "react";
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

type BrandMenuTriggerProps = {
	onContextMenu?: (event: MouseEvent) => void;
	onKeyDown?: (event: KeyboardEvent) => void;
};

export function BrandMenu({
	children,
}: {
	children: ReactElement<BrandMenuTriggerProps>;
}) {
	const { resolvedTheme } = useTheme();
	const [open, setOpen] = useState(false);
	const [copiedAsset, setCopiedAsset] = useState<string | null>(null);
	const assetTheme = resolvedTheme === "dark" ? "dark" : "light";
	const trigger = cloneElement(children, {
		onContextMenu: (event: MouseEvent) => {
			event.preventDefault();
			setOpen(true);
		},
		onKeyDown: (event: KeyboardEvent) => {
			if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) {
				return;
			}

			event.preventDefault();
			setOpen(true);
		},
	});

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
		<DropdownMenu
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) setOpen(false);
			}}
		>
			<DropdownMenuTrigger asChild>
				{trigger}
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="w-[min(22rem,calc(100vw-1rem))] rounded-xl p-2"
			>
				<div className="grid grid-cols-1 gap-2 min-[22rem]:grid-cols-2">
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
