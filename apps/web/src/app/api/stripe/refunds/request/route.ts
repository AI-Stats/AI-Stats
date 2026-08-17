import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { requireActiveTeamStripeCustomer } from "@/lib/server/activeTeamStripe";
import { applyWalletDelta } from "@/lib/billing/walletRepository";
import {
    findPaymentIntentPurchase,
    getWalletBalance,
    hasActivePaymentIntentRefund,
    markRefundLedgerSucceeded,
    sumWorkspaceUsageSince,
    updatePurchaseRefundClaim,
    upsertRefundLedger,
} from "@/lib/database/repositories/billing";

const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000;
const TOP_UP_KINDS = new Set(["top_up", "top_up_one_off", "auto_top_up"]);
const REFUND_REASON_LABELS: Record<string, string> = {
    no_comment: "No comment",
    accidental_purchase: "Accidental purchase",
    duplicate_purchase: "Duplicate purchase",
    wrong_amount: "Wrong amount selected",
    testing_only: "Testing / sandbox use",
    no_longer_needed: "No longer needed",
    other: "Other",
};
const REFUND_REASON_CODES = new Set(Object.keys(REFUND_REASON_LABELS));

function isPaidStatus(status: string | null | undefined): boolean {
    const normalized = String(status ?? "").toLowerCase();
    return normalized === "paid" || normalized === "succeeded";
}

function mapRefundStatus(status?: string | null): string {
    const raw = String(status ?? "").toLowerCase();
    if (!raw) return "Pending";
    if (raw === "succeeded") return "Succeeded";
    if (raw === "failed") return "Failed";
    if (raw === "canceled") return "Canceled";
    if (raw === "pending") return "Pending";
    if (raw === "requires_action") return "Pending";
    return "Pending";
}

function parsePaymentIntentId(body: any): string | null {
    const value = body?.paymentIntentId ?? body?.payment_intent_id ?? null;
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed.startsWith("pi_")) return null;
    return trimmed;
}

function parseRefundReasonCode(body: any): string {
    const value = body?.reason ?? body?.refundReason ?? null;
    if (!value) return "no_comment";
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return "no_comment";
    return REFUND_REASON_CODES.has(normalized) ? normalized : "no_comment";
}

