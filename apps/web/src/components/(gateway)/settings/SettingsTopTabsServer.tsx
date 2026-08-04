"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
	const searchParams = useSearchParams();
	const logsView = searchParams.get("view") ?? "logs";
	const tabs = resolveTabs(pathname, { showBroadcast, showWebhooks });
	const activeNav = React.useMemo(
		() => getActiveSettingsNav(pathname, { showBroadcast, showWebhooks }),
		[pathname, showBroadcast, showWebhooks],
	);

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

	const displayedTabs: Tab[] = tabs?.length
		? tabs
		: [{
			href: (activeNav?.item.href ?? pathname) || "/settings",
			label: activeNav?.item.label ?? "Settings",
			badge: activeNav?.item.badge,
		}];

	return (
		<nav
			className="flex h-[52px] items-end gap-2 overflow-x-auto overscroll-x-contain border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			aria-label="Settings section navigation"
		>
			{displayedTabs.map((tab) => {
				const active = !tabs?.length || tab.href === activeTab?.href;
				return (
					<Link
						key={tab.href}
						href={navigationHref(tab)}
						aria-current={active ? "page" : undefined}
						className={cn(
							"shrink-0 whitespace-nowrap border-b-2 px-2 pb-2 text-sm font-medium transition-colors duration-150",
							active
								? "border-muted-foreground text-primary"
								: "border-transparent text-muted-foreground hover:text-primary",
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
	);
}
