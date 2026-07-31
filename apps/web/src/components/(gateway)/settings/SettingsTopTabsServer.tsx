"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, PanelLeftIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { getActiveSettingsNav } from "./Sidebar.config";

type Tab = {
	href: string;
	label: string;
	match?: string[];
	badge?: string;
	exactOnly?: boolean;
	view?: "logs" | "upstream" | "jobs" | "sessions";
};

function getBillingTabs(): Tab[] {
	return [
		{ href: "/settings/credits", label: "Credits" },
		{ href: "/settings/credits/transactions", label: "Transactions" },
		{ href: "/settings/payment-methods", label: "Payment Methods" },
	];
}

const USAGE_TABS: Tab[] = [
	{ href: "/settings/usage/overview", label: "Overview", match: ["/settings/usage"] },
	{ href: "/settings/usage/trends", label: "Trends" },
	{ href: "/settings/usage/explore", label: "Explore" },
	{ href: "/settings/usage/alerts", label: "Alerts" },
];

function resolveTabs(pathname: string, options: { showBroadcast: boolean; showWebhooks: boolean }): Tab[] | null {
	// Account
	if (pathname.startsWith("/settings/account/workspaces")) return null;
	if (pathname.startsWith("/settings/account")) {
		return [
			{
				href: "/settings/account/details",
				label: "Details",
				match: ["/settings/account/details"],
			},
			{
				href: "/settings/account/mfa",
				label: "MFA",
				match: ["/settings/account/mfa"],
			},
			{
				href: "/settings/account/danger",
				label: "Danger Zone",
				match: ["/settings/account/danger"],
			},
		];
	}

	// Workspace
	if (
		pathname.startsWith("/settings/workspaces") ||
		pathname.startsWith("/settings/teams")
	) {
		return [
			{ href: "/settings/workspaces/settings", label: "General", match: ["/settings/teams/settings", "/settings/workspaces"] },
			{ href: "/settings/workspaces/members", label: "Members", match: ["/settings/teams/members"] },
			{ href: "/settings/workspaces/access", label: "Access", match: ["/settings/teams/access"] },
		];
	}

	if (pathname.startsWith("/settings/beta")) {
		return [
			{
				href: "/settings/beta",
				label: "Feature Preview",
			},
		];
	}

	if (pathname.startsWith("/settings/credits") || pathname.startsWith("/settings/payment-methods")) {
		return getBillingTabs();
	}
	if (pathname.startsWith("/settings/usage/logs")) {
		return [
			{ href: "/settings/usage/logs?view=logs", label: "Requests", view: "logs" },
			{ href: "/settings/usage/logs?view=upstream", label: "Upstream Requests", view: "upstream" },
			{ href: "/settings/usage/logs?view=jobs", label: "Jobs", view: "jobs" },
			{ href: "/settings/usage/logs?view=sessions", label: "Sessions", view: "sessions" },
		];
	}
	if (pathname.startsWith("/settings/usage")) return USAGE_TABS;
	if (pathname.startsWith("/settings/routing")) {
		return [
			{ href: "/settings/routing", label: "Routing", exactOnly: true },
			{ href: "/settings/routing/dynamic", label: "Dynamic routes", match: ["/settings/routing/demo"] },
			{ href: "/settings/routing/insights", label: "Insights" },
		];
	}
	if (pathname.startsWith("/settings/guardrails") || pathname.startsWith("/settings/privacy")) {
		return [
			{ href: "/settings/guardrails", label: "Guardrails" },
			{ href: "/settings/privacy", label: "Data controls" },
		];
	}
	if (
		pathname.startsWith("/settings/management-api-keys") ||
		pathname.startsWith("/settings/provisioning-keys") ||
		pathname.startsWith("/settings/oauth-apps") ||
		pathname.startsWith("/settings/authorized-apps") ||
		pathname.startsWith("/settings/webhooks") ||
		pathname.startsWith("/settings/broadcast") ||
		pathname.startsWith("/settings/observability") ||
		pathname.startsWith("/settings/sdk")
	) {
		return [
			{ href: "/settings/management-api-keys", label: "Management keys", match: ["/settings/provisioning-keys"] },
			{ href: "/settings/oauth-apps", label: "OAuth apps", match: ["/settings/authorized-apps"] },
			...(options.showWebhooks ? [{ href: "/settings/webhooks", label: "Webhooks" }] : []),
			...(options.showBroadcast ? [{ href: "/settings/broadcast", label: "Broadcast", match: ["/settings/observability"] }] : []),
			{ href: "/settings/sdk", label: "SDKs" },
		];
	}
	if (
		pathname.startsWith("/settings/keys") ||
		pathname.startsWith("/settings/apps") ||
		pathname.startsWith("/settings/byok") ||
		pathname.startsWith("/settings/presets")
	) {
		return null;
	}
	// Developer and other pages: sidebar is enough.
	return null;
}