function refundInfoMessage(status: string): string {
    if (status === "succeeded") {
        return "Your refund is confirmed. Most banks post refunds in 5-10 business days.";
    }
    return "Your refund request is processing. Once confirmed, most banks post refunds in 5-10 business days.";
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const paymentIntentId = parsePaymentIntentId(body);
        const refundReasonCode = parseRefundReasonCode(body);
        const refundReasonLabel = REFUND_REASON_LABELS[refundReasonCode] ?? REFUND_REASON_LABELS.no_comment;
        if (!paymentIntentId) {
            return NextResponse.json({ error: "Invalid payment intent id" }, { status: 400 });
        }

        const { workspaceId, customerId, userId } = await requireActiveTeamStripeCustomer();
        const purchase = await findPaymentIntentPurchase(workspaceId, paymentIntentId);
        if (!purchase) {
            return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
        }

        if (!TOP_UP_KINDS.has(String(purchase.kind ?? ""))) {
            return NextResponse.json({ error: "Only credit top-ups can be refunded here" }, { status: 400 });
        }
        if (!isPaidStatus(purchase.status)) {
            return NextResponse.json({ error: "This purchase is not in a refundable state" }, { status: 409 });
        }

        const purchaseTs = new Date(String(purchase.eventTime ?? "")).getTime();
        if (!Number.isFinite(purchaseTs)) {
            return NextResponse.json({ error: "Invalid purchase timestamp" }, { status: 400 });
        }
        if (Date.now() - purchaseTs > REFUND_WINDOW_MS) {
            return NextResponse.json(
                { error: "Self-serve refunds are only available for 24 hours after purchase." },
                { status: 409 }
            );
        }

        const amountNanos = Number(purchase.amountNanos ?? 0);
        const beforeBalanceNanos = Number(purchase.beforeBalanceNanos ?? 0);
        if (!Number.isFinite(amountNanos) || amountNanos <= 0) {
            return NextResponse.json({ error: "Invalid purchase amount" }, { status: 400 });
        }

        if (await hasActivePaymentIntentRefund(workspaceId, paymentIntentId)) {
            return NextResponse.json(
                { error: "A refund for this purchase is already in progress or completed." },
                { status: 409 }
            );
        }

        const usageSincePurchaseNanos = await sumWorkspaceUsageSince(workspaceId, new Date(purchaseTs));

        // Full-lot only: if usage exceeded the pre-purchase balance, this lot has been consumed.
        if (usageSincePurchaseNanos > beforeBalanceNanos) {
            return NextResponse.json(
                {
                    error: "This top-up has already been used, so it is not eligible for self-serve refund.",
                },
                { status: 409 }
            );
        }

        const stripe = getStripe();
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
            expand: ["latest_charge"],
        });

        let originalGrossCents = Number(paymentIntent.amount ?? 0) || 0;
        let refundedGrossCents = 0;
        const latestCharge = paymentIntent.latest_charge;
        if (latestCharge && typeof latestCharge === "object") {
            originalGrossCents = Number((latestCharge as any).amount ?? originalGrossCents) || originalGrossCents;
            refundedGrossCents = Number((latestCharge as any).amount_refunded ?? 0) || 0;
        } else if (typeof latestCharge === "string" && latestCharge.trim().length > 0) {
            const charge = await stripe.charges.retrieve(latestCharge);
            originalGrossCents = Number(charge.amount ?? originalGrossCents) || originalGrossCents;
            refundedGrossCents = Number(charge.amount_refunded ?? 0) || 0;
        }

        const refundableGrossCents = Math.max(0, originalGrossCents - refundedGrossCents);
        if (refundableGrossCents <= 0) {
            return NextResponse.json(
                { error: "This payment no longer has a refundable amount." },
                { status: 409 }
            );
        }

        const refund = await stripe.refunds.create(
            {
                payment_intent: paymentIntentId,
                amount: refundableGrossCents,
                reason: "requested_by_customer",
                metadata: {
                    purpose: "self_serve_unused_lot_refund",
                    workspace_id: workspaceId,
                    user_id: userId,
                    stripe_customer_id: customerId,
                    user_reason: refundReasonLabel,
                    user_reason_code: refundReasonCode,
                },
            },
            {
                idempotencyKey: `self_serve_refund:${workspaceId}:${paymentIntentId}`,
            }
        );

        const refundGrossCents = Number(refund.amount ?? refundableGrossCents) || refundableGrossCents;
        const ratio = originalGrossCents > 0 ? Math.min(1, refundGrossCents / originalGrossCents) : 1;
        const refundNetNanos = Math.max(0, Math.round(amountNanos * ratio));
        const negativeNetNanos = -refundNetNanos;

        const currentBalanceNanos = await getWalletBalance(workspaceId);

        await upsertRefundLedger({
            workspaceId,
            amountNanos: negativeNetNanos,
            beforeBalanceNanos: currentBalanceNanos,
            afterBalanceNanos: currentBalanceNanos,
            refundId: refund.id,
            status: mapRefundStatus(refund.status),
            paymentIntentId,
        });

        let claimStateToWrite = "Requested";
        const status = String(refund.status ?? "pending").toLowerCase();

        if (status === "succeeded" && negativeNetNanos < 0) {
			let deltaRow;
			try {
				deltaRow = await applyWalletDelta(workspaceId, negativeNetNanos);
			} catch (deltaErr) {
				console.warn("[refund.request] inline wallet_apply_delta failed; waiting for webhook reconciliation", {
					workspaceId,
					refundId: refund.id,
					error: deltaErr instanceof Error ? deltaErr.message : String(deltaErr),
				});
			}
			if (deltaRow) {
                const beforeBalanceAfterRefund = Number(deltaRow.before_balance_nanos ?? currentBalanceNanos);
                const afterBalanceAfterRefund = Number(deltaRow.after_balance_nanos ?? currentBalanceNanos);
                claimStateToWrite = "Succeeded";

                await markRefundLedgerSucceeded({
                    refundId: refund.id,
                    beforeBalanceNanos: beforeBalanceAfterRefund,
                    afterBalanceNanos: afterBalanceAfterRefund,
                });
            }
        }

        try {
            await updatePurchaseRefundClaim({
                workspaceId,
                paymentIntentId,
                state: claimStateToWrite,
                reason: refundReasonLabel,
                userId,
            });
        } catch (claimUpdateErr) {
            console.warn("[refund.request] failed to persist refund claim metadata", {
                workspaceId,
                paymentIntentId,
                error: claimUpdateErr instanceof Error ? claimUpdateErr.message : String(claimUpdateErr),
            });
        }

        return NextResponse.json({
            ok: true,
            refundId: refund.id,
            status,
            message: refundInfoMessage(status),
        });
    } catch (err: any) {
        if (err?.message === "unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (err?.message === "missing_team" || err?.message === "missing_stripe_customer") {
            return NextResponse.json({ error: err.message }, { status: 400 });
        }
        return NextResponse.json({ error: err?.message ?? "refund_request_failed" }, { status: 500 });
    }
}
