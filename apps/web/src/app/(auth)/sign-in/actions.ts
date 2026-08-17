// app/(auth)/sign-in/actions.ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
	configuredAuthOriginsFromEnv,
	resolveAuthCallbackUrl,
	resolveAuthOrigin,
	resolveLocalDevAuthOrigin,
	stripTrailingSlash,
} from "@/lib/auth/authOrigin";
import { sanitizeReturnUrl } from "@/lib/auth/return-url";
import { finalizePostLogin } from "@/lib/auth/post-login";
import {
	buildStartSsoRequest,
	mapSsoAuthErrorMessage,
	type StartSsoInput,
} from "@/lib/auth/sso";
import { samlSsoFlag } from "@/lib/flags";
import { getBetterAuth } from "@/lib/auth/betterAuth";
import { requireServerIdentity } from "@/lib/auth/serverIdentity";

const OAUTH_PROVIDERS = ["google", "github", "gitlab"] as const;
type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export type { StartSsoInput } from "@/lib/auth/sso";

async function resolveSafeReturnUrl(formData: FormData): Promise<string | undefined> {
	const fromForm = sanitizeReturnUrl(formData.get("returnUrl"), "/");
	if (fromForm !== "/") return fromForm;

	const headerStore = await headers();
	const referer = headerStore.get("referer");
	if (!referer) return undefined;

	try {
		const refererUrl = new URL(referer);
		const refererOrigin = stripTrailingSlash(refererUrl.origin);
		const configuredOrigins = configuredAuthOriginsFromEnv();
		const isAllowedRefererOrigin =
			configuredOrigins.length > 0
				? configuredOrigins.includes(refererOrigin)
				: process.env.NODE_ENV !== "production" &&
					refererOrigin ===
						resolveLocalDevAuthOrigin({
							originHeader: headerStore.get("origin"),
							hostHeader:
								headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
						});
		if (!isAllowedRefererOrigin) return undefined;

		const fromReferer = sanitizeReturnUrl(refererUrl.searchParams.get("returnUrl"), "/");
		return fromReferer === "/" ? undefined : fromReferer;
	} catch {
		return undefined;
	}
}

function buildRedirect(pathname: string, params: Record<string, string | undefined>) {
	const url = new URL(pathname, "http://localhost");
	for (const [key, value] of Object.entries(params)) {
		if (value) url.searchParams.set(key, value);
	}
	return `${url.pathname}${url.search}`;
}

function betterAuthPostLoginPath(returnUrl?: string): string {
	return buildRedirect("/auth/callback", {
		returnUrl,
		type: "better-auth",
	});
}

// react-doctor-disable-next-line
export async function handleOAuthRedirect(formData: FormData) {
	const rawProvider = String(formData.get("provider") ?? "google").toLowerCase();
	if (!(OAUTH_PROVIDERS as readonly string[]).includes(rawProvider)) {
		redirect("/error?message=Authentication failed");
	}
	const provider = rawProvider as OAuthProvider;
	const safeReturnUrl = await resolveSafeReturnUrl(formData);
	const result = await getBetterAuth().api.signInSocial({
			body: {
				callbackURL: betterAuthPostLoginPath(safeReturnUrl),
				provider,
			},
			headers: await headers(),
		});
	if (!result.url) redirect("/error?message=Authentication failed");
	redirect(result.url);
}

// react-doctor-disable-next-line
export async function handlePasswordSignIn(formData: FormData) {
	const email = String(formData.get("email") ?? "").trim();
	const password = String(formData.get("password") ?? "");
	const safeReturnUrl = await resolveSafeReturnUrl(formData);
	let requiresTwoFactor = false;
		const postLoginPath = betterAuthPostLoginPath(safeReturnUrl);
		try {
			const result = await getBetterAuth().api.signInEmail({
				body: { email, password, callbackURL: postLoginPath },
				headers: await headers(),
			});
			requiresTwoFactor = Boolean(
				(result as typeof result & { twoFactorRedirect?: boolean })
					.twoFactorRedirect,
			);
		} catch {
			redirect(
				buildRedirect("/sign-in", {
					error: "auth-failed",
					returnUrl: safeReturnUrl,
				}),
			);
		}
		if (requiresTwoFactor) {
			redirect(buildRedirect("/auth/verify-mfa", { returnUrl: postLoginPath }));
		}
	redirect(postLoginPath);
}

/** Completes server-side provisioning after a browser passkey ceremony. */
export async function completePasskeySignIn(returnUrl?: string) {
	const { user } = await requireServerIdentity();
	const result = await finalizePostLogin({
		user,
		returnUrl: sanitizeReturnUrl(returnUrl, "/"),
		source: "server_action",
	});

	return { redirectPath: result.redirectPath };
}

// react-doctor-disable-next-line
export async function startSsoSignIn(input: StartSsoInput) {
	if (!(await samlSsoFlag())) {
		redirect(
			`/error?message=${encodeURIComponent("Single sign-on is not enabled yet.")}`,
		);
	}
	const returnUrl = sanitizeReturnUrl(input.returnUrl, "/");
	const safeReturnUrl = returnUrl === "/" ? undefined : returnUrl;
	const redirectTo = await resolveAuthCallbackUrl(safeReturnUrl);
	let request: ReturnType<typeof buildStartSsoRequest> | null = null;
	let errorRedirectUrl: string | null = null;

	try {
		request = buildStartSsoRequest(input, redirectTo);
	} catch (error) {
		errorRedirectUrl = `/error?message=${encodeURIComponent(mapSsoAuthErrorMessage(error))}`;
	}
	if (errorRedirectUrl) redirect(errorRedirectUrl);
	if (!request) redirect("/error?message=Authentication failed");
	let url: string | undefined;
		try {
			const result = await getBetterAuth().api.signInSSO({
				body: {
					callbackURL: betterAuthPostLoginPath(safeReturnUrl),
					...(request.kind === "oauth"
						? { providerId: request.params.provider }
						: "providerId" in request.params
							? { providerId: request.params.providerId }
							: { domain: request.params.domain }),
				},
				headers: await headers(),
			});
			url = result.url;
		} catch (error) {
			errorRedirectUrl = `/error?message=${encodeURIComponent(mapSsoAuthErrorMessage(error))}`;
		}
		if (errorRedirectUrl) redirect(errorRedirectUrl);
		if (!url) redirect("/error?message=Authentication failed");
	redirect(url);
}

// react-doctor-disable-next-line
export async function handleEnterpriseSsoRedirect(formData: FormData) {
	const domain = String(formData.get("domain") ?? "").trim();
	const returnUrl = String(formData.get("returnUrl") ?? "").trim();
	return startSsoSignIn({
		mode: "saml",
		domain,
		returnUrl: returnUrl || undefined,
	});
}

// react-doctor-disable-next-line
export async function forgotPasswordAction(email: string) {
	const authOrigin = await resolveAuthOrigin();
	await getBetterAuth().api.requestPasswordReset({
			body: {
				email,
				redirectTo: `${authOrigin}/auth/reset-password`,
			},
			headers: await headers(),
		});
	return { success: true };
}
