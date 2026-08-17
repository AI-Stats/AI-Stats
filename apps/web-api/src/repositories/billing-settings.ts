import { creditLedger, users, wallets, workspaceSettings, workspaces } from "@phaseo/db/schema";
import { and, desc, eq, gt, inArray } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function getWorkspaceBillingStatus(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [workspace] = await db.select({ name: workspaces.name, slug: workspaces.slug, tier: workspaces.tier, billingMode: workspaces.billingMode })
			.from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
		return workspace ?? null;
	} finally { await client.end({ timeout: 1 }); }
}

export async function loadWorkspaceBillingTransactions(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [[workspace], [wallet], transactions] = await Promise.all([
			db.select({ tier: workspaces.tier, billingMode: workspaces.billingMode }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
			db.select({ stripeCustomerId: wallets.stripeCustomerId }).from(wallets).where(eq(wallets.workspaceId, workspaceId)).limit(1),
			db.select().from(creditLedger).where(eq(creditLedger.workspaceId, workspaceId)).orderBy(desc(creditLedger.eventTime)).limit(250),
		]);
		return { workspace: workspace ?? null, stripeCustomerId: wallet?.stripeCustomerId ?? null, transactions };
	} finally { await client.end({ timeout: 1 }); }
}

export async function loadWorkspaceCreditSettings(env: Env, workspaceId: string, userId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [[wallet], [settings], [latestPayment], [profile]] = await Promise.all([
			db.select().from(wallets).where(eq(wallets.workspaceId, workspaceId)).limit(1),
			db.select({
				lowBalanceEmailEnabled: workspaceSettings.lowBalanceEmailEnabled,
				lowBalanceEmailThresholdNanos: workspaceSettings.lowBalanceEmailThresholdNanos,
				autoTopUpFailureEmailEnabled: workspaceSettings.autoTopUpFailureEmailEnabled,
				paymentMethodExpiringEmailEnabled: workspaceSettings.paymentMethodExpiringEmailEnabled,
			}).from(workspaceSettings).where(eq(workspaceSettings.workspaceId, workspaceId)).limit(1),
			db.select({ eventTime: creditLedger.eventTime }).from(creditLedger).where(and(
				eq(creditLedger.workspaceId, workspaceId),
				eq(creditLedger.refType, "Stripe_Payment_Intent"),
				inArray(creditLedger.status, ["paid", "succeeded"]),
				gt(creditLedger.amountNanos, 0),
			)).orderBy(desc(creditLedger.eventTime)).limit(1),
			db.select({ obfuscateInfo: users.obfuscateInfo, declaredCountryCode: users.declaredCountryCode })
				.from(users).where(eq(users.userId, userId)).limit(1),
		]);
		return { wallet: wallet ?? null, settings: settings ?? null, latestPaymentAt: latestPayment?.eventTime ?? null, profile: profile ?? null };
	} finally { await client.end({ timeout: 1 }); }
}

export async function getAccountObfuscation(env: Env, userId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [profile] = await db.select({ obfuscateInfo: users.obfuscateInfo }).from(users)
			.where(eq(users.userId, userId)).limit(1);
		return profile?.obfuscateInfo === true;
	} finally { await client.end({ timeout: 1 }); }
}
