"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ExternalLink, PanelLeftClose, PanelLeftOpen, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";

import type { NavGroup, NavItem } from "./Sidebar.config";
import { getSettingsSidebar } from "./Sidebar.config";
import { cn } from "@/lib/utils";

export default function SettingsSidebar({
	children,
	showBroadcast = true,
	showWebhooks = true,
	workspaceName,
}: {
	/**
	 * Optional slot for lightweight, non-blocking sidebar adornments (e.g. alert counts).
	 * This is rendered next to the "Usage" item label.
	 */
	children?: ReactNode;
	showBroadcast?: boolean;
	showWebhooks?: boolean;
	workspaceName?: string | null;
}) {
	const pathname = usePathname();
	const { isMobile, setOpenMobile, state, toggleSidebar } = useSidebar();
	const isCollapsed = state === "collapsed" && !isMobile;
	const navGroups = getSettingsSidebar({ showBroadcast, showWebhooks });

	function matchScore(item: NavItem) {
		const path = pathname ?? "";
		if (item.disabled || item.external) return null;

		if (path === item.href) return { exact: true, len: item.href.length };
		if (path.startsWith(item.href + "/"))
			return { exact: true, len: item.href.length };

		let best = 0;
		for (const prefix of item.match ?? []) {
			if (path === prefix || path.startsWith(prefix + "/")) {
				best = Math.max(best, prefix.length);
			}
		}
		if (best > 0) return { exact: false, len: best };
		return null;
	}

	const activeEntry =
		navGroups
			.flatMap((group) => group.items.map((item) => ({ group, item })))
			.map(({ group, item }) => ({ group, item, score: matchScore(item) }))
			.filter((x) => x.score !== null)
			.sort((a, b) => {
				// Prefer exact matches over "match prefix" matches, then longest match.
				if (a.score!.exact !== b.score!.exact)
					return a.score!.exact ? -1 : 1;
				return b.score!.len - a.score!.len;
			})[0] ?? null;
	const activeItem = activeEntry?.item ?? null;
	const activeScope = activeEntry?.group.scope ?? "personal";
	const visibleGroups = navGroups.filter((group) => group.scope === activeScope);

	const closeMobile = () => {
		if (isMobile) setOpenMobile(false);
	};

	function NavBlock({ group, first }: { group: NavGroup; first: boolean }) {
		const heading = (group.heading ?? "").trim();
		return (
			<SidebarGroup className={cn("pt-0", !first && "group-data-[collapsible=icon]:pt-2")}>
				{heading ? <SidebarGroupLabel>{heading}</SidebarGroupLabel> : null}
				<SidebarGroupContent>
					<SidebarMenu>
						{group.items.map((item) => (
							<SidebarMenuItem
								key={`${heading || "group"}-${item.href}`}
							>
								{renderNavItem(item)}
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		);
	}

	function renderNavItem(item: NavItem) {
		const active =
			!item.disabled && !item.external && activeItem?.href === item.href;

		const Icon = item.icon;
		const content = (
			<>
				{Icon ? (
					<Icon
						aria-hidden="true"
						className="h-4 w-4 shrink-0 text-muted-foreground"
					/>
				) : null}
				<span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">
					{item.label}
				</span>
				{item.badge && (
					<Badge
						variant="outline"
						className="ml-auto h-5 px-1.5 text-[10px] capitalize group-data-[collapsible=icon]:hidden"
					>
						{item.badge}
					</Badge>
				)}
				{item.href === "/settings/usage" && !isCollapsed ? children : null}
				{item.external && (
					<ExternalLink
						aria-hidden="true"
						className="ml-2 h-4 w-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
					/>
				)}
			</>
		);

		if (item.disabled) {
			return (
				<SidebarMenuButton
					disabled
					aria-disabled="true"
					aria-label={isCollapsed ? item.label : undefined}
					className="cursor-not-allowed"
					tooltip={item.label}
				>
					{content}
				</SidebarMenuButton>
			);
		}

		if (item.external) {
			return (
				<SidebarMenuButton asChild tooltip={item.label}>
					<a
						href={item.href}
						target="_blank"
						rel="noreferrer"
						aria-label={`${item.label} (opens in a new tab)`}
						onClick={closeMobile}
					>
						{content}
					</a>
				</SidebarMenuButton>
			);
		}

		return (
			<SidebarMenuButton asChild isActive={active} tooltip={item.label}>
				<Link
					href={item.href}
					prefetch={false}
					aria-current={active ? "page" : undefined}
					aria-label={isCollapsed ? item.label : undefined}
					onClick={closeMobile}
				>
					{content}
				</Link>
			</SidebarMenuButton>
		);
	}

	return (
		<>
			<SidebarHeader className="h-[53px] shrink-0 gap-0 border-b px-2 py-0 group-data-[collapsible=icon]:px-2">
				<div className="flex h-full items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
					<div className="text-sm font-semibold text-foreground group-data-[collapsible=icon]:hidden">
						Settings
					</div>
					<Button
						variant="ghost"
						size="icon"
						className="ml-auto group-data-[collapsible=icon]:ml-0"
						onClick={toggleSidebar}
						aria-label={isCollapsed ? "Expand settings sidebar" : "Collapse settings sidebar"}
						title={isCollapsed ? "Expand settings sidebar" : "Collapse settings sidebar"}
					>
						{isCollapsed ? (
							<PanelLeftOpen className="h-4 w-4" />
						) : (
							<PanelLeftClose className="h-4 w-4" />
						)}
					</Button>
				</div>
			</SidebarHeader>
			<SidebarContent className="overflow-y-auto">
				<div className="px-2 pt-3 group-data-[collapsible=icon]:hidden">
					<div className="grid grid-cols-2 rounded-lg bg-muted/70 p-1" aria-label="Settings scope">
						<Link href="/settings/profile" prefetch={false} aria-current={activeScope === "personal" ? "page" : undefined} className={activeScope === "personal" ? "flex h-8 items-center justify-center gap-1.5 rounded-md bg-background px-2 text-xs font-medium text-foreground shadow-sm" : "flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:text-foreground"}><UserRound className="size-3.5" />My account</Link>
						<Link href="/settings/workspaces/settings" prefetch={false} aria-current={activeScope === "workspace" ? "page" : undefined} className={activeScope === "workspace" ? "flex h-8 items-center justify-center gap-1.5 rounded-md bg-background px-2 text-xs font-medium text-foreground shadow-sm" : "flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:text-foreground"}><Building2 className="size-3.5" />Workspace</Link>
					</div>
					{activeScope === "workspace" && workspaceName ? <p className="truncate px-2 pt-2 text-[11px] text-muted-foreground">{workspaceName}</p> : null}
				</div>
				<div className="hidden border-b border-sidebar-border px-2 py-2 group-data-[collapsible=icon]:block">
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton asChild isActive={activeScope === "personal"} tooltip="My account">
								<Link href="/settings/profile" prefetch={false} aria-label="My account settings">
									<UserRound className="size-4" />
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton asChild isActive={activeScope === "workspace"} tooltip="Workspace">
								<Link href="/settings/workspaces/settings" prefetch={false} aria-label="Workspace settings">
									<Building2 className="size-4" />
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</div>
				<div className="pb-4">
					{visibleGroups.map((group, idx) => (
						<div key={`${group.heading ?? "group"}-${idx}`} className={idx > 0 ? "group-data-[collapsible=icon]:border-t group-data-[collapsible=icon]:border-sidebar-border" : undefined}>
							<NavBlock group={group} first={idx === 0} />
						</div>
					))}
				</div>
			</SidebarContent>
		</>
	);
}
