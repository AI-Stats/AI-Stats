"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";
import { adminClient, twoFactorClient } from "better-auth/client/plugins";

export const BETTER_AUTH_TWO_FACTOR_RETURN_KEY = "phaseoBetterAuthTwoFactorReturn";

export const betterAuthClient = createAuthClient({
	baseURL: typeof window === "undefined" ? undefined : window.location.origin,
	plugins: [
		adminClient(),
		twoFactorClient({
			onTwoFactorRedirect: () => {
				const returnUrl = window.sessionStorage.getItem(BETTER_AUTH_TWO_FACTOR_RETURN_KEY);
				window.sessionStorage.removeItem(BETTER_AUTH_TWO_FACTOR_RETURN_KEY);
				const target = new URL("/auth/verify-mfa", window.location.origin);
				if (returnUrl?.startsWith("/") && !returnUrl.startsWith("//")) {
					target.searchParams.set("returnUrl", returnUrl);
				}
				window.location.assign(`${target.pathname}${target.search}`);
			},
		}),
		passkeyClient(),
	],
});
