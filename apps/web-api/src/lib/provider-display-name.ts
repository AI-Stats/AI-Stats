export type ProviderOfferScope = "global" | "regional" | "specialized";

const DISPLAY_NAME_OVERRIDES = new Map<string, string>([
	["openai", "OpenAI"],
	["openai-eu", "OpenAI"],
	["anthropic", "Anthropic"],
	["anthropic-us", "Anthropic"],
	["anthropic-aws", "Claude Platform for AWS"],
	["anthropic-aws-us", "Claude Platform for AWS"],
]);

function baseProviderName(providerId: string, providerName: string): string {
	return DISPLAY_NAME_OVERRIDES.get(providerId.trim().toLowerCase())
		?? providerName.trim();
}

function regionalLabel(providerName: string, offerLabel: string): string {
	const providerWords = new Set(
		providerName
			.toLowerCase()
			.replace(/[^a-z0-9\s]+/g, " ")
			.split(/\s+/)
			.filter(Boolean),
	);
	return offerLabel
		.replace(/[^a-z0-9\s]+/gi, " ")
		.split(/\s+/)
		.filter(Boolean)
		.filter((word) => !providerWords.has(word.toLowerCase()))
		.join(" ")
		.trim() || offerLabel.trim();
}

export function formatProviderOfferDisplayName(args: {
	providerId: string;
	providerName: string;
	offerLabel?: string | null;
	offerScope?: ProviderOfferScope | null;
}): string {
	const providerName = baseProviderName(args.providerId, args.providerName);
	const offerLabel = String(args.offerLabel ?? "").trim();
	if (!providerName || !offerLabel || args.offerScope === "global") return providerName;
	if (args.offerScope === "regional") {
		return `${providerName} (${regionalLabel(providerName, offerLabel)})`;
	}
	if (DISPLAY_NAME_OVERRIDES.has(args.providerId.trim().toLowerCase())) {
		return providerName;
	}
	return `${providerName} ${offerLabel}`;
}
