"use client";

import { useState, type SyntheticEvent } from "react";
import { useTranslations } from "next-intl";
import { AuthErrorCard } from "@/components/(gateway)/auth/AuthErrorCard";
import { ForgotPasswordContent } from "@/components/(gateway)/auth/ForgotPasswordDialog";
import { Login } from "@/components/(gateway)/auth/Login";
import { SignUp } from "@/components/(gateway)/auth/sign-up/SignUp";
import { Button } from "@/components/ui/button";

const surfaces = [
	"sign-in",
	"sign-up",
	"reset",
	"reset-sent",
	"error",
] as const;
type PreviewSurface = (typeof surfaces)[number];

const surfaceLabels: Record<PreviewSurface, string> = {
	"sign-in": "Sign in",
	"sign-up": "Sign up",
	reset: "Password reset",
	"reset-sent": "Reset sent",
	error: "Auth error",
};

function preventPreviewAction(event: SyntheticEvent) {
	event.preventDefault();
	event.stopPropagation();
}

export function AuthLocalisationPreview() {
	const [surface, setSurface] = useState<PreviewSurface>("sign-in");
	const shared = useTranslations("Auth.shared");
	const error = useTranslations("Auth.error");

	return (
		<div className="space-y-6">
			<div
				className="flex flex-wrap gap-2"
				role="group"
				aria-label="Authentication preview surface"
			>
				{surfaces.map((candidate) => (
					<Button
						key={candidate}
						type="button"
						variant={surface === candidate ? "default" : "outline"}
						size="sm"
						aria-pressed={surface === candidate}
						onClick={() => setSurface(candidate)}
					>
						{surfaceLabels[candidate]}
					</Button>
				))}
			</div>

			<p id="localisation-preview-readonly" className="text-sm text-muted-foreground">
				Authentication actions are disabled in this review-only preview.
			</p>

			<div
				role="region"
				aria-label="Read-only localized authentication preview"
				aria-describedby="localisation-preview-readonly"
				onClickCapture={preventPreviewAction}
				onSubmitCapture={preventPreviewAction}
				className="mx-auto w-full max-w-sm rounded-xl border bg-background p-6 shadow-sm"
			>
				{surface === "sign-in" ? (
					<Login
						signupNotice="check-email"
						authError="auth-failed"
						ssoEnabled
					/>
				) : null}
				{surface === "sign-up" ? <SignUp /> : null}
				{surface === "reset" ? (
					<ForgotPasswordContent
						email=""
						loading={false}
						success={false}
						readOnly
						onEmailChange={() => undefined}
						onCancel={() => undefined}
						onClose={() => undefined}
						onSubmit={preventPreviewAction}
					/>
				) : null}
				{surface === "reset-sent" ? (
					<ForgotPasswordContent
						email={shared("emailPlaceholder")}
						loading={false}
						success
						readOnly
						onEmailChange={() => undefined}
						onCancel={() => undefined}
						onClose={() => undefined}
						onSubmit={preventPreviewAction}
					/>
				) : null}
				{surface === "error" ? (
					<AuthErrorCard
						heading={error("heading")}
						message={error("workspaceSetup")}
						backToSignInLabel={error("backToSignIn")}
					/>
				) : null}
			</div>
		</div>
	);
}
