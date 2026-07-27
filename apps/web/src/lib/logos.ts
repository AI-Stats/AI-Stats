import {
	resolveLogo as resolveBaseLogo,
	listKnownLogos as listBaseKnownLogos,
	getLogoLabel as getBaseLogoLabel,
	getKnownLogoIds as getBaseKnownLogoIds,
	logoManifest as baseLogoManifest,
} from "./logos/index";

import type {
	KnownLogoId as BaseKnownLogoId,
	LogoVariant,
	LogoTheme,
	LogoAssets,
	ResolvedLogo,
	ResolveLogoOptions,
} from "./logos/index";

const modalAssets = {
	color: "/logos/modal.svg",
} as const;

export const logoManifest = {
	...baseLogoManifest,
	modal: modalAssets,
} as const;

export type KnownLogoId = BaseKnownLogoId | "modal";

export function resolveLogo(
	input: string,
	options: ResolveLogoOptions = {}
): ResolvedLogo {
	if (input.toLowerCase() === "modal") {
		return {
			id: undefined,
			label: "Modal",
			src: modalAssets.color,
			variant: "color",
			assets: modalAssets,
		};
	}

	return resolveBaseLogo(input, options);
}

export function listKnownLogos() {
	return [
		...listBaseKnownLogos(),
		{
			id: "modal" as const,
			label: "Modal",
			assets: modalAssets,
		},
	];
}

export function getLogoLabel(id: string): string {
	return id.toLowerCase() === "modal" ? "Modal" : getBaseLogoLabel(id);
}

export function getKnownLogoIds(): KnownLogoId[] {
	return [...getBaseKnownLogoIds(), "modal"];
}

export type {
	LogoVariant,
	LogoTheme,
	LogoAssets,
	ResolvedLogo,
	ResolveLogoOptions,
};
