"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { handleOAuthRedirect } from "@/app/(auth)/sign-in/actions";
import { Logo } from "@/components/Logo";
import { beginOAuthAttempt, type OAuthProviderId } from "./oauthPending";

type SocialProviderId = OAuthProviderId;
type LastAuthProvider = SocialProviderId | "email";

const SOCIAL_PROVIDER_IDS: SocialProviderId[] = ["google", "github", "gitlab"];
const LAST_AUTH_PROVIDER_STORAGE_KEY = "phaseo:last-auth-provider";

type ProviderMeta = {
	label: string;
	logoId?: string;
	light?: string;
	dark?: string;
};

const META: Record<SocialProviderId, ProviderMeta> = {
	google: { label: "Google", logoId: "google" },
	github: {
		label: "GitHub",
		light: "/social/github_light.svg",
		dark: "/social/github_dark.svg",
	},
	gitlab: { label: "GitLab", light: "/social/gitlab.svg" },
};

function OAuthSubmitButton({
	meta,
	isLastUsed = false,
	isOAuthPending = false,
}: {
	meta: ProviderMeta;
	isLastUsed?: boolean;
	isOAuthPending?: boolean;
}) {
	const { pending } = useFormStatus();
	const disabled = pending || isOAuthPending;
	return (
		<Button
			type="submit"
			variant="outline"
			aria-label={`Continue with ${meta.label}`}
			className="relative h-12 w-full justify-center gap-2 px-2"
			disabled={disabled}
		>
			{isLastUsed ? (
				<span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium leading-none text-muted-foreground shadow-sm">
					Last Used
				</span>
			) : null}
			<span className="flex items-center justify-center">
				{pending ? (
					<Spinner aria-label={`Opening ${meta.label}`} />
				) : meta.logoId ? (
					<Logo
						id={meta.logoId}
						width={18}
						height={18}
						className="h-[18px] w-[18px] shrink-0"
					/>
				) : (
					<>
						{meta.light ? (
							<Image
								src={meta.light}
								alt={`${meta.label} logo`}
								width={18}
								height={18}
								className="h-[18px] w-[18px] shrink-0 dark:hidden"
							/>
						) : null}
						{(meta.dark ?? meta.light) ? (
							<Image
								src={meta.dark ?? meta.light!}
								alt={`${meta.label} logo`}
								width={18}
								height={18}
								className="hidden h-[18px] w-[18px] shrink-0 dark:block"
							/>
						) : null}
					</>
				)}
			</span>
			<span className="hidden text-sm min-[360px]:inline">
				{meta.label}
			</span>
		</Button>
	);
}

export default function OAuthButtons({
	returnUrl,
}: {
	returnUrl?: string;
}) {
	const [lastUsedProvider, setLastUsedProvider] =
		useState<LastAuthProvider | null>(null);
	const [pendingProvider, setPendingProvider] = useState<SocialProviderId | null>(null);

	useEffect(() => {
		try {
			const stored = window.localStorage.getItem(LAST_AUTH_PROVIDER_STORAGE_KEY);
			if (
				stored === "google" ||
				stored === "github" ||
				stored === "gitlab" ||
				stored === "email"
			) {
				setLastUsedProvider(stored);
			}
		} catch {
			setLastUsedProvider(null);
		}
	}, []);

	useEffect(() => {
		const clearPending = () => setPendingProvider(null);
		window.addEventListener("pageshow", clearPending);
		return () => window.removeEventListener("pageshow", clearPending);
	}, []);

	return (
		<div className="grid grid-cols-3 gap-2.5">
				{SOCIAL_PROVIDER_IDS.map((id) => {
					const meta = META[id];
					return (
						<form
							action={handleOAuthRedirect}
							key={id}
							onSubmit={(event) => {
								const attempt = beginOAuthAttempt(pendingProvider, id);
								if (!attempt.accepted) {
									event.preventDefault();
									return;
								}
								setPendingProvider(attempt.pendingProvider);
								try {
									window.localStorage.setItem(
										LAST_AUTH_PROVIDER_STORAGE_KEY,
										id
									);
								} catch {
									// Ignore storage failures; auth still proceeds.
								}
							}}
						>
							<input type="hidden" name="authFlow" value="signin" />
							<input type="hidden" name="provider" value={id} />
							{returnUrl ? (
								<input type="hidden" name="returnUrl" value={returnUrl} />
							) : null}
							<OAuthSubmitButton
								meta={meta}
								isLastUsed={lastUsedProvider === id}
								isOAuthPending={pendingProvider !== null}
							/>
						</form>
					);
				})}
		</div>
	);
}
