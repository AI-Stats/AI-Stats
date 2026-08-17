import "server-only";

import { authUsers } from "@phaseo/db/account-schema";
import { creditLedger, emailOutbox, gatewayRequests, keys, managementKeys, wallets, workspaceMembers, workspaceSettings, workspaces } from "@phaseo/db/billing-schema";
import { and, eq, gt, gte, inArray, isNull, ne, or, sql } from "@phaseo/db/query";

import { getDatabase } from "../drizzle";

export async function findPaymentIntentPurchase(workspaceId: string, paymentIntentId: string) {
	return (await getDatabase().select({
		workspaceId: creditLedger.workspaceId,
		eventTime: creditLedger.eventTime,
		refType: creditLedger.refType,
		refId: creditLedger.refId,
		kind: creditLedger.kind,
		status: creditLedger.status,
		amountNanos: creditLedger.amountNanos,
		beforeBalanceNanos: creditLedger.beforeBalanceNanos,
	}).from(creditLedger).where(and(
		eq(creditLedger.workspaceId, workspaceId),
		eq(creditLedger.refType, "Stripe_Payment_Intent"),
		eq(creditLedger.refId, paymentIntentId),
	)).limit(1))[0] ?? null;
}

export async function hasActivePaymentIntentRefund(workspaceId: string, paymentIntentId: string) {
	const count = await getDatabase().$count(creditLedger, and(
		eq(creditLedger.workspaceId, workspaceId),
		eq(creditLedger.kind, "refund"),
		eq(creditLedger.sourceRefType, "Stripe_Payment_Intent"),
		eq(creditLedger.sourceRefId, paymentIntentId),
		inArray(creditLedger.status, ["pending", "Pending", "applying", "processing", "succeeded", "Succeeded"]),
	));
	return count > 0;
}

export async function sumWorkspaceUsageSince(workspaceId: string, createdAt: Date): Promise<number> {
	const row = (await getDatabase().select({
		total: sql<number>`coalesce(sum(${gatewayRequests.costNanos}), 0)`,
	}).from(gatewayRequests).where(and(
		eq(gatewayRequests.workspaceId, workspaceId),
		eq(gatewayRequests.success, true),
		gte(gatewayRequests.createdAt, createdAt.toISOString()),
	)))[0];
	return Number(row?.total ?? 0);
}

export async function getWalletBalance(workspaceId: string): Promise<number> {
	const row = (await getDatabase().select({ balanceNanos: wallets.balanceNanos })
		.from(wallets).where(eq(wallets.workspaceId, workspaceId)).limit(1))[0];
	return Number(row?.balanceNanos ?? 0);
}

export async function upsertRefundLedger(args: {
	workspaceId: string;
	amountNanos: number;
	beforeBalanceNanos: number;
	afterBalanceNanos: number;
	refundId: string;
	status: string;
	paymentIntentId: string;
}): Promise<void> {
	const values = {
		workspaceId: args.workspaceId,
		kind: "refund",
		amountNanos: args.amountNanos,
		beforeBalanceNanos: args.beforeBalanceNanos,
		afterBalanceNanos: args.afterBalanceNanos,
		refType: "Stripe_Refund",
		refId: args.refundId,
		status: args.status,
		eventTime: new Date().toISOString(),
		sourceRefType: "Stripe_Payment_Intent",
		sourceRefId: args.paymentIntentId,
	};
	await getDatabase().insert(creditLedger).values(values).onConflictDoUpdate({
		target: [creditLedger.refType, creditLedger.refId],
		set: values,
	});
}

export async function markRefundLedgerSucceeded(args: {
	refundId: string;
	beforeBalanceNanos: number;
	afterBalanceNanos: number;
}): Promise<void> {
	await getDatabase().update(creditLedger).set({
		beforeBalanceNanos: args.beforeBalanceNanos,
		afterBalanceNanos: args.afterBalanceNanos,
		status: "Succeeded",
		eventTime: new Date().toISOString(),
	}).where(and(eq(creditLedger.refType, "Stripe_Refund"), eq(creditLedger.refId, args.refundId)));
}

export async function updatePurchaseRefundClaim(args: {
	workspaceId: string;
	paymentIntentId: string;
	state: string;
	reason: string;
	userId: string;
}): Promise<void> {
	await getDatabase().update(creditLedger).set({
		refundClaimState: args.state,
		refundClaimReason: args.reason,
		refundClaimedAt: new Date().toISOString(),
		refundClaimedByUserId: args.userId,
	}).where(and(
		eq(creditLedger.workspaceId, args.workspaceId),
		eq(creditLedger.refType, "Stripe_Payment_Intent"),
		eq(creditLedger.refId, args.paymentIntentId),
	));
}

