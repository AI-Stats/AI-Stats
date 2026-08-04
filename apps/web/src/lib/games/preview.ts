import "server-only";

import { catalogueGamesPreviewFlag } from "@/lib/flags";

export async function catalogueGamesEnabled(): Promise<boolean> {
  return catalogueGamesPreviewFlag();
}
