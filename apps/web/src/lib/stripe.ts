// lib/stripe.ts
import Stripe from "stripe";

export function getStripe(options?: { testMode?: boolean }) {
    const key = options?.testMode
        ? process.env.TEST_STRIPE_SECRET_KEY
        : process.env.STRIPE_SECRET_KEY ?? process.env.TEST_STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY or TEST_STRIPE_SECRET_KEY is missing");
    return new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
}
