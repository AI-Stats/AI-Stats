"use client";

import Image from "next/image";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { handleOAuthRedirect } from "@/app/(auth)/sign-in/actions";
import { Logo } from "@/components/Logo";
import { captureProductEvent } from "@/lib/productAnalytics";
import {
	isSocialProviderId,
	SOCIAL_PROVIDER_IDS,
	type SocialProviderId,
} from "../oauthProviders";

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
	provider,
	meta,
}: {
	provider: SocialProviderId;
	meta: ProviderMeta;
}) {
	const { pending, data } = useFormStatus();
	const isActiveProvider = pending && data?.get("provider") === provider;

	return (
		<Button
			type="submit"
			name="provider"
			value={provider}
			variant="outline"
			aria-label={`Continue with ${meta.label}`}
			className="h-12 w-full justify-center gap-2 px-2"
			disabled={pending}
		>
			<span className="flex items-center justify-center">
				{isActiveProvider ? (
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
	return (
		<div className="grid gap-4">
			<div className="flex items-center gap-2">
				<div className="flex-1 border-t border-border" />
				<span className="px-2 text-sm font-medium">Quick sign-up</span>
				<div className="flex-1 border-t border-border" />
			</div>

			<form
				action={handleOAuthRedirect}
				onSubmit={(event) => {
					const submitter = (event.nativeEvent as SubmitEvent)
						.submitter as HTMLButtonElement | null;
					const provider = submitter?.value;
					if (!isSocialProviderId(provider)) return;
					try {
						window.localStorage.setItem(
							LAST_AUTH_PROVIDER_STORAGE_KEY,
							provider,
						);
					} catch {
						// Ignore storage failures; auth still proceeds.
					}
					captureProductEvent("account_signup_started", {
						method: provider,
					});
				}}
			>
				<input type="hidden" name="authFlow" value="signup" />
				{returnUrl ? (
					<input type="hidden" name="returnUrl" value={returnUrl} />
				) : null}
				<div className="grid grid-cols-3 gap-3">
					{SOCIAL_PROVIDER_IDS.map((id) => {
						const meta = META[id];
						return (
							<div key={id}>
								<OAuthSubmitButton provider={id} meta={meta} />
							</div>
						);
					})}
				</div>
			</form>
		</div>
	);
}