export async function findWalletPaymentSettings(workspaceId: string) {
	return (await getDatabase().select({
		autoTopUpEnabled: wallets.autoTopUpEnabled,
		autoTopUpAccountId: wallets.autoTopUpAccountId,
	}).from(wallets).where(eq(wallets.workspaceId, workspaceId)).limit(1))[0] ?? null;
}

export async function findWorkspaceStripeCustomer(workspaceId: string) {
	return (await getDatabase().select({
		workspaceId: wallets.workspaceId,
		stripeCustomerId: wallets.stripeCustomerId,
	}).from(wallets).where(eq(wallets.workspaceId, workspaceId)).limit(1))[0] ?? null;
}

export type WalletAttribution = {
	workspaceId: string;
	stripeCustomerId: string;
	balanceNanos: number;
};

export async function resolveWalletAttribution(args: {
	workspaceId: string | null;
	stripeCustomerId: string | null;
}): Promise<WalletAttribution | null> {
	const database = getDatabase();
	if (args.workspaceId) {
		const wallet = (await database.select({
			workspaceId: wallets.workspaceId,
			stripeCustomerId: wallets.stripeCustomerId,
			balanceNanos: wallets.balanceNanos,
		}).from(wallets).where(eq(wallets.workspaceId, args.workspaceId)).limit(1))[0];
		if (wallet) {
			if (args.stripeCustomerId && wallet.stripeCustomerId !== args.stripeCustomerId) {
				await database.update(wallets).set({
					stripeCustomerId: args.stripeCustomerId,
					updatedAt: new Date().toISOString(),
				}).where(and(
					eq(wallets.workspaceId, wallet.workspaceId),
					or(eq(wallets.stripeCustomerId, wallet.stripeCustomerId), isNull(wallets.stripeCustomerId)),
				));
				return { ...wallet, stripeCustomerId: args.stripeCustomerId };
			}
			return wallet;
		}
	}
	if (!args.stripeCustomerId) return null;
	const rows = await database.select({
		workspaceId: wallets.workspaceId,
		stripeCustomerId: wallets.stripeCustomerId,
		balanceNanos: wallets.balanceNanos,
	}).from(wallets).where(eq(wallets.stripeCustomerId, args.stripeCustomerId)).limit(2);
	return rows.length === 1 ? rows[0] : null;
}

export async function upsertWorkspaceStripeCustomer(
	workspaceId: string,
	stripeCustomerId: string
): Promise<void> {
	await getDatabase().insert(wallets).values({
		workspaceId,
		stripeCustomerId,
	}).onConflictDoUpdate({
		target: wallets.workspaceId,
		set: {
			stripeCustomerId,
			updatedAt: new Date().toISOString(),
		},
	});
}

export async function updateWalletPaymentSettings(args: {
	workspaceId: string;
	autoTopUpAccountId: string | null;
	autoTopUpEnabled: boolean;
}) {
	await getDatabase().update(wallets).set({
		autoTopUpAccountId: args.autoTopUpAccountId,
		autoTopUpEnabled: args.autoTopUpEnabled,
		updatedAt: new Date().toISOString(),
	}).where(eq(wallets.workspaceId, args.workspaceId));
}

export async function hasPaidWorkspaceAccess(userId: string): Promise<boolean> {
	const memberships = await getDatabase().select({ workspaceId: workspaceMembers.workspaceId })
		.from(workspaceMembers).where(and(eq(workspaceMembers.userId, userId), inArray(workspaceMembers.role, ["owner", "admin"])));
	const workspaceIds = memberships.map((row) => row.workspaceId);
	if (!workspaceIds.length) return false;
	const [topUps, enterprise] = await Promise.all([
		getDatabase().$count(creditLedger, and(inArray(creditLedger.workspaceId, workspaceIds), inArray(creditLedger.kind, ["top_up", "top_up_one_off", "auto_top_up"]), inArray(creditLedger.status, ["Succeeded", "succeeded", "paid", "Paid"]), gt(creditLedger.amountNanos, 0))),
		getDatabase().$count(workspaces, and(inArray(workspaces.id, workspaceIds), eq(workspaces.tier, "enterprise"))),
	]);
	return topUps > 0 || enterprise > 0;
}

export async function getWorkspaceTier(workspaceId: string): Promise<string> {
	const row = (await getDatabase().select({ tier: workspaces.tier }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1))[0];
	return String(row?.tier ?? "basic").toLowerCase();
}

