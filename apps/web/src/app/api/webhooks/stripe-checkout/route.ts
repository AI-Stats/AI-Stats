import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sendBillingDiscordWebhook } from "@/lib/automations/billingDiscord";
import {
	deriveFirstName,
	sendCreditsPurchasedEvent,
} from "@/lib/automations/resend-events";
import { getStripe } from "@/lib/stripe";
import { readBoundedTextBody } from "@/lib/server/boundedRequestBody";
import { applyPaymentIntentCredit, applyWalletDelta } from "@/lib/billing/walletRepository";
import {
    createPaymentIntentProcessingLedger,
    enqueueAutoTopUpFailure,
    findLedgerEntry,
    getWalletBalance,
    getWorkspaceTier,
    markPaymentIntentFailed,
    markRefundLedgerSucceeded,
    resolveWalletAttribution,
    syncRefundLedger,
    updateRefundStatus,
} from "@/lib/database/repositories/billing";

const TOP_UP_PURPOSES = new Set(["top_up", "top_up_one_off", "auto_top_up", "credits_topup_offsession"]);

function readPaymentIntentPurpose(pi: Stripe.PaymentIntent): string | null {
    const raw = typeof pi.metadata?.purpose === "string" ? pi.metadata.purpose.trim() : "";
    return raw.length > 0 ? raw : null;
}

function toLedgerKind(purpose: string): "top_up" | "top_up_one_off" | "auto_top_up" {
    if (purpose === "top_up_one_off") return "top_up_one_off";
    if (purpose === "auto_top_up" || purpose === "credits_topup_offsession") return "auto_top_up";
    return "top_up";
}

function readPaymentMethodId(pi: Stripe.PaymentIntent): string | null {
    if (typeof pi.payment_method === "string" && pi.payment_method.trim().length > 0) {
        return pi.payment_method;
    }
    if (pi.payment_method && typeof pi.payment_method === "object" && "id" in pi.payment_method) {
        const id = (pi.payment_method as Stripe.PaymentMethod).id;
        return typeof id === "string" && id.trim().length > 0 ? id : null;
    }
    return null;
}

function readTeamIdFromPaymentIntent(pi: Stripe.PaymentIntent): string | null {
    const raw = typeof pi.metadata?.workspace_id === "string" ? pi.metadata.workspace_id.trim() : "";
    return raw.length > 0 ? raw : null;
}

function readCustomerIdFromPaymentIntent(pi: Stripe.PaymentIntent): string | null {
    if (typeof pi.customer === "string" && pi.customer.trim().length > 0) {
        return pi.customer;
    }
    if (pi.customer && typeof pi.customer === "object" && "id" in pi.customer) {
        const id = (pi.customer as Stripe.Customer | Stripe.DeletedCustomer).id;
        return typeof id === "string" && id.trim().length > 0 ? id : null;
    }
    return null;
}

async function resolveCustomerIdentity(
    stripe: Stripe,
    stripeCustomerId: string | null
): Promise<{ email: string | null; firstName: string }> {
    if (!stripeCustomerId) {
        return { email: null, firstName: "" };
    }

    try {
        const customer = await stripe.customers.retrieve(stripeCustomerId);
        if ("deleted" in customer && customer.deleted) {
            return { email: null, firstName: "" };
        }
        const email =
            typeof customer.email === "string" && customer.email.trim().length > 0
            ? customer.email
            : null;
        const firstName = deriveFirstName(customer.name ?? email);
        return { email, firstName };
    } catch (error) {
        console.warn("[stripe-webhook] Failed to resolve customer email", {
            stripeCustomerId,
            error: error instanceof Error ? error.message : String(error),
        });
        return { email: null, firstName: "" };
    }
}

async function resolveCheckoutSessionIdForPaymentIntent(
    stripe: Stripe,
    paymentIntentId: string
): Promise<string | undefined> {
    try {
        const sessions = await stripe.checkout.sessions.list({
            payment_intent: paymentIntentId,
            limit: 1,
        });
        const first = sessions.data[0];
        if (!first?.id) return undefined;
        return first.id;
    } catch (error) {
        console.warn("[stripe-webhook] Failed to resolve checkout session for payment_intent", {
            paymentIntentId,
            error: error instanceof Error ? error.message : String(error),
        });
        return undefined;
    }
}

