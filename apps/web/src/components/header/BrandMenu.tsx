"use client";

import Image from "next/image";
import { Check, Copy, Download } from "lucide-react";
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
			<DropdownMenuTrigger asChild nativeButton={false}>
				{trigger}
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="w-[min(22rem,calc(100vw-1rem))] rounded-xl p-2"
			>
				<div className="grid grid-cols-1 gap-2 min-[22rem]:grid-cols-2">
					{brandAssets.map(({ name, file, width, height }) => {
						const copied = copiedAsset === name;
						const assetPath = `/${file}_${assetTheme}.svg`;

						return (
							<div
								key={name}
								className="overflow-hidden rounded-lg border bg-muted/30"
							>
								<div className="flex h-14 items-center justify-center bg-white px-4 dark:bg-black">
									<Image
										src={assetPath}
										alt={`Phaseo ${name.toLowerCase()}`}
										width={width}
										height={height}
										className={file === "logo" ? "size-8" : "h-6 w-auto"}
									/>
								</div>
								<div className="flex items-center gap-1 border-t px-2 py-1.5">
									<span className="min-w-0 flex-1 truncate text-xs font-medium">
										{name}
									</span>
									<button
										type="button"
										onClick={() => void copyAsset(name, file)}
										className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										aria-label={`Copy ${name.toLowerCase()} SVG code`}
										title="Copy SVG code"
									>
										{copied ? (
											<Check className="size-4 text-emerald-500" aria-hidden="true" />
										) : (
											<Copy className="size-4" aria-hidden="true" />
										)}
									</button>
									<a
										href={assetPath}
										download={`phaseo-${file}-${assetTheme}.svg`}
										className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										aria-label={`Download ${name.toLowerCase()} SVG`}
										title="Download SVG"
									>
										<Download className="size-4" aria-hidden="true" />
									</a>
								</div>
							</div>
						);
					})}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
