// Centralised sidebar config used by SettingsSidebar

import type { LucideIcon } from "lucide-react";
import {
	AppWindow,
	BarChart3,
	Beaker,
	Building2,
	Code2,
	CreditCard,
	FileText,
	FolderKey,
	KeyRound,
	RadioTower,
	ShieldCheck,
	User,
	UserCog,
	UserKey,
	Waypoints,
	Webhook,
	Workflow,
} from "lucide-react";

export type NavItem = {
    href: string;
    label: string;
	icon?: LucideIcon;
	children?: NavChildItem[];
    badge?: string;
    disabled?: boolean;
    external?: boolean; // when true, opens in new tab and shows a link icon
	/**
	 * Optional route prefixes that should highlight this item as active.
	 * Useful when the sidebar links to a "section home" but the section has
	 * multiple subpages rendered as tabs.
	 */
	match?: string[];
};

export type NavChildItem = {
	href: string;
	label: string;
	badge?: string;
	exactOnly?: boolean;
	match?: string[];
};

export type NavGroup = {
    heading?: string;
    items: NavItem[];
	scope: SettingsScope;
};

export type SettingsScope = "personal" | "workspace";

export type ResolvedSettingsNav = {
	group: NavGroup;
	item: NavItem;
};

const BASE_SETTINGS_SIDEBAR: NavGroup[] = [
	{
		heading: "General",
		scope: "personal",
		items: [
			{
				href: "/settings/profile",
				label: "Profile",
				icon: User,
				match: ["/settings/profile"],
			},
			{
				href: "/settings/account",
				label: "Account",
				icon: UserCog,
				match: ["/settings/account", "/settings/authorized-apps"],
				children: [
					{ href: "/settings/account/details", label: "Details" },
					{ href: "/settings/account/mfa", label: "MFA" },
					{ href: "/settings/authorized-apps", label: "Connected Apps" },
					{ href: "/settings/account/danger", label: "Danger Zone" },
				],
			},
			{
				href: "/settings/account/workspaces",
				label: "Workspaces",
				icon: Building2,
				match: ["/settings/account/workspaces"],
			},
			{
				href: "/settings/credits",
				label: "Billing",
				icon: CreditCard,
				match: [
					"/settings/credits",
					"/settings/credits/onboarding",
					"/settings/credits/transactions",
					"/settings/payment-methods",
					"/settings/tiers",
				],
				children: [
					{ href: "/settings/credits", label: "Credits", exactOnly: true },
					{ href: "/settings/credits/transactions", label: "Transactions" },
					{ href: "/settings/payment-methods", label: "Payment Methods" },
				],
			},
			{
				href: "/settings/beta",
				label: "Feature Preview",
				icon: Beaker,
				match: ["/settings/beta"],
			},
		],
	},
	{
		heading: "Workspace",
		scope: "workspace",
		items: [
			{
				href: "/settings/workspaces/settings",
				label: "Settings",
				icon: Building2,
				match: [
					"/settings/workspaces",
					"/settings/teams",
					"/settings/workspaces/members",
					"/settings/workspaces/access",
					"/settings/teams/members",
					"/settings/teams/access",
					"/settings/teams/settings",
				],
				children: [
					{ href: "/settings/workspaces/settings", label: "General" },
					{ href: "/settings/workspaces/members", label: "Members" },
					{ href: "/settings/workspaces/access", label: "Access" },
				],
			},
		],
	},
	{
		heading: "Observe",
		scope: "workspace",
		items: [
			{
				href: "/settings/usage",
				label: "Usage",
				icon: BarChart3,
				match: [
					"/settings/usage/overview",
					"/settings/usage/trends",
					"/settings/usage/explore",
					"/settings/usage/geography",
					"/settings/usage/guardrails",
					"/settings/usage/alerts",
				],
				children: [
					{ href: "/settings/usage/overview", label: "Overview" },
					{ href: "/settings/usage/trends", label: "Trends" },
					{ href: "/settings/usage/explore", label: "Explore" },
					{ href: "/settings/usage/geography", label: "Geography" },
					{ href: "/settings/usage/guardrails", label: "Guardrail Activity" },
					{ href: "/settings/usage/alerts", label: "Alerts" },
				],
			},
			{
				href: "/settings/usage/logs",
				label: "Logs",
				icon: FileText,
				match: ["/settings/usage/logs"],
				children: [
					{ href: "/settings/usage/logs/requests", label: "Requests" },
					{ href: "/settings/usage/logs/upstream", label: "Upstream Requests" },
					{ href: "/settings/usage/logs/sessions", label: "Sessions" },
					{ href: "/settings/usage/logs/videos", label: "Videos" },
					{ href: "/settings/usage/logs/batches", label: "Batches" },
				],
			},
		],
	},
	{
		heading: "Gateway",
		scope: "workspace",
		items: [
			{
				href: "/settings/keys",
				label: "API Keys",
				icon: KeyRound,
				match: ["/settings/keys"],
			},
			{
				href: "/settings/management-api-keys",
				label: "Management Keys",
				icon: UserKey,
				match: ["/settings/management-api-keys", "/settings/provisioning-keys"],
			},
			{
				href: "/settings/broadcast",
				label: "Broadcast",
				icon: RadioTower,
				match: ["/settings/broadcast", "/settings/observability"],
			},
			{
				href: "/settings/apps",
				label: "Apps",
				icon: AppWindow,
				match: ["/settings/apps"],
			},
			{
				href: "/settings/routing",
				label: "Routing",
				icon: Waypoints,
				match: ["/settings/routing"],
				children: [
					{ href: "/settings/routing", label: "Routing", exactOnly: true },
					{ href: "/settings/routing/dynamic", label: "Dynamic Routes", match: ["/settings/routing/demo"] },
				],
			},
			{
				href: "/settings/byok",
				label: "Bring Your Own Key",
				icon: FolderKey,
				match: ["/settings/byok"],
			},
			{
				href: "/settings/presets",
				label: "Presets",
				icon: Workflow,
				badge: "Beta",
				match: ["/settings/presets"],
				children: [
					{ href: "/settings/presets", label: "Presets", exactOnly: true },
					{ href: "/settings/presets/experiments", label: "Feedback", badge: "Alpha" },
				],
			},
			{
				href: "/settings/guardrails",
				label: "Safety & privacy",
				icon: ShieldCheck,
				match: ["/settings/guardrails", "/settings/privacy"],
				children: [
					{ href: "/settings/guardrails", label: "Guardrails", badge: "Beta" },
					{ href: "/settings/privacy", label: "Privacy" },
				],
			},
		],
	},
	{
		heading: "Developer",
		scope: "workspace",
		items: [
			{
				href: "/settings/oauth-apps",
				label: "OAuth Apps",
				icon: Code2,
				match: ["/settings/oauth-apps"],
			},
			{
				href: "/settings/webhooks",
				label: "Webhooks",
				icon: Webhook,
				match: ["/settings/webhooks"],
			},
		],
	},

    // Example external group (remove or edit as needed):
    // {
    //   heading: "Resources",
    //   items: [{ href: "https://docs.yoursite.com", label: "Docs", external: true }],
    // },
];

