import "server-only";

export function catalogueGamesEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production")
    return true;
  return /^(1|true|yes)$/i.test(
    process.env.PHASEO_GAMES_PREVIEW_ENABLED?.trim() ?? ""
  );
}
