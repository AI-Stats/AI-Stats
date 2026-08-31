/** Eligibility means a contract can enable ZDR; it is not evidence that ZDR is active. */
export function resolveEnforcedZdr(
	providerGuarantee: boolean | null | undefined,
	eligibility: string | null | undefined,
): boolean | null {
	if (eligibility === "ineligible") return false;
	return providerGuarantee ?? null;
}
