export const IDENTITY_ADDON_KEY = "identity";

export type WorkspaceAddonStatus =
	| "incomplete"
	| "incomplete_expired"
	| "trialing"
	| "active"
	| "past_due"
	| "paused"
	| "canceled"
	| "unpaid";

export type IdentityAddonSummary = {
	active: boolean;
	status: WorkspaceAddonStatus | "not_subscribed";
	cancelAtPeriodEnd: boolean;
	currentPeriodEnd: string | null;
	grandfathered: boolean;
	price: {
		currency: "usd";
		monthlyUsd: number;
		includedSsoUsers: number;
		overageUsd: number;
	};
};

export function identityAddonPricing() {
	return {
		currency: "usd" as const,
		monthlyUsd: Number(process.env.IDENTITY_ADDON_MONTHLY_PRICE_USD ?? 99),
		includedSsoUsers: Number(process.env.IDENTITY_ADDON_INCLUDED_SSO_USERS ?? 500),
		overageUsd: Number(process.env.IDENTITY_ADDON_OVERAGE_USD ?? 0.2),
	};
}

export function isWorkspaceAddonActive(row: {
	status?: string | null;
	grace_until?: string | null;
} | null): boolean {
	const status = String(row?.status ?? "").toLowerCase();
	if (status === "active" || status === "trialing") return true;
	if (status !== "past_due" || !row?.grace_until) return false;
	return Date.parse(row.grace_until) > Date.now();
}
