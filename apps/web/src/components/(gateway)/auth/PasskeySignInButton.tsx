"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	BETTER_AUTH_TWO_FACTOR_RETURN_KEY,
	betterAuthClient,
} from "@/lib/auth/betterAuthClient";

export function PasskeySignInButton({
	returnUrl,
	compact = false,
	useBetterAuth: _useBetterAuth = true,
}: {
	returnUrl?: string;
	compact?: boolean;
	useBetterAuth?: boolean;
}) {
	const [pending, setPending] = useState(false);

	async function signIn() {
		setPending(true);
		try {
			const safeReturnUrl =
				returnUrl?.startsWith("/") && !returnUrl.startsWith("//")
					? returnUrl
					: "/";

			const postLogin = new URL("/auth/callback", window.location.origin);
				postLogin.searchParams.set("type", "better-auth");
				if (safeReturnUrl !== "/") postLogin.searchParams.set("returnUrl", safeReturnUrl);
				const postLoginPath = `${postLogin.pathname}${postLogin.search}`;
				window.sessionStorage.setItem(BETTER_AUTH_TWO_FACTOR_RETURN_KEY, postLoginPath);
				const result = await betterAuthClient.signIn.passkey();
				if (result.error) throw new Error(result.error.message);
				window.sessionStorage.removeItem(BETTER_AUTH_TWO_FACTOR_RETURN_KEY);
				window.location.assign(postLoginPath);
			return;
		} catch (error) {
			window.sessionStorage.removeItem(BETTER_AUTH_TWO_FACTOR_RETURN_KEY);
			const message = error instanceof Error ? error.message : "Passkey sign-in failed";
			if (message.includes("passkey_disabled")) {
				toast.error("Passkeys are not enabled for this environment yet.");
			} else if (message.toLowerCase().includes("cancel")) {
				toast.message("Passkey sign-in cancelled.");
			} else {
				toast.error(message);
			}
		} finally {
			setPending(false);
		}
	}

	return (
		<Button type="button" variant="outline" className="h-11 w-full" onClick={signIn} disabled={pending}>
			{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
			{pending ? "Signing in..." : compact ? "Passkey" : "Sign in with a passkey"}
		</Button>
	);
}
