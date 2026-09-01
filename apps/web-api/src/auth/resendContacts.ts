import { Resend } from "resend";
import type { Env } from "@/env";

export async function deleteResendContact(env: Env, email: string | null | undefined): Promise<void> {
	const normalizedEmail = String(email ?? "").trim().toLowerCase();
	if (!normalizedEmail) return;
	const apiKey = String(env.RESEND_API_KEY ?? "").trim();
	if (!apiKey) {
		if (env.ENV === "production") throw new Error("missing_resend_api_key");
		return;
	}

	const { error } = await new Resend(apiKey).contacts.remove({ email: normalizedEmail });
	if (!error) return;
	const statusCode = Number((error as { statusCode?: unknown }).statusCode ?? 0);
	if (statusCode === 404) return;
	throw new Error(`resend_contact_delete_failed:${error.name}:${error.message}`);
}
