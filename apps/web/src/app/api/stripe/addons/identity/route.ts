import { NextResponse } from "next/server";
import { IDENTITY_ADDON_KEY, identityAddonPricing, isWorkspaceAddonActive } from "@/lib/billing/identityAddon";
import { getStripe } from "@/lib/stripe";
import { requireActiveWorkspaceBillingAdmin, requireActiveWorkspaceStripeCustomer } from "@/lib/server/activeTeamStripe";
import { createAdminClient } from "@/utils/supabase/admin";

const SETTINGS_PATH = "/settings/workspaces/settings";

function settingsUrl(request: Request, result?: string) {
	const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
	const url = new URL(SETTINGS_PATH, base);
	if (result) url.searchParams.set("identity", result);
	return url.toString();
}

async function currentSubscription(workspaceId: string) {
	const { data, error } = await createAdminClient()
		.from("workspace_addon_subscriptions")
		.select("status,current_period_end,cancel_at_period_end,grace_until,metadata,provider_subscription_id")
		.eq("workspace_id", workspaceId)
		.eq("addon_key", IDENTITY_ADDON_KEY)
		.maybeSingle();
	if (error) throw error;
	return data;
}

export async function GET() {
	try {
		const { workspaceId } = await requireActiveWorkspaceBillingAdmin();
		const subscription = await currentSubscription(workspaceId);
		return NextResponse.json({
			active: isWorkspaceAddonActive(subscription),
			status: subscription?.status ?? "not_subscribed",
			cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
			currentPeriodEnd: subscription?.current_period_end ?? null,
			grandfathered: subscription?.metadata?.grandfathered === true,
			price: identityAddonPricing(),
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const status = message === "unauthorized" ? 401 : message === "missing_team" ? 400 : 503;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(request: Request) {
	try {
		const priceId = process.env.STRIPE_IDENTITY_ADDON_PRICE_ID?.trim();
		if (!priceId) return NextResponse.json({ error: "Identity billing is not configured" }, { status: 503 });

		const { workspaceId, customerId } = await requireActiveWorkspaceStripeCustomer({
			createIfMissing: true,
		});
		const existing = await currentSubscription(workspaceId);
		if (isWorkspaceAddonActive(existing)) {
			return NextResponse.json({ error: "Identity is already active" }, { status: 409 });
		}

		const session = await getStripe().checkout.sessions.create({
			mode: "subscription",
			customer: customerId,
			line_items: [{ price: priceId, quantity: 1 }],
			allow_promotion_codes: true,
			billing_address_collection: "required",
			success_url: settingsUrl(request, "success"),
			cancel_url: settingsUrl(request, "canceled"),
			metadata: { workspace_id: workspaceId, addon_key: IDENTITY_ADDON_KEY },
			subscription_data: {
				metadata: { workspace_id: workspaceId, addon_key: IDENTITY_ADDON_KEY },
			},
		});

		return NextResponse.json({ url: session.url });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const status = message === "unauthorized" ? 401 : message === "missing_team" ? 400 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}
