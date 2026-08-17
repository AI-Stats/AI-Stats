import type { GatewayBindings } from "@/runtime/env";

export function isCutoverWriteFreezeEnabled(env: Pick<GatewayBindings, "CUTOVER_WRITE_FREEZE">): boolean {
	return env.CUTOVER_WRITE_FREEZE?.trim().toLowerCase() === "true";
}
