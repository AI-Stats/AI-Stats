import { getPhaseoAuthSession } from "@/lib/auth/sessionProvider";
import { fetchAccountWebApi } from "@/lib/web-api/client";

export type CreditsTierSummary = {
	lastMonthCents: number;
	mtdCents: number;
	teamTier: "basic" | "enterprise";
};

export async function fetchCreditsTierSummary(
	workspaceId?: string,
): Promise<CreditsTierSummary> {
	const session = await getPhaseoAuthSession();
	if (!session) throw new Error("Cannot fetch credits tier summary without a session");
	const params = new URLSearchParams();
	if (workspaceId) params.set("workspaceId", workspaceId);
	const query = params.toString();
	return fetchAccountWebApi<CreditsTierSummary>(
		`/api/account/credits/tier-summary${query ? `?${query}` : ""}`,
		session.accessToken,
	);
}
