import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
	const forwardedHeaders = new Headers(request.headers);
	const pathname = request.nextUrl.pathname;
	const hasSession = Boolean(getSessionCookie(request));

	if (!hasSession && pathname.startsWith("/settings")) {
		const url = request.nextUrl.clone();
		url.pathname = "/sign-in";
		url.searchParams.set("returnUrl", pathname + request.nextUrl.search);
		return NextResponse.redirect(url);
	}

	const requiresAccountAccess =
		pathname.startsWith("/settings") ||
		pathname.startsWith("/onboarding") ||
		pathname.startsWith("/chat") ||
		pathname.startsWith("/internal");
	if (hasSession && requiresAccountAccess && pathname !== "/settings/account/mfa") {
		try {
			const sessionUrl = new URL("/api/auth/get-session", request.url);
			const sessionResponse = await fetch(sessionUrl, {
				headers: { Accept: "application/json", Cookie: request.headers.get("cookie") ?? "" },
				cache: "no-store",
				redirect: "error",
				signal: AbortSignal.timeout(3_000),
			});
			const current = sessionResponse.ok
				? await sessionResponse.json() as { user?: { mfaReenrollmentRequired?: boolean } }
				: null;
			if (current?.user?.mfaReenrollmentRequired === true) {
				const url = request.nextUrl.clone();
				url.pathname = "/settings/account/mfa";
				url.searchParams.set("reenroll", "required");
				return NextResponse.redirect(url);
			}
		} catch {
			// Private API requests still validate and fail closed server-side.
		}
	}

	return NextResponse.next({ request: { headers: forwardedHeaders } });
}