export function getSettingsSidebar(options?: { showBroadcast?: boolean; showWebhooks?: boolean }): NavGroup[] {
	const showBroadcast = options?.showBroadcast ?? true;
	const showWebhooks = options?.showWebhooks ?? true;
	return BASE_SETTINGS_SIDEBAR.map((group) => ({
		...group,
		items: group.items
			.filter((item) =>
				(showBroadcast ? true : item.href !== "/settings/broadcast") &&
				(showWebhooks ? true : item.href !== "/settings/webhooks"),
			)
			.map((item) => ({
				...item,
				children: item.children?.filter((child) =>
					(showBroadcast ? true : !child.href.startsWith("/settings/broadcast")) &&
					(showWebhooks ? true : !child.href.startsWith("/settings/webhooks")),
				),
			})),
	})).filter((group) => group.items.length > 0);
}

export function isSettingsNavChildActive(
	pathname: string,
	child: NavChildItem,
): boolean {
	const childPath = child.href.split("?")[0] ?? child.href;
	if (pathname === childPath) return true;
	if (!child.exactOnly && pathname.startsWith(childPath + "/")) return true;
	return (child.match ?? []).some(
		(prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
	);
}

export function getActiveSettingsNav(
	pathname: string,
	options?: { showBroadcast?: boolean; showWebhooks?: boolean },
): ResolvedSettingsNav | null {
	const navGroups = getSettingsSidebar(options);

	function matchScore(item: NavItem) {
		if (item.disabled || item.external) return null;

		if (pathname === item.href) return { exact: true, len: item.href.length };
		if (pathname.startsWith(item.href + "/"))
			return { exact: true, len: item.href.length };

		let best = 0;
		for (const prefix of item.match ?? []) {
			if (pathname === prefix || pathname.startsWith(prefix + "/")) {
				best = Math.max(best, prefix.length);
			}
		}
		if (best > 0) return { exact: false, len: best };
		return null;
	}

	const matches = navGroups.flatMap((group) =>
		group.items
			.map((item) => ({ group, item, score: matchScore(item) }))
			.filter((entry) => entry.score !== null),
	);

	return (
		matches.sort((a, b) => {
			if (a.score!.exact !== b.score!.exact) return a.score!.exact ? -1 : 1;
			return b.score!.len - a.score!.len;
		})[0] ?? null
	);
}

export const SETTINGS_SIDEBAR: NavGroup[] = getSettingsSidebar({
	showBroadcast: true,
});