export async function createPaymentIntentProcessingLedger(args: {
	workspaceId: string;
	paymentIntentId: string;
	kind: string;
	balanceNanos: number;
}): Promise<void> {
	await getDatabase().insert(creditLedger).values({
		workspaceId: args.workspaceId,
		kind: args.kind,
		amountNanos: 0,
		beforeBalanceNanos: args.balanceNanos,
		afterBalanceNanos: args.balanceNanos,
		refType: "Stripe_Payment_Intent",
		refId: args.paymentIntentId,
		status: "Processing",
	}).onConflictDoNothing();
}

export async function markPaymentIntentFailed(paymentIntentId: string): Promise<void> {
	await getDatabase().update(creditLedger).set({
		status: "Failed",
		eventTime: new Date().toISOString(),
	}).where(and(
		eq(creditLedger.refType, "Stripe_Payment_Intent"),
		eq(creditLedger.refId, paymentIntentId),
	));
}

export async function findLedgerEntry(refType: string, refId: string) {
	return (await getDatabase().select({
		workspaceId: creditLedger.workspaceId,
		amountNanos: creditLedger.amountNanos,
		beforeBalanceNanos: creditLedger.beforeBalanceNanos,
		afterBalanceNanos: creditLedger.afterBalanceNanos,
		status: creditLedger.status,
	}).from(creditLedger).where(and(
		eq(creditLedger.refType, refType),
		eq(creditLedger.refId, refId),
	)).limit(1))[0] ?? null;
}

export async function syncRefundLedger(args: {
	workspaceId: string;
	refundId: string;
	paymentIntentId: string;
	amountNanos: number;
	status: string;
	balanceNanos: number;
}): Promise<void> {
	const database = getDatabase();
	await database.insert(creditLedger).values({
		workspaceId: args.workspaceId,
		kind: "refund",
		amountNanos: args.amountNanos,
		beforeBalanceNanos: args.balanceNanos,
		afterBalanceNanos: args.balanceNanos,
		refType: "Stripe_Refund",
		refId: args.refundId,
		status: args.status,
		sourceRefType: "Stripe_Payment_Intent",
		sourceRefId: args.paymentIntentId,
	}).onConflictDoNothing();
	await database.update(creditLedger).set({
		amountNanos: args.amountNanos,
		status: args.status,
		sourceRefType: "Stripe_Payment_Intent",
		sourceRefId: args.paymentIntentId,
		eventTime: new Date().toISOString(),
	}).where(and(eq(creditLedger.refType, "Stripe_Refund"), eq(creditLedger.refId, args.refundId)));
}

export async function updateRefundStatus(refundId: string, status: string): Promise<void> {
	await getDatabase().update(creditLedger).set({
		status,
		eventTime: new Date().toISOString(),
	}).where(and(eq(creditLedger.refType, "Stripe_Refund"), eq(creditLedger.refId, refundId)));
}

export async function enqueueAutoTopUpFailure(args: {
	workspaceId: string;
	paymentIntentId: string;
	reason: string;
}): Promise<void> {
	const database = getDatabase();
	const row = (await database.select({
		emailEnabled: workspaceSettings.autoTopUpFailureEmailEnabled,
		workspaceName: workspaces.name,
		ownerUserId: workspaces.ownerUserId,
		ownerEmail: authUsers.email,
	}).from(workspaces)
		.leftJoin(workspaceSettings, eq(workspaceSettings.workspaceId, workspaces.id))
		.innerJoin(authUsers, eq(authUsers.id, workspaces.ownerUserId))
		.where(eq(workspaces.id, args.workspaceId)).limit(1))[0];
	if (!row?.ownerEmail || row.emailEnabled === false) return;
	await database.insert(emailOutbox).values({
		dedupeKey: `auto_top_up_failed:${args.paymentIntentId}`,
		kind: "auto_top_up_failed",
		template: "auto_top_up_failed",
		toEmail: row.ownerEmail,
		subject: "Auto Top-Up failed",
		workspaceId: args.workspaceId,
		userId: row.ownerUserId,
		payload: { workspace_name: row.workspaceName || "your workspace", reason: args.reason },
	}).onConflictDoNothing();
}

export async function countWorkspaceKeys(workspaceId: string, managedChatKeyName: string): Promise<number> {
	const [apiKeys, controlKeys] = await Promise.all([
		getDatabase().$count(keys, and(eq(keys.workspaceId, workspaceId), ne(keys.status, "deleted"), ne(keys.name, managedChatKeyName))),
		getDatabase().$count(managementKeys, eq(managementKeys.workspaceId, workspaceId)),
	]);
	return apiKeys + controlKeys;
}
