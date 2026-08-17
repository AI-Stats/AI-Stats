import { gatewayRequestCharges, wallets, workspaceSettings } from "@phaseo/db/schema";
import { and, eq } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function getLowBalanceState(workspaceId: string) {
	return withDatabase(async (db) => {
		const [settings] = await db.select({
			low_balance_email_enabled: workspaceSettings.lowBalanceEmailEnabled,
			low_balance_email_threshold_nanos: workspaceSettings.lowBalanceEmailThresholdNanos,
			low_balance_email_last_sent_at: workspaceSettings.lowBalanceEmailLastSentAt,
			low_balance_email_last_sent_balance_nanos: workspaceSettings.lowBalanceEmailLastSentBalanceNanos,
		}).from(workspaceSettings).where(eq(workspaceSettings.workspaceId, workspaceId)).limit(1);
		if (!settings) return null;
		const [wallet] = await db.select({ balance_nanos: wallets.balanceNanos }).from(wallets)
			.where(eq(wallets.workspaceId, workspaceId)).limit(1);
		return { ...settings, balance_nanos: wallet?.balance_nanos ?? null };
	});
}

export async function chargeRequest(args: { workspaceId: string; requestId: string; costNanos: number }) {
	if (!args.workspaceId) throw new Error("missing_workspace_id");
	if (!args.requestId.trim()) throw new Error("missing_request_id");
	if (!Number.isSafeInteger(args.costNanos) || args.costNanos <= 0) throw new Error("invalid_cost_nanos");
	return withDatabase((db) => db.transaction(async (tx) => {
		const now = new Date().toISOString();
		await tx.insert(gatewayRequestCharges).values({
			workspaceId: args.workspaceId, requestId: args.requestId, costNanos: args.costNanos,
			status: "applying", createdAt: now, updatedAt: now,
		}).onConflictDoNothing();
		const [charge] = await tx.select().from(gatewayRequestCharges).where(and(
			eq(gatewayRequestCharges.workspaceId, args.workspaceId),
			eq(gatewayRequestCharges.requestId, args.requestId),
		)).limit(1).for("update");
		if (!charge) throw new Error("gateway_request_charge_row_missing");
		if (charge.costNanos !== args.costNanos) throw new Error("request_charge_amount_mismatch");
		if (charge.status === "applied") return {
			applied: false, already_applied: true, status: charge.deductedStatus ?? "already_applied",
			auto_top_up_amount_nanos: 0, auto_top_up_account_id: null, stripe_customer_id: null,
		};

		const [wallet] = await tx.select().from(wallets).where(eq(wallets.workspaceId, args.workspaceId)).limit(1).for("update");
		let status = "wallet_not_found";
		let autoTopUpAmount = 0;
		let autoTopUpAccountId: string | null = null;
		let stripeCustomerId: string | null = null;
		if (wallet) {
			const nextBalance = wallet.balanceNanos - args.costNanos;
			if (nextBalance < (wallet.reservedNanos ?? 0)) throw new Error("insufficient_unreserved_balance");
			await tx.update(wallets).set({ balanceNanos: nextBalance, updatedAt: now }).where(eq(wallets.workspaceId, args.workspaceId));
			if (wallet.autoTopUpEnabled && nextBalance < wallet.lowBalanceThreshold) {
				status = "top_up_required";
				autoTopUpAmount = wallet.autoTopUpAmount;
				autoTopUpAccountId = wallet.autoTopUpAccountId;
				stripeCustomerId = wallet.stripeCustomerId;
			} else status = "top_up_not_required";
		}
		await tx.update(gatewayRequestCharges).set({
			status: "applied", deductedStatus: status, autoTopUpRequired: status === "top_up_required",
			errorMessage: null, updatedAt: now,
		}).where(and(eq(gatewayRequestCharges.workspaceId, args.workspaceId), eq(gatewayRequestCharges.requestId, args.requestId)));
		return {
			applied: true, already_applied: false, status,
			auto_top_up_amount_nanos: autoTopUpAmount,
			auto_top_up_account_id: autoTopUpAccountId,
			stripe_customer_id: stripeCustomerId,
		};
	}));
}