export default function SettingsTopTabsServer({
	isEnterpriseInvoiceMode,
	showBroadcast = true,
	showWebhooks = true,
}: {
	isEnterpriseInvoiceMode?: boolean;
	showBroadcast?: boolean;
	showWebhooks?: boolean;
} = {}) {
	void isEnterpriseInvoiceMode;
	const pathname = usePathname() ?? "";
	const router = useRouter();
	const searchParams = useSearchParams();
	const mobileSelectId = React.useId();
	const logsView = searchParams.get("view") ?? "logs";
	const { toggleSidebar } = useSidebar();
	const tabs = resolveTabs(pathname, { showBroadcast, showWebhooks });
	const activeNav = React.useMemo(
		() => getActiveSettingsNav(pathname, { showBroadcast, showWebhooks }),
		[pathname, showBroadcast, showWebhooks],
	);

	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const linkRefs = React.useRef<Record<string, HTMLAnchorElement | null>>({});
	const [indicator, setIndicator] = React.useState({ left: 0, width: 0, opacity: 0 });

	const matchScore = React.useCallback((t: Tab) => {
		if (t.view) {
			return pathname.startsWith("/settings/usage/logs") && t.view === logsView
				? { exact: true, len: t.href.length }
				: null;
		}
		// Treat the account index route as details, since `/settings/account` redirects.
		if (pathname === "/settings/account" && t.href === "/settings/account/details") {
			return { exact: true, len: t.href.length };
		}

		if (pathname === t.href) return { exact: true, len: t.href.length };
		if (!t.exactOnly && pathname.startsWith(t.href + "/"))
			return { exact: true, len: t.href.length };

		let best = 0;
		for (const prefix of t.match ?? []) {
			if (pathname === prefix || pathname.startsWith(prefix + "/")) {
				best = Math.max(best, prefix.length);
			}
		}
		if (best > 0) return { exact: false, len: best };
		return null;
	}, [logsView, pathname]);

	const navigationHref = React.useCallback((tab: Tab) => {
		if (!tab.view) return tab.href;
		const next = new URLSearchParams(searchParams.toString());
		next.set("view", tab.view);
		next.delete("page");
		return `/settings/usage/logs?${next.toString()}`;
	}, [searchParams]);

	const activeTab =
		tabs && tabs.length > 0
			? tabs
					.map((t) => ({ t, score: matchScore(t) }))
					.filter((x) => x.score !== null)
					.sort((a, b) => {
						if (a.score!.exact !== b.score!.exact) return a.score!.exact ? -1 : 1;
						return b.score!.len - a.score!.len;
					})[0]?.t ?? tabs[0]
			: null;
	const mobileSectionLabel = activeNav?.group.scope === "personal" ? "My account" : "Workspace";

	const setIndicatorToHref = React.useCallback((href: string | null) => {
		const container = containerRef.current;
		if (!container || !href) return;
		const el = linkRefs.current[href];
		if (!el) return;

		const containerRect = container.getBoundingClientRect();
		const rect = el.getBoundingClientRect();
		setIndicator({
			left: rect.left - containerRect.left,
			width: rect.width,
			opacity: 1,
		});
	}, []);

	React.useEffect(() => {
		const update = () => setIndicatorToHref(activeTab?.href ?? null);
		const raf = requestAnimationFrame(update);
		window.addEventListener("resize", update);
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener("resize", update);
		};
	}, [activeTab?.href, setIndicatorToHref]);

	if (!tabs?.length) {
		return (
			<>
				<nav className="flex h-[52px] items-center lg:hidden" aria-label="Settings navigation">
					<Button
						variant="outline"
						className="h-9 w-full justify-start px-3"
						onClick={toggleSidebar}
						aria-haspopup="dialog"
					>
						<PanelLeftIcon className="mr-1.5 h-4 w-4" />
						<span className="truncate">{activeNav?.item.label ?? "Settings"}</span>
					</Button>
				</nav>
				<nav
					className="relative hidden h-[52px] items-end border-b border-border lg:flex"
					aria-label="Settings section navigation"
				>
					<div
						aria-current="page"
						className="flex border-b-2 border-muted-foreground px-2 pb-2 text-sm font-medium text-primary"
					>
						<span className="flex items-center gap-2">
							<span>{activeNav?.item.label ?? "Settings"}</span>
							{activeNav?.item.badge ? (
								<Badge
									variant="outline"
									className="h-5 px-1.5 text-[10px] capitalize"
								>
									{activeNav.item.badge}
								</Badge>
							) : null}
						</span>
					</div>
				</nav>
			</>
		);
	}

	return (
		<>
			<nav className="flex h-[52px] items-center md:hidden" aria-label="Settings section navigation">
				<div className="flex w-full items-center gap-2">
					<Button
						variant="outline"
						className="h-9 max-w-[11rem] shrink-0 px-3"
						onClick={toggleSidebar}
						aria-haspopup="dialog"
					>
						<PanelLeftIcon className="mr-1.5 h-4 w-4" />
						<span className="truncate">{mobileSectionLabel}</span>
					</Button>
					<div className="relative min-w-0 flex-1">
						<label htmlFor={mobileSelectId} className="sr-only">
							Settings subsection
						</label>
						<select
							id={mobileSelectId}
							value={activeTab ? navigationHref(activeTab) : ""}
							onChange={(event) => router.push(event.currentTarget.value)}
							className="h-9 w-full appearance-none rounded-lg border border-border bg-background px-3 pr-9 text-sm font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
						>
							{tabs.map((tab) => (
								<option key={tab.href} value={navigationHref(tab)}>
									{tab.label}
								</option>
							))}
						</select>
						<ChevronDown
							aria-hidden="true"
							className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
						/>
					</div>
				</div>
			</nav>

			<nav
				ref={containerRef}
				className="relative hidden h-[52px] items-end gap-4 border-b border-border md:flex"
				onMouseLeave={() => setIndicatorToHref(activeTab?.href ?? null)}
				aria-label="Settings section navigation"
			>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute bottom-0 h-0.5 rounded bg-muted-foreground transition-[left,width,opacity] duration-200 ease-out"
					style={{
						left: indicator.left,
						width: indicator.width,
						opacity: indicator.opacity,
					}}
				/>

				{tabs.map((tab) => {
					const active = tab.href === activeTab?.href;
					return (
						<Link
							key={tab.href}
							href={navigationHref(tab)}
							prefetch={false}
							aria-current={active ? "page" : undefined}
							ref={(el) => {
								linkRefs.current[tab.href] = el;
							}}
							onMouseEnter={() => setIndicatorToHref(tab.href)}
							onFocus={() => setIndicatorToHref(tab.href)}
							className={cn(
								"pb-2 px-2 text-sm font-medium transition-colors duration-150",
								active ? "text-primary" : "text-muted-foreground hover:text-primary",
							)}
						>
							<span className="flex items-center gap-2">
								<span>{tab.label}</span>
								{tab.badge ? (
									<Badge
										variant="outline"
									className="h-5 px-1.5 text-[10px] capitalize"
									>
										{tab.badge}
									</Badge>
								) : null}
							</span>
						</Link>
					);
				})}
			</nav>
		</>
	);
}