async function resolveWalletForTopUpPaymentIntent(args: {
    paymentIntentId: string;
    stripeCustomerId: string | null;
    metadataTeamId: string | null;
}) {
    const wallet = await resolveWalletAttribution({
        workspaceId: args.metadataTeamId,
        stripeCustomerId: args.stripeCustomerId,
    });
    if (!wallet) {
        console.warn("[stripe-webhook] Could not uniquely attribute payment intent to a wallet", {
            paymentIntentId: args.paymentIntentId,
            stripeCustomerId: args.stripeCustomerId,
            workspaceId: args.metadataTeamId,
        });
    }
    return wallet;
}

async function ensureReusablePaymentMethod(
    stripe: Stripe,
    customerId: string,
    paymentMethodId: string
): Promise<void> {
    try {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    } catch (err: any) {
        const msg = String(err?.message ?? "");
        // Already attached is fine and expected on retries.
        if (!msg.toLowerCase().includes("already attached")) {
            throw err;
        }
    }

    const customer = await stripe.customers.retrieve(customerId);
    if ("deleted" in customer && customer.deleted) return;

    const defaultPm = customer.invoice_settings?.default_payment_method;
    const defaultPmId = typeof defaultPm === "string" ? defaultPm : (defaultPm as Stripe.PaymentMethod | null)?.id;

    if (!defaultPmId) {
        await stripe.customers.update(customerId, {
            invoice_settings: { default_payment_method: paymentMethodId },
        });
    }
}

