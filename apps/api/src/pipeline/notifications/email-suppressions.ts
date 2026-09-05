import { getSupabaseAdmin } from "@/runtime/env";

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export async function hashDeliveryEmail(email: string): Promise<string> {
	const normalized = normalizeEmail(email);
	if (!normalized || !normalized.includes("@")) throw new Error("invalid_recipient_email");
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getEmailSuppressionReason(email: string): Promise<string | null> {
	const recipientHash = await hashDeliveryEmail(email);
	const result = await getSupabaseAdmin()
		.from("email_delivery_suppressions")
		.select("reason")
		.eq("recipient_email_hash", recipientHash)
		.maybeSingle();
	if (result.error) throw new Error(`email_suppression_lookup_failed:${result.error.message}`);
	return typeof result.data?.reason === "string" ? result.data.reason : null;
}
