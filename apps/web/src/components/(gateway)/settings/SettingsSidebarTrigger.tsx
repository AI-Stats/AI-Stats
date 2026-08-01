"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Building2, Check, Menu as MenuIcon, UserRound, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { getActiveSettingsNav, getSettingsSidebar } from "./Sidebar.config";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function SettingsSidebarTrigger({
	showBroadcast = true,
	showWebhooks = true,
}: {
	showBroadcast?: boolean;
	showWebhooks?: boolean;
}) {
	const pathname = usePathname();
	const [open, setOpen] = useState(false);
	const isHydrated = useSyncExternalStore(
		subscribe,
		getClientSnapshot,
		getServerSnapshot,
	);
	const navGroups = getSettingsSidebar({ showBroadcast, showWebhooks });
	const activeNav = getActiveSettingsNav(pathname ?? "", { showBroadcast, showWebhooks });
	const activeItem = activeNav?.item ?? null;
	const activeScope = activeNav?.group.scope ?? "personal";
	const [visibleScope, setVisibleScope] = useState(activeScope);
	const visibleGroups = navGroups.filter((group) => group.scope === visibleScope);

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) setVisibleScope(activeScope);
		setOpen(nextOpen);
	};

	if (!isHydrated || !pathname?.startsWith("/settings")) return null;

	return (
		<div className="flex items-center lg:hidden">
			<DropdownMenu open={open} onOpenChange={handleOpenChange}>
				<DropdownMenuTrigger
					className={cn(
						buttonVariants({ variant: "ghost", size: "icon" }),
						"relative size-[var(--site-header-control-h,2.25rem)] shrink-0 rounded-lg",
					)}
					aria-label={open ? "Close settings menu" : "Open settings menu"}
					aria-haspopup="menu"
				>
					<MenuIcon
						className={cn(
							"absolute size-5 transition-[opacity,transform] duration-200",
							open ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100",
						)}
						aria-hidden="true"
					/>
					<X
						className={cn(
							"absolute size-5 transition-[opacity,transform] duration-200",
							open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0",
						)}
						aria-hidden="true"
					/>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					className="w-[min(24rem,calc(100vw-2rem))]"
				>
					<DropdownMenuRadioGroup
						value={visibleScope}
						onValueChange={(value) => {
							if (value === "personal" || value === "workspace") {
								setVisibleScope(value);
							}
						}}
						className="grid grid-cols-2 gap-1 p-1"
					>
						<DropdownMenuRadioItem
							value="personal"
							closeOnClick={false}
							className={cn(
								"h-9 justify-center px-2 text-xs font-medium",
								visibleScope === "personal"
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
							)}
						>
							<UserRound className="size-3.5" aria-hidden="true" />
							My account
						</DropdownMenuRadioItem>
						<DropdownMenuRadioItem
							value="workspace"
							closeOnClick={false}
							className={cn(
								"h-9 justify-center px-2 text-xs font-medium",
								visibleScope === "workspace"
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
							)}
						>
							<Building2 className="size-3.5" aria-hidden="true" />
							Workspace
						</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
					<DropdownMenuSeparator />
					{visibleGroups.map((group, index) => (
						<DropdownMenuGroup key={`${group.heading ?? "group"}-${index}`}>
							{group.heading ? (
								<DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
									{group.heading}
								</DropdownMenuLabel>
							) : null}
							{group.items.map((item) => {
								const active = activeItem?.href === item.href;
								const Icon = item.icon;
								return (
									<DropdownMenuItem
										key={item.href}
										render={
											<Link href={item.href} className="flex w-full items-center gap-2" />
										}
									>
										{Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
										<span className="min-w-0 flex-1 truncate">
											{item.label}
										</span>
										{item.badge ? (
											<Badge
												variant="outline"
												className="h-5 px-1.5 text-[10px] capitalize"
											>
												{item.badge}
											</Badge>
										) : null}
										{active ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
									</DropdownMenuItem>
								);
							})}
							{index < visibleGroups.length - 1 ? <DropdownMenuSeparator /> : null}
						</DropdownMenuGroup>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
