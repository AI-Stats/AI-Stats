import Link from "next/link";
import { Building2 } from "lucide-react";
import OAuthButtons from "./OAuthButtons";
import EmailPassword from "./EmailPassword";
import { PasskeySignInButton } from "./PasskeySignInButton";
import { Button } from "@/components/ui/button";

type SignupNotice = "check-email" | null;

export function Login({
	signupNotice = null,
	authError = null,
	returnUrl,
	ssoEnabled = false,
}: {
	signupNotice?: SignupNotice;
	authError?: "auth-failed" | null;
	returnUrl?: string;
	ssoEnabled?: boolean;
}) {
	const signupNoticeText =
		signupNotice === "check-email"
			? "If an account exists for that email, check your inbox for next steps."
			: null;
	const authErrorText = authError === "auth-failed" ? "Invalid email or password. Please try again." : null;

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-col items-center gap-1.5 text-center">
				<h1 className="text-2xl font-bold">Welcome back</h1>
				<p className="text-sm text-muted-foreground">
					Sign in to your Phaseo account
				</p>
			</div>

			{signupNoticeText ? (
				<p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
					{signupNoticeText}
				</p>
			) : null}
			{authErrorText ? (
				<p
					className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
					role="alert"
					aria-live="polite"
				>
					{authErrorText}
				</p>
			) : null}

			<div className="grid gap-2.5">
				<OAuthButtons returnUrl={returnUrl} />
				<div className={ssoEnabled ? "grid grid-cols-2 gap-2.5" : "grid"}>
					<PasskeySignInButton returnUrl={returnUrl} compact={ssoEnabled} />
					{ssoEnabled ? <Button asChild variant="outline" className="h-11 w-full">
						<Link
							href={
								returnUrl
									? `/sign-in/enterprise?returnUrl=${encodeURIComponent(returnUrl)}`
									: "/sign-in/enterprise"
							}
						>
							<Building2 className="mr-2 h-4 w-4" aria-hidden="true" />
							SSO
						</Link>
					</Button> : null}
				</div>
			</div>
			<EmailPassword returnUrl={returnUrl} />
		</div>
	);
}
