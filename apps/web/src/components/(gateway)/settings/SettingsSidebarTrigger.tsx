"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Check, ChevronDown, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { getActiveSettingsNav, getSettingsSidebar } from "./Sidebar.config";
import { cn } from "@/lib/utils";

export default function SettingsSidebarTrigger({
	showBroadcast = true,
	showWebhooks = true,
}: {
	showBroadcast?: boolean;
	showWebhooks?: boolean;
}) {
	const pathname = usePathname();
	const navGroups = getSettingsSidebar({ showBroadcast, showWebhooks });
	const activeNav = getActiveSettingsNav(pathname ?? "", { showBroadcast, showWebhooks });
	const activeItem = activeNav?.item ?? null;
	const activeScope = activeNav?.group.scope ?? "personal";
	const visibleGroups = navGroups.filter((group) => group.scope === activeScope);

	return (
		<div className="lg:hidden">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="outline"
						className="w-full justify-between"
						aria-haspopup="menu"
					>
							<span className="flex min-w-0 items-center gap-2">
								<span className="truncate">{activeItem?.label ?? "Settings"}</span>
							{activeItem?.badge && (
								<Badge
									variant="outline"
									className="h-5 px-1.5 text-[10px] capitalize"
								>
									{activeItem.badge}
								</Badge>
							)}
						</span>
						<ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					className="w-[min(24rem,calc(100vw-2rem))]"
				>
					<div className="grid grid-cols-2 gap-1 p-1">
						<Link href="/settings/profile" className={cn("flex h-9 items-center justify-center gap-2 rounded-md px-2 text-xs font-medium", activeScope === "personal" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}><UserRound className="size-3.5" />My account</Link>
						<Link href="/settings/workspaces/settings" className={cn("flex h-9 items-center justify-center gap-2 rounded-md px-2 text-xs font-medium", activeScope === "workspace" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}><Building2 className="size-3.5" />Workspace</Link>
					</div>
					<DropdownMenuSeparator />
					{visibleGroups.map((group, index) => (
						<div key={`${group.heading ?? "group"}-${index}`}>
							{group.heading ? (
								<DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
									{group.heading}
								</DropdownMenuLabel>
							) : null}
							{group.items.map((item) => {
								const active = activeItem?.href === item.href;
								return (
									<DropdownMenuItem key={item.href} asChild>
										<Link href={item.href} className="flex w-full items-center gap-2">
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
											{active ? <Check className="h-4 w-4 shrink-0" /> : null}
										</Link>
									</DropdownMenuItem>
								);
							})}
							{index < visibleGroups.length - 1 ? <DropdownMenuSeparator /> : null}
						</div>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