function getWebhookSecret(): string {
    const raw = process.env.STRIPE_WEBHOOK_SECRET;
    const secret = typeof raw === "string" ? raw.trim().replace(/^["']|["']$/g, "") : "";
    if (!secret) throw new Error("Stripe webhook signing secret missing");
    return secret;
}

function redactSecret(secret: string): string {
    if (!secret) return "<empty>";
    if (secret.length <= 12) return `${secret.slice(0, 4)}...`;
    return `${secret.slice(0, 7)}...${secret.slice(-4)}`;
}

function summarizeStripeSignatureHeader(signature: string) {
    const parts = signature
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    const timestamp = parts.find((part) => part.startsWith("t=")) ?? null;
    const v1 = parts.filter((part) => part.startsWith("v1="));

    return {
        present: signature.length > 0,
        timestamp,
        v1Count: v1.length,
    };
}

async function enqueueAutoTopUpFailureFromWebhook(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const workspaceId = readTeamIdFromPaymentIntent(paymentIntent);
    if (!workspaceId) return;
    const reason = String(
        paymentIntent.last_payment_error?.message ?? "The saved payment method could not be charged.",
    ).slice(0, 500);
    await enqueueAutoTopUpFailure({ workspaceId, paymentIntentId: paymentIntent.id, reason });
}

/* Fees: Reverse-engineer the original amount from the total received, then apply the flat top-up fee. */
function computeNetAndFeeFromGross(grossNanos: number, feePct: number) {
    const minFeeNanos = 1_000_000_000; // $1 in nanos

    // Reverse-engineer: if user paid $X total including our fee, what was the original amount?
    // Original = Total / (1 + fee_rate)
    const originalNanos = Math.round(grossNanos / (1 + feePct / 100));
    const feeNanos = grossNanos - originalNanos;

    // Ensure minimum fee when percentage fee falls below $1
    if (feeNanos < minFeeNanos) {
        const adjustedFeeNanos = Math.min(grossNanos, minFeeNanos);
        const adjustedOriginalNanos = Math.max(grossNanos - adjustedFeeNanos, 0);
        return { netNanos: adjustedOriginalNanos, feeNanos: adjustedFeeNanos };
    }

    return { netNanos: originalNanos, feeNanos };
}

function mapStripeRefundStatus(status?: string | null): "Pending" | "Succeeded" | "Failed" | "Canceled" {
    const normalized = String(status ?? "").toLowerCase();
    if (normalized === "succeeded") return "Succeeded";
    if (normalized === "failed") return "Failed";
    if (normalized === "canceled" || normalized === "cancelled") return "Canceled";
    return "Pending";
}

const MAX_STRIPE_WEBHOOK_BYTES = 1024 * 1024;

export async function POST(req: Request) {
    const stripe = getStripe();

    // IMPORTANT: read raw body for signature verification
    const boundedBody = await readBoundedTextBody(req, MAX_STRIPE_WEBHOOK_BYTES);
    if (!boundedBody.ok) {
        return new Response("Webhook body too large", { status: 413 });
    }
    const rawBody = boundedBody.text;
    const signature = req.headers.get("stripe-signature") ?? "";
    const signatureSummary = summarizeStripeSignatureHeader(signature);

    let event: Stripe.Event;
    try {
        const webhookSecret = getWebhookSecret();
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
        const configuredSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
        const normalizedSecret =
            typeof configuredSecret === "string"
                ? configuredSecret.trim().replace(/^["']|["']$/g, "")
                : "";
        console.error("[stripe-webhook] Signature verification failed", {
            error: err?.message ?? String(err),
            bodyLength: rawBody.length,
            hasStripeSignatureHeader: signatureSummary.present,
            signatureTimestamp: signatureSummary.timestamp,
            signatureV1Count: signatureSummary.v1Count,
            configuredSecretLength: normalizedSecret.length,
            configuredSecretPreview: redactSecret(normalizedSecret),
        });
        return NextResponse.json(
            { message: `Webhook Error: ${err?.message || String(err)}` },
            { status: 400 }
        );
    }

    try {
        switch (event.type) {
            case "payment_intent.created": {
                const pi = event.data.object as Stripe.PaymentIntent;
                const purpose = readPaymentIntentPurpose(pi);
                if (!purpose || !TOP_UP_PURPOSES.has(purpose)) break;

                const stripeCustomerId = readCustomerIdFromPaymentIntent(pi);
                const metadataTeamId = readTeamIdFromPaymentIntent(pi);

                const wallet = await resolveWalletForTopUpPaymentIntent({
                    paymentIntentId: pi.id,
                    stripeCustomerId,
                    metadataTeamId,
                });

                if (!wallet?.workspaceId) break;

                await createPaymentIntentProcessingLedger({
                    workspaceId: wallet.workspaceId,
                    paymentIntentId: pi.id,
                    kind: toLedgerKind(purpose),
                    balanceNanos: Number(wallet.balanceNanos ?? 0),
                });

                break;
            }

            case "payment_intent.succeeded": {
                const pi = event.data.object as Stripe.PaymentIntent;
                if (pi.status !== "succeeded") break;
                const purpose = readPaymentIntentPurpose(pi);
                if (!purpose || !TOP_UP_PURPOSES.has(purpose)) {
                    console.warn("[stripe-webhook] Ignored payment_intent.succeeded with unsupported purpose", {
                        paymentIntentId: pi.id,
                        purpose: purpose ?? null,
                    });
                    break;
                }

                const stripeCustomerId = readCustomerIdFromPaymentIntent(pi);
                const paymentMethodId = readPaymentMethodId(pi);
                const metadataTeamId = readTeamIdFromPaymentIntent(pi);

                const wallet = await resolveWalletForTopUpPaymentIntent({
                    paymentIntentId: pi.id,
                    stripeCustomerId,
                    metadataTeamId,
                });

                if (!wallet?.workspaceId) break;

                const grossCents = Number(pi.amount_received ?? pi.amount ?? 0);
                // Stripe amounts are in cents; convert to nanos (1 USD = 1e9 nanos).
                const grossNanos = grossCents * 10_000_000;

                // PAYG top-up fee is now a flat 5% across tiers.
                const tier = await getWorkspaceTier(wallet.workspaceId);
                const feePct = 5.0;

                console.log(`[stripe-webhook] Workspace ${wallet.workspaceId} tier: ${tier}, fee: ${feePct}%`);

                if (paymentMethodId && stripeCustomerId) {
                    try {
                        await ensureReusablePaymentMethod(stripe, stripeCustomerId, paymentMethodId);
                    } catch (pmErr) {
                        console.warn("[stripe-webhook] Failed to attach/set default payment method", {
                            paymentIntentId: pi.id,
                            customerId: stripeCustomerId,
                            paymentMethodId,
                            error: String((pmErr as any)?.message ?? pmErr),
                        });
                    }
                }

                const { netNanos, feeNanos } = computeNetAndFeeFromGross(grossNanos, feePct);
                const kind = toLedgerKind(purpose);
                const applied = await applyPaymentIntentCredit({
                    workspaceId: wallet.workspaceId,
                    paymentIntentId: pi.id,
                    kind,
                    amountNanos: netNanos,
                    eventTime: new Date().toISOString(),
                });

                if (!applied.applied) {
                    console.log("[stripe-webhook] Duplicate payment_intent.succeeded ignored", {
                        paymentIntentId: pi.id,
                    });
                    break;
                }

                const beforeBalanceNanos = Number(applied.before_balance_nanos ?? 0);
                const afterBalanceNanos = Number(applied.after_balance_nanos ?? 0);
                const netUsd = (netNanos / 1_000_000_000).toFixed(2);
                const feeUsd = (feeNanos / 1_000_000_000).toFixed(2);
                const beforeUsd = (beforeBalanceNanos / 1_000_000_000).toFixed(2);
                const afterUsd = (afterBalanceNanos / 1_000_000_000).toFixed(2);

                console.log(
                    `[stripe-webhook] Payment credited net=$${netUsd} fee=$${feeUsd} balance_before=$${beforeUsd} balance_after=$${afterUsd}`
                );

                const customerIdentity = await resolveCustomerIdentity(stripe, stripeCustomerId);
                const creditedAtIso = new Date().toISOString();
                const checkoutSessionId = await resolveCheckoutSessionIdForPaymentIntent(stripe, pi.id);
                const creditsPurchasedPayload = {
                    workspaceId: wallet.workspaceId,
                    paymentIntentId: pi.id,
                    firstName: customerIdentity.firstName,
                    checkoutSessionId,
                    currency: String(pi.currency ?? "usd").toLowerCase(),
                    amountNanos: netNanos,
                    kind,
                    creditedAtIso,
                };
                if (customerIdentity.email) {
                    try {
                        await sendCreditsPurchasedEvent({
                            email: customerIdentity.email,
                            payload: creditsPurchasedPayload,
                        });
                    } catch (error) {
                        console.error("[stripe-webhook] Failed sending credits.purchased event", {
                            paymentIntentId: pi.id,
                            workspaceId: wallet.workspaceId,
                            checkoutSessionId: checkoutSessionId ?? null,
                            error: error instanceof Error ? error.message : String(error),
                        });
                    }
                }
                try {
                    await sendBillingDiscordWebhook({
                        event: "credits_purchased",
                        email: customerIdentity.email,
                        payload: creditsPurchasedPayload,
                    });
                } catch (error) {
                    console.error("[stripe-webhook] Failed sending billing Discord webhook", {
                        paymentIntentId: pi.id,
                        workspaceId: wallet.workspaceId,
                        checkoutSessionId: checkoutSessionId ?? null,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }

                break;
            }

            case "payment_intent.payment_failed": {
                const pi = event.data.object as Stripe.PaymentIntent;
                const purpose = readPaymentIntentPurpose(pi);
                if (!purpose || !TOP_UP_PURPOSES.has(purpose)) break;

                await markPaymentIntentFailed(pi.id);

                if (purpose === "auto_top_up" || purpose === "credits_topup_offsession") {
                    await enqueueAutoTopUpFailureFromWebhook(pi);
                }
                break;
            }

            case "refund.created": {
                const refund = event.data.object as Stripe.Refund;
                const piId = (refund.payment_intent as string) ?? null;
                if (!piId) break;

                const piLedger = await findLedgerEntry("Stripe_Payment_Intent", piId);

                const workspaceId = piLedger?.workspaceId ?? null;
                if (!workspaceId) {
                    console.warn("[stripe-webhook] refund.created: no matching payment ledger entry", {
                        refundId: refund.id,
                        paymentIntentId: piId,
                    });
                    break;
                }

                const originalNetNanos = Number(piLedger?.amountNanos ?? 0);

                const pi = await stripe.paymentIntents.retrieve(piId);
                const originalGrossCents = Number(pi.amount_received ?? pi.amount ?? 0) || 0;
                const originalGrossNanos = originalGrossCents * 10_000_000;
                const refundGrossCents = Number(refund.amount ?? 0) || 0;
                const refundGrossNanos = refundGrossCents * 10_000_000;

                const ratio = originalGrossNanos > 0 ? Math.min(1, refundGrossNanos / originalGrossNanos) : 1;
                const refundNetNanos = Math.max(0, Math.round(originalNetNanos * ratio));
                const negativeNetNanos = -refundNetNanos;
                const mappedStatus = mapStripeRefundStatus(refund.status);

                const currentBalance = await getWalletBalance(workspaceId);
                await syncRefundLedger({
                    workspaceId,
                    refundId: refund.id,
                    paymentIntentId: piId,
                    amountNanos: negativeNetNanos,
                    status: mappedStatus,
                    balanceNanos: currentBalance,
                });

                if (mappedStatus === "Succeeded") {
                    const refRow = await findLedgerEntry("Stripe_Refund", refund.id);

                    const priorStatus = String(refRow?.status ?? "").toLowerCase();
                    const priorBefore = Number(refRow?.beforeBalanceNanos ?? 0);
                    const priorAfter = Number(refRow?.afterBalanceNanos ?? 0);
                    const alreadyApplied = priorStatus === "succeeded" && priorBefore !== priorAfter;

                    if (!alreadyApplied) {
                        const applyTeamId = refRow?.workspaceId ?? workspaceId;
                        const applyDeltaNanos = Number(refRow?.amountNanos ?? negativeNetNanos);

                        if (applyTeamId && applyDeltaNanos < 0) {
                            let balanceResult;
                            try {
                                balanceResult = await applyWalletDelta(applyTeamId, applyDeltaNanos);
                            } catch (deltaErr) {
                                console.error("[stripe-webhook] wallet_apply_delta failed for refund.created", {
                                    refundId: refund.id,
                                    workspaceId: applyTeamId,
                                    error: deltaErr instanceof Error ? deltaErr.message : String(deltaErr),
                                });
                                throw deltaErr;
                            }
                            const beforeBalanceNanos = Number(balanceResult.before_balance_nanos ?? priorBefore);
                            const afterBalanceNanos = Number(balanceResult.after_balance_nanos ?? priorAfter);

                            await markRefundLedgerSucceeded({
                                refundId: refund.id,
                                beforeBalanceNanos,
                                afterBalanceNanos,
                            });
                        }
                    }
                }

                break;
            }

            case "refund.updated": {
                const refund = event.data.object as Stripe.Refund;
                const status = refund.status as string | undefined;
                const existingRefundRow = await findLedgerEntry("Stripe_Refund", refund.id);

                const priorStatus = String(existingRefundRow?.status ?? "").toLowerCase();
                const priorBefore = Number(existingRefundRow?.beforeBalanceNanos ?? 0);
                const priorAfter = Number(existingRefundRow?.afterBalanceNanos ?? 0);
                const alreadyApplied = priorStatus === "succeeded" && priorBefore !== priorAfter;

                await updateRefundStatus(
                    refund.id,
                    status === "succeeded"
                        ? "Succeeded"
                        : status === "failed"
                            ? "Failed"
                            : status === "canceled"
                                ? "Canceled"
                                : String(status ?? "Pending"),
                );

                if (status === "succeeded" && !alreadyApplied) {
                    const workspaceId = existingRefundRow?.workspaceId ?? null;
                    const refundNetNegativeNanos = Number(existingRefundRow?.amountNanos ?? 0);

                    if (workspaceId && refundNetNegativeNanos < 0) {
                        let balanceResult;
                        try {
                            balanceResult = await applyWalletDelta(workspaceId, refundNetNegativeNanos);
                        } catch (deltaErr) {
                            console.error("[stripe-webhook] wallet_apply_delta failed for refund", {
                                refundId: refund.id,
                                workspaceId,
                                error: deltaErr instanceof Error ? deltaErr.message : String(deltaErr),
                            });
                            throw deltaErr;
                        }
                        const beforeBalanceNanos = Number(balanceResult.before_balance_nanos ?? 0);
                        const afterBalanceNanos = Number(balanceResult.after_balance_nanos ?? 0);

                        await markRefundLedgerSucceeded({
                            refundId: refund.id,
                            beforeBalanceNanos,
                            afterBalanceNanos,
                        });
                    }
                }

                break;
            }

            default:
                return NextResponse.json({ ignored: true });
        }

        return NextResponse.json({ received: true });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
    }
}
