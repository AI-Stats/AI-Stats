import type { Env } from "@/env";

const CATALOGUE_GAMES_PREVIEW_GATE = "catalogue_games_preview";

function statsigEnvironmentTier(env: Env): "production" | "staging" | "development" {
  if (env.ENV === "production") return "production";
  if (env.ENV === "preview" || env.ENV === "staging") return "staging";
  return "development";
}

export async function catalogueGamesEnabled(env: Env): Promise<boolean> {
  if (env.ENV === "development" && !env.STATSIG_SERVER_KEY) return true;
  if (!env.STATSIG_SERVER_KEY) return false;

  try {
    const response = await fetch("https://api.statsig.com/v1/check_gate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "statsig-api-key": env.STATSIG_SERVER_KEY,
      },
      body: JSON.stringify({
        gateName: CATALOGUE_GAMES_PREVIEW_GATE,
        user: {
          userID: "catalogue-games-preview",
          statsigEnvironment: { tier: statsigEnvironmentTier(env) },
        },
      }),
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return false;
    const payload = (await response.json().catch(() => null)) as {
      value?: unknown;
      results?: Record<string, { value?: unknown }>;
    } | null;
    if (typeof payload?.value === "boolean") return payload.value;
    return payload?.results?.[CATALOGUE_GAMES_PREVIEW_GATE]?.value === true;
  } catch (error) {
    console.error("[web-api/games] Statsig gate check failed", { error });
    return false;
  }
}
