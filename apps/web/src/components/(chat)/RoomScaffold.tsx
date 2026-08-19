"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { Coins, Gauge, LogOut, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatRoomSwitcher } from "@/components/(chat)/ChatRoomSwitcher";
import { useChatCredits } from "@/components/(chat)/use-chat-credits";
import {
	MobileChatSidebarBrand,
	MobileChatSidebarTrigger,
} from "@/components/(chat)/MobileChatSidebarBrand";
import { ThemeSelector } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useChatAuth } from "@/components/(chat)/playground/use-chat-auth";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarProvider,
	SidebarRail,
} from "@/components/ui/sidebar";

type RoomScaffoldProps = {
	children: ReactNode;
};

export const ROOM_SIDEBAR_SLOT_ID = "room-scaffold-sidebar-slot";

function RoomSidebarHeader() {
	return (
		<SidebarHeader className="h-[57px] gap-0 border-b border-border px-0 py-0">
			<div className="flex h-full min-w-0 items-center">
				<MobileChatSidebarBrand />
				<ChatRoomSwitcher className="min-w-0 flex-1" />
				<MobileChatSidebarTrigger />
			</div>
		</SidebarHeader>
	);
}

export function RoomScaffold({ children }: RoomScaffoldProps) {
	const { authUser, authLoading, handleSignOut } = useChatAuth();
	const { creditsLabel, creditsLoading } = useChatCredits(authUser?.id);

	const nameParts = authUser?.name?.trim().split(" ").filter(Boolean) ?? [];
	const firstName = nameParts[0] ?? "Account";
	const initials = nameParts
		.map((word) => word[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	return (
		<SidebarProvider defaultOpen contained className="h-full overflow-hidden">
			<Sidebar collapsible="icon" className="border-r border-border bg-background">
				<RoomSidebarHeader />
				<SidebarContent className="gap-0">
					<div
						id={ROOM_SIDEBAR_SLOT_ID}
						className="flex min-h-0 flex-1 flex-col gap-0"
					/>
				</SidebarContent>
				<SidebarFooter
					className="h-[57px] shrink-0 justify-center border-t border-border px-2 py-2"
				>
					{authUser ? (
						<div className="grid gap-2">
							<DropdownMenu>
								<DropdownMenuTrigger render={<Button
										variant="ghost"
										aria-label="Open account menu"
										className="h-10 min-h-0 w-full touch-manipulation justify-start gap-2 rounded-md px-2 py-1 active:bg-muted data-open:bg-muted group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:px-0" />}>

									<Avatar className="pointer-events-none h-7 w-7 rounded-full border border-zinc-200/70 dark:border-zinc-800/70">
											{authUser.avatarUrl ? (
												<AvatarImage
													src={authUser.avatarUrl}
													alt={authUser.name}
													className="object-cover"
												/>
											) : null}
										<AvatarFallback className="rounded-full text-[10px] font-semibold">
												{initials || "U"}
											</AvatarFallback>
										</Avatar>
										<div className="pointer-events-none flex min-w-0 flex-col items-start text-left group-data-[collapsible=icon]:hidden">
											<span className="truncate text-sm font-medium">
												{firstName}
											</span>
											<span className="truncate text-[11px] font-normal text-muted-foreground">
												All data is stored locally.
											</span>
										</div>

								</DropdownMenuTrigger>
								<DropdownMenuContent
									side="right"
									align="start"
									sideOffset={8}
									className="z-[90] w-56 rounded-md [&_[data-slot=dropdown-menu-item]]:rounded-md"
								>
									<DropdownMenuItem render={<Link href="/settings/account" />}>

											<UserRound className="mr-2 h-4 w-4" />
											Account

									</DropdownMenuItem>
									<DropdownMenuItem render={<Link href="/gateway/usage" />}>

											<Gauge className="mr-2 h-4 w-4" />
											Usage

									</DropdownMenuItem>
									<DropdownMenuItem render={<Link
											href="/settings/credits"
											aria-label={creditsLabel ? `Credits balance: ${creditsLabel}` : "Credits"} />}>

											<Coins className="mr-2 h-4 w-4" />
											<span>Credits</span>
											{creditsLoading ? (
												<Skeleton className="ml-auto h-3.5 w-16 rounded-sm" />
											) : creditsLabel ? (
												<span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
													{creditsLabel}
												</span>
											) : null}

									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<div className="flex min-h-10 items-center justify-between gap-3 px-2 py-1.5">
										<span className="text-sm">Theme</span>
										<ThemeSelector className="shrink-0" showSelectedLabel={false} />
									</div>
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={handleSignOut}>
										<LogOut className="mr-2 h-4 w-4" />
										Sign out
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					) : authLoading ? (
						<div className="h-9 w-full rounded-md bg-muted/40" />
					) : (
						<Button variant="ghost" className="w-full justify-start rounded-md" asChild>
							<Link href="/sign-in">Sign in to chat</Link>
						</Button>
					)}
				</SidebarFooter>
				<SidebarRail />
			</Sidebar>
			<SidebarInset className="flex h-full min-w-0 min-h-0 flex-1 flex-col overflow-hidden bg-background">
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}
