import type { Env } from "@/env";
import { fetchGameCatalogue } from "./catalogue";
import { buildPuzzle } from "./engine";
import { createGamePuzzle, findGamePuzzle } from "./repository";
import type { GameKey, PuzzleRecord } from "./types";

function utcDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function fallbackSeed(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

async function puzzleSeed(
  env: Env,
  game: GameKey,
  date: string
): Promise<number> {
  const secret = env.HMAC_ENCRYPTION_KEY?.trim();
  if (!secret) return fallbackSeed(`${date}:${game}:catalogue-interaction`);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${date}:${game}`)
  );
  return new DataView(signature).getUint32(0);
}

async function findPuzzle(
  env: Env,
  game: GameKey,
  date: string
): Promise<PuzzleRecord | null> {
  return findGamePuzzle(env, game, date);
}

export async function resolveDailyPuzzle(
  env: Env,
  game: GameKey,
  now = new Date()
): Promise<PuzzleRecord> {
  const date = utcDate(now);
  const existing = await findPuzzle(env, game, date);
  if (existing) return existing;

  const models = await fetchGameCatalogue(env);
  const built = buildPuzzle(game, models, await puzzleSeed(env, game, date));
  const puzzleId = crypto.randomUUID();
  const created = await createGamePuzzle(env, { puzzle_id: puzzleId, game_key: game, puzzle_date: date, public_payload: built.public_payload, answer_payload: built.answer_payload });
  if (created) return created;
  const winner = await findPuzzle(env, game, date);
  if (winner) return winner;
  throw new Error("Puzzle could not be stored");
}
