// Purpose: Resolve trusted residency policy floors from regional gateway hostnames.
// Why: A regional hostname must strengthen request routing and fail closed until its infrastructure is active.
// How: Matches an operator-configured hostname and exposes an immutable EU content-path policy.

import type { GatewayBindings } from "@/runtime/env";

export const DEFAULT_EU_CONTENT_PATH_HOSTNAME = "eu.api.phaseo.app";

export type IngressResidencyPolicy = {
	name: "eu_content_path";
	region: "eu";
	hostname: string;
	enabled: boolean;
};

function isEnabled(value: unknown): boolean {
	if (typeof value === "boolean") return value;
	if (typeof value !== "string") return false;
	return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function normalizeHostname(value: unknown): string {
	return String(value ?? "").trim().toLowerCase().replace(/\.$/, "");
}

export function resolveIngressResidencyPolicy(
	request: Request,
	bindings: Partial<GatewayBindings>,
): IngressResidencyPolicy | null {
	const configuredHostname = normalizeHostname(
		bindings.EU_CONTENT_PATH_HOSTNAME ?? DEFAULT_EU_CONTENT_PATH_HOSTNAME,
	);
	if (!configuredHostname) return null;

	let requestHostname: string;
	try {
		requestHostname = normalizeHostname(new URL(request.url).hostname);
	} catch {
		return null;
	}
	if (requestHostname !== configuredHostname) return null;

	return {
		name: "eu_content_path",
		region: "eu",
		hostname: configuredHostname,
		enabled: isEnabled(bindings.EU_CONTENT_PATH_ENABLED),
	};
}
