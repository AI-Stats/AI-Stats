import "server-only";

import { createBetterAuth, type PhaseoBetterAuth } from "@/lib/auth/betterAuthConfig";
import { getPlanetScalePool } from "@/lib/database/planetscale";

let instance: PhaseoBetterAuth | undefined;

export function isBetterAuthEnabled(): boolean {
	return true;
}

export function getBetterAuth(): PhaseoBetterAuth {
	if (instance) return instance;
	instance = createBetterAuth(getPlanetScalePool());
	return instance;
}
