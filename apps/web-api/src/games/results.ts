import type { AuthenticatedUser } from "@/auth/requireUser";
import { getDataClient } from "@/data/supabase";
import type { Env } from "@/env";
import type { GameKey, PuzzleRecord } from "./types";

export type GameCompletion = {
  won: boolean;
  score: number;
  maxScore: number;
  attempts: number | null;
};

function boundedInteger(value: unknown, fallback: number, max = 100): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0
    ? Math.min(number, max)
    : fallback;
}

export function gameCompletion(
  game: GameKey,
  body: Record<string, unknown>,
  result: Record<string, unknown>,
  answerPayload: Record<string, unknown>
): GameCompletion | null {
  if (body.action === "reveal" && game !== "modele" && game !== "pricele")
    return null;
  if (game === "modele" || game === "pricele") {
    if (body.action === "reveal") {
      return {
        won: false,
        score: 0,
        maxScore: 1,
        attempts: boundedInteger(body.attempts, 0),
      };
    }
    if (result.correct !== true) return null;
    return {
      won: true,
      score: 1,
      maxScore: 1,
      attempts: boundedInteger(body.attempts, 1),
    };
  }
  if (game === "timeline") {
    const score = boundedInteger(result.score, 0, 5);
    return { won: result.correct === true, score, maxScore: 5, attempts: 1 };
  }
  if (game === "head-to-head") {
    const maxScore = Object.keys((answerPayload.answers as object | undefined) ?? {}).length;
    const score = boundedInteger(result.score, 0, maxScore);
    return { won: score === maxScore, score, maxScore, attempts: 1 };
  }
  if (body.action !== "finish") return null;
  const candidates = (answerPayload.candidates as Array<{ id: string }> | undefined) ?? [];
  const validIds = new Set(candidates.map((candidate) => candidate.id));
  const foundIds = Array.isArray(body.foundIds) ? new Set(body.foundIds.map(String)) : new Set<string>();
  const score = [...foundIds].filter((id) => validIds.has(id)).length;
  return { won: score === candidates.length, score, maxScore: candidates.length, attempts: 1 };
}

export async function persistGameCompletion(
  env: Env,
  user: AuthenticatedUser,
  puzzle: PuzzleRecord,
  completion: GameCompletion
): Promise<void> {
  const result = await getDataClient(env).from("catalogue_game_results").upsert(
    {
      user_id: user.id,
      game_key: puzzle.game_key,
      puzzle_id: puzzle.puzzle_id,
      puzzle_date: puzzle.puzzle_date,
      won: completion.won,
      score: completion.score,
      max_score: completion.maxScore,
      attempts: completion.attempts,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,game_key,puzzle_date", ignoreDuplicates: true }
  );
  if (result.error) throw new Error(result.error.message);
}
