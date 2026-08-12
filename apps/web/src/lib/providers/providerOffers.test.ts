import {
    formatProviderOfferDisplayName,
    resolveProviderDisplayName,
    resolveProviderLogoId,
} from "@/lib/providers/providerOffers";

describe("providerOffers", () => {
    test("keeps Anthropic on AWS offers branded with AWS logos", () => {
        expect(
            resolveProviderLogoId({
                providerId: "anthropic-aws",
                providerFamilyId: "anthropic",
            }),
        ).toBe("aws");
        expect(
            resolveProviderLogoId({
                providerId: "anthropic-aws-us",
                providerFamilyId: "anthropic",
            }),
        ).toBe("aws");
    });

    test("resolves regional and specialized provider logos through their catalog IDs", () => {
        expect(
            resolveProviderLogoId({
                providerId: "nebius-token-factory-fast",
                providerFamilyId: "nebius-token-factory",
            }),
        ).toBe("nebius-token-factory");
        expect(
            resolveProviderLogoId({
                providerId: "openai-eu",
                providerFamilyId: "openai",
            }),
        ).toBe("openai");
    });

    test("uses the Claude Platform for AWS product name", () => {
        expect(
            resolveProviderDisplayName({
                providerId: "anthropic-aws",
                providerName: "Anthropic",
            }),
        ).toBe("Claude Platform for AWS");
        expect(
            formatProviderOfferDisplayName({
                providerId: "anthropic-aws-us",
                providerName: "Anthropic",
                offerLabel: "AWS US",
                offerScope: "regional",
            }),
        ).toBe("Claude Platform for AWS (US)");
    });

    test("formats regional offers with bracketed regions", () => {
        expect(
            formatProviderOfferDisplayName({
                providerId: "anthropic-us",
                providerName: "Anthropic",
                offerLabel: "US",
                offerScope: "regional",
            }),
        ).toBe("Anthropic (US)");
        expect(
            formatProviderOfferDisplayName({
                providerId: "openai-eu",
                providerName: "OpenAI",
                offerLabel: "EU",
                offerScope: "regional",
            }),
        ).toBe("OpenAI (EU)");
    });
});
