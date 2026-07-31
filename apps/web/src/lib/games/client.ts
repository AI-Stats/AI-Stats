import type { DailyPuzzle, GameKey } from "./types";

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      response.status === 404 ? "preview_disabled" : "puzzle_unavailable"
    );
  return response.json() as Promise<T>;
}

export function fetchDailyPuzzle(game: GameKey): Promise<DailyPuzzle> {
  return jsonRequest<DailyPuzzle>(`/api/_web/games/${game}/today`);
}

export function checkPuzzle<T>(
  game: GameKey,
  puzzleId: string,
  payload: Record<string, unknown>
): Promise<T> {
  return jsonRequest<T>(`/api/_web/games/${game}/check`, {
    method: "POST",
    body: JSON.stringify({ puzzleId, ...payload }),
  });
}
