import "server-only";

import { getPlanetScalePool } from "@/lib/database/planetscale";

export type WalletDeltaResult = { before_balance_nanos: number; after_balance_nanos: number };
export type PaymentIntentCreditResult = WalletDeltaResult & { applied: boolean; status: string };

export async function applyWalletDelta(workspaceId: string, deltaNanos: number): Promise<WalletDeltaResult> {
	const result = await getPlanetScalePool().query<WalletDeltaResult>(`
		update billing.wallets set balance_nanos=balance_nanos+$2::bigint,updated_at=now()
		where workspace_id=$1::uuid
		returning (balance_nanos-$2::bigint)::bigint before_balance_nanos,balance_nanos::bigint after_balance_nanos
	`, [workspaceId, deltaNanos]);
	if (!result.rows[0]) throw new Error("wallet_not_found");
	return result.rows[0];
}

export async function applyPaymentIntentCredit(args: {
	workspaceId: string;
	paymentIntentId: string;
	kind: string;
	amountNanos: number;
	eventTime: string;
}): Promise<PaymentIntentCreditResult> {
	if (!args.paymentIntentId.trim()) throw new Error("missing_payment_intent_id");
	if (!Number.isFinite(args.amountNanos) || args.amountNanos <= 0) throw new Error("invalid_amount_nanos");
	const kind = args.kind === "top_up_one_off" ? "top_up_one_off" : args.kind === "auto_top_up" ? "auto_top_up" : "top_up";
	const client = await getPlanetScalePool().connect();
	try {
		await client.query("begin");
		const existing = (await client.query<{
			workspace_id: string | null;
			status: string | null;
			before_balance_nanos: number | null;
			after_balance_nanos: number | null;
		}>(`select workspace_id,status,before_balance_nanos,after_balance_nanos from billing.credit_ledger
			where ref_type='Stripe_Payment_Intent' and ref_id=$1 for update`, [args.paymentIntentId])).rows[0];
		if (existing?.workspace_id && existing.workspace_id !== args.workspaceId) throw new Error("payment_intent_workspace_mismatch");
		if (["paid", "succeeded"].includes(String(existing?.status ?? "").toLowerCase())) {
			await client.query("commit");
			return { applied: false, before_balance_nanos: Number(existing?.before_balance_nanos ?? 0), after_balance_nanos: Number(existing?.after_balance_nanos ?? 0), status: existing?.status ?? "Paid" };
		}
		if (!existing) {
			await client.query(`insert into billing.credit_ledger
				(workspace_id,kind,amount_nanos,before_balance_nanos,after_balance_nanos,ref_type,ref_id,status,event_time)
				values ($1::uuid,$2,0,0,0,'Stripe_Payment_Intent',$3,'Applying',$4::timestamptz)`,
				[args.workspaceId, kind, args.paymentIntentId, args.eventTime]);
		}
		const wallet = (await client.query<WalletDeltaResult>(`update billing.wallets
			set balance_nanos=balance_nanos+$2::bigint,updated_at=now() where workspace_id=$1::uuid
			returning (balance_nanos-$2::bigint)::bigint before_balance_nanos,balance_nanos::bigint after_balance_nanos`,
			[args.workspaceId, args.amountNanos])).rows[0];
		if (!wallet) throw new Error("wallet_not_found");
		await client.query(`update billing.credit_ledger set workspace_id=$1::uuid,kind=$2,amount_nanos=$3::bigint,
			before_balance_nanos=$4::bigint,after_balance_nanos=$5::bigint,status='Paid',event_time=$6::timestamptz
			where ref_type='Stripe_Payment_Intent' and ref_id=$7`,
			[args.workspaceId, kind, args.amountNanos, wallet.before_balance_nanos, wallet.after_balance_nanos, args.eventTime, args.paymentIntentId]);
		await client.query("commit");
		return { applied: true, ...wallet, status: "Paid" };
	} catch (error) {
		await client.query("rollback").catch(() => undefined);
		throw error;
	} finally {
		client.release();
	}
}
