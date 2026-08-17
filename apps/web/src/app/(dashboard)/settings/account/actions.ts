"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";

import { sendAccountLifecycleDiscordWebhook } from "@/lib/auth/accountLifecycleDiscord";
import { getBetterAuth } from "@/lib/auth/betterAuth";
import { requireServerIdentity } from "@/lib/auth/serverIdentity";
import { normaliseCountryCode } from "@/lib/countryCodes";
import { getPlanetScalePool } from "@/lib/database/planetscale";
import { OBFUSCATE_INFO_COOKIE, serializeObfuscateInfo } from "@/lib/obfuscation";

export async function updateAccount(payload: {
	display_name?: string | null;
	default_workspace_id?: string | null;
	declared_country_code?: string | null;
	obfuscate_info?: boolean;
}) {
	const { user } = await requireServerIdentity();
	const countryCode = payload.declared_country_code === undefined ? undefined : normaliseCountryCode(payload.declared_country_code);
	if (payload.declared_country_code !== undefined && !countryCode) throw new Error("Select a valid country");
	await getPlanetScalePool().query(`
		insert into users (user_id,display_name,default_workspace_id,declared_country_code,country_declared_at,obfuscate_info)
		values ($1::uuid,$2,$3::uuid,$4,case when $4::text is null then null else now() end,$5)
		on conflict (user_id) do update set
			display_name=case when $6 then excluded.display_name else users.display_name end,
			default_workspace_id=case when $7 then excluded.default_workspace_id else users.default_workspace_id end,
			declared_country_code=case when $8 then excluded.declared_country_code else users.declared_country_code end,
			country_declared_at=case when $8 and users.declared_country_code is distinct from excluded.declared_country_code then now() else users.country_declared_at end,
			obfuscate_info=case when $9 then excluded.obfuscate_info else users.obfuscate_info end,
			updated_at=now()
	`, [user.id, payload.display_name ?? null, payload.default_workspace_id ?? null, countryCode ?? null, payload.obfuscate_info ?? false, payload.display_name !== undefined, payload.default_workspace_id !== undefined, payload.declared_country_code !== undefined, payload.obfuscate_info !== undefined]);
	if (payload.obfuscate_info !== undefined) {
		const cookieStore = await cookies();
		cookieStore.set(OBFUSCATE_INFO_COOKIE, serializeObfuscateInfo(payload.obfuscate_info), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
	}
	revalidatePath("/settings/account");
	return { ok: true };
}

export async function deleteAccount() {
	const { user } = await requireServerIdentity();
	await getPlanetScalePool().query(`with legacy_identity as (delete from auth.users where id=$1::uuid returning id) delete from public."user" where id=$1`, [user.id]);
	void sendAccountLifecycleDiscordWebhook({ event: "account_deleted", userId: user.id, email: user.email ?? null, timestampIso: new Date().toISOString() }).catch((error) => {
		console.error("Failed sending account deletion Discord webhook", { userId: user.id, error: error instanceof Error ? error.message : String(error) });
	});
	return { ok: true };
}

export async function changePasswordAction(currentPassword: string, newPassword: string) {
	try {
		await getBetterAuth().api.changePassword({ body: { currentPassword, newPassword, revokeOtherSessions: true }, headers: await headers() });
	} catch (error) {
		const message = error instanceof Error ? error.message : "";
		if (message.toLowerCase().includes("password")) throw new Error("Current password is incorrect");
		throw new Error("Failed to update password");
	}
	revalidatePath("/settings/account");
	return { success: true };
}

export async function changeEmailAction(newEmail: string, currentPassword: string) {
	try {
		const requestHeaders = await headers();
		await getBetterAuth().api.changePassword({ body: { currentPassword, newPassword: currentPassword, revokeOtherSessions: false }, headers: requestHeaders });
		await getBetterAuth().api.changeEmail({ body: { newEmail }, headers: requestHeaders });
	} catch (error) {
		const message = error instanceof Error ? error.message.toLowerCase() : "";
		if (message.includes("password")) throw new Error("Current password is incorrect");
		if (message.includes("email")) throw new Error("This email is already in use");
		throw new Error("Failed to update email");
	}
	revalidatePath("/settings/account");
	return { success: true, message: "Check your new email address to confirm the change" };
}

export async function enrollMFAAction() {
	const data = await getBetterAuth().api.enableTwoFactor({ body: { issuer: "Phaseo" }, headers: await headers() });
	const uri = data.totpURI;
	const secret = new URL(uri).searchParams.get("secret");
	if (!secret) throw new Error("Failed to create MFA secret");
	return { factorId: "better-auth-totp", qrCode: await QRCode.toDataURL(uri, { width: 256, margin: 1 }), secret, uri };
}

export async function verifyMFAEnrollmentAction(_factorId: string, code: string) {
	const requestHeaders = await headers();
	try {
		await getBetterAuth().api.verifyTOTP({ body: { code, trustDevice: false }, headers: requestHeaders });
	} catch {
		throw new Error("Invalid or expired code. Please try again.");
	}
	const current = await getBetterAuth().api.getSession({ headers: requestHeaders });
	if (!current?.user.id) throw new Error("MFA session is unavailable");
	const cleared = await getPlanetScalePool().query('update "user" set "mfaReenrollmentRequired"=false,"updatedAt"=now() where id=$1', [current.user.id]);
	if (cleared.rowCount !== 1) throw new Error("MFA was enabled, but the migration lock could not be cleared");
	revalidatePath("/settings/account");
	revalidatePath("/settings/account/mfa");
	return { success: true };
}

export async function unenrollMFAAction(_factorId: string) {
	await getBetterAuth().api.disableTwoFactor({ body: {}, headers: await headers() });
	revalidatePath("/settings/account");
	revalidatePath("/settings/account/mfa");
	return { success: true };
}

export async function cleanupUnverifiedMFAAction() {
	try {
		await getBetterAuth().api.disableTwoFactor({ body: {}, headers: await headers() });
	} catch {
		// Enrollment cancellation is best-effort.
	}
	return { success: true };
}
