import { passkey } from "@better-auth/passkey";
import { expo } from "@better-auth/expo";
import bcrypt from "bcryptjs";
import { APIError, betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin, bearer, magicLink, twoFactor } from "better-auth/plugins";
import type { Pool } from "pg";
import { Resend } from "resend";
import { sso } from "@better-auth/sso";

function requiredEnvironment(name: "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL"): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required when Better Auth is enabled`);
	return value;
}

function trustedOrigins(baseURL: string): string[] {
	const configured = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);
	return [...new Set([baseURL, "phaseo://", "phaseo://*", ...configured])];
}

function socialProviderCredentials(
	provider: "GITHUB" | "GITLAB" | "GOOGLE",
): { clientId: string; clientSecret: string } | undefined {
	const clientId = (
		process.env[`BETTER_AUTH_${provider}_CLIENT_ID`] ??
		process.env[`${provider}_CLIENT_ID`]
	)?.trim();
	const clientSecret = (
		process.env[`BETTER_AUTH_${provider}_CLIENT_SECRET`] ??
		process.env[`${provider}_CLIENT_SECRET`]
	)?.trim();
	if (!clientId && !clientSecret) return undefined;
	if (!clientId || !clientSecret) {
		throw new Error(
			`BETTER_AUTH_${provider}_CLIENT_ID and BETTER_AUTH_${provider}_CLIENT_SECRET must be configured together`,
		);
	}
	return { clientId, clientSecret };
}

async function sendAuthEmail(input: {
	html: string;
	subject: string;
	to: string;
}): Promise<void> {
	const apiKey = process.env.RESEND_API_KEY?.trim();
	if (!apiKey) throw new Error("RESEND_API_KEY is required for authentication email");
	const from = process.env.RESEND_FROM_EMAIL?.trim() || "Phaseo <support@phaseo.ai>";
	const { error } = await new Resend(apiKey).emails.send({ from, ...input });
	if (error) throw new Error(error.message);
}

function safeEmailLink(url: string): string {
	return url.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function safeEmailText(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export function createBetterAuth(database: Pool) {
	const baseURL = requiredEnvironment("BETTER_AUTH_URL");
	return betterAuth({
		appName: "Phaseo",
		baseURL,
		database,
		databaseHooks: {
			user: {
				create: {
					before: async () => {
						if (process.env.BETTER_AUTH_ALLOW_SIGN_UP !== "true") {
							throw new APIError("FORBIDDEN", { message: "Sign up is disabled" });
						}
					},
					after: async (user) => {
						await database.query(
							"insert into auth.users (id) values ($1::uuid) on conflict (id) do nothing",
							[user.id],
						);
					},
				},
				delete: {
					after: async (user) => {
						await database.query("delete from auth.users where id = $1::uuid", [user.id]);
					},
				},
			},
		},
		secret: requiredEnvironment("BETTER_AUTH_SECRET"),
		trustedOrigins: trustedOrigins(baseURL),
		advanced: {
			database: {
				generateId: () => crypto.randomUUID(),
			},
		},
		emailAndPassword: {
			disableSignUp: process.env.BETTER_AUTH_ALLOW_SIGN_UP !== "true",
			enabled: true,
			requireEmailVerification: true,
			sendResetPassword: async ({ user, url }) => {
				await sendAuthEmail({
					to: user.email,
					subject: "Reset your Phaseo password",
					html: `<p>Use the link below to reset your Phaseo password.</p><p><a href="${safeEmailLink(url)}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
				});
			},
			password: {
				hash: (password) => bcrypt.hash(password, 10),
				verify: ({ hash, password }) => bcrypt.compare(password, hash),
			},
		},
		emailVerification: {
			autoSignInAfterVerification: true,
			sendOnSignIn: true,
			sendOnSignUp: true,
			sendVerificationEmail: async ({ user, url }) => {
				await sendAuthEmail({
					to: user.email,
					subject: "Confirm your Phaseo email",
					html: `<p>Confirm this email address for your Phaseo account.</p><p><a href="${safeEmailLink(url)}">Confirm email</a></p><p>If you did not request this, you can ignore this email.</p>`,
				});
			},
		},
		socialProviders: {
			github: socialProviderCredentials("GITHUB"),
			gitlab: socialProviderCredentials("GITLAB"),
			google: socialProviderCredentials("GOOGLE"),
		},
		plugins: [
			expo(),
			admin(),
			bearer(),
			twoFactor({ allowPasswordless: true }),
			magicLink({
				disableSignUp: process.env.BETTER_AUTH_ALLOW_SIGN_UP !== "true",
				sendMagicLink: async ({ email, url }) => {
					await sendAuthEmail({
						to: email,
						subject: "Sign in to Phaseo",
						html: `<p>Use this secure link to sign in to Phaseo.</p><p><a href="${safeEmailLink(url)}">Sign in</a></p><p>If you did not request this, you can ignore this email.</p>`,
					});
				},
			}),
			passkey(),
			sso({
				// Keep enterprise JIT provisioning aligned with the global signup switch.
				disableImplicitSignUp: process.env.BETTER_AUTH_ALLOW_SIGN_UP !== "true",
				providersLimit: 0,
			}),
			nextCookies(),
		],
		user: {
			changeEmail: {
				enabled: true,
				sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
					await sendAuthEmail({
						to: user.email,
						subject: "Confirm your Phaseo email change",
						html: `<p>Confirm changing your Phaseo email address to ${safeEmailText(newEmail)}.</p><p><a href="${safeEmailLink(url)}">Confirm email change</a></p><p>If you did not request this, secure your account immediately.</p>`,
					});
				},
			},
			additionalFields: {
				appMetadata: { input: false, required: false, type: "json" },
				invitedAt: { input: false, required: false, type: "date" },
				lastSignInAt: { input: false, required: false, type: "date" },
				mfaReenrollmentRequired: { defaultValue: false, input: false, required: false, type: "boolean" },
				userMetadata: { input: false, required: false, type: "json" },
			},
		},
	});
}

export type PhaseoBetterAuth = ReturnType<typeof createBetterAuth>;
