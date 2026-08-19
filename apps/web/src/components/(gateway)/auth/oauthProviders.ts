export const SOCIAL_PROVIDER_IDS = ["google", "github", "gitlab"] as const;

export type SocialProviderId = (typeof SOCIAL_PROVIDER_IDS)[number];

export function isSocialProviderId(
	value: string | undefined,
): value is SocialProviderId {
	return SOCIAL_PROVIDER_IDS.some((provider) => provider === value);
}
