import type { Env } from "@/env";

export function isCutoverWriteFreezeEnabled(env: Pick<Env, "CUTOVER_WRITE_FREEZE">): boolean {
	return env.CUTOVER_WRITE_FREEZE?.trim().toLowerCase() === "true";
}
