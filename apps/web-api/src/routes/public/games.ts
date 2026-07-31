import { Hono } from "hono";
import { requireUser } from "@/auth/requireUser";
import type { Env } from "@/env";
import { evaluatePuzzle } from "@/games/engine";
import { gameCompletion, persistGameCompletion } from "@/games/results";
import { resolveDailyPuzzle } from "@/games/store";
import { isGameKey } from "@/games/types";

export const publicGamesRouter = new Hono<{ Bindings: Env }>();

function gamesEnabled(env: Env): boolean {
  if (env.ENV !== "production") return true;
  return /^(1|true|yes)$/i.test(env.PHASEO_GAMES_PREVIEW_ENABLED?.trim() ?? "");
}

publicGamesRouter.use("*", async (c, next) => {
  if (!gamesEnabled(c.env)) return c.json({ error: "not_found" }, 404);
  await next();
});

publicGamesRouter.get("/:game/today", async (c) => {
  const game = c.req.param("game");
  if (!isGameKey(game)) return c.json({ error: "game_not_found" }, 404);
  try {
    const puzzle = await resolveDailyPuzzle(c.env, game);
    return c.json(
      {
        game,
        puzzleId: puzzle.puzzle_id,
        date: puzzle.puzzle_date,
        ...puzzle.public_payload,
      },
      200,
      { "Cache-Control": "private, no-store" }
    );
  } catch (error) {
    console.error("[web-api/games] daily puzzle failed", { game, error });
    return c.json({ error: "puzzle_unavailable" }, 503);
  }
});

publicGamesRouter.post("/:game/check", async (c) => {
  const game = c.req.param("game");
  if (!isGameKey(game)) return c.json({ error: "game_not_found" }, 404);
  let body: Record<string, unknown>;
  try {
    body = await c.req.json<Record<string, unknown>>();
  } catch {
    return c.json({ error: "invalid_request" }, 400);
  }
  try {
    const puzzle = await resolveDailyPuzzle(c.env, game);
    if (body.puzzleId !== puzzle.puzzle_id) {
      return c.json({ error: "puzzle_expired" }, 409);
    }
    const evaluation = evaluatePuzzle(game, puzzle.answer_payload, body);
    const completion = gameCompletion(
      game,
      body,
      evaluation,
      puzzle.answer_payload
    );
    if (completion) {
      const user = await requireUser(c.req.raw, c.env);
      if (user) {
        try {
          await persistGameCompletion(c.env, user, puzzle, completion);
        } catch (error) {
          console.error("[web-api/games] result persistence failed", {
            game,
            userId: user.id,
            error,
          });
        }
      }
    }
    return c.json(evaluation, 200, {
      "Cache-Control": "private, no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("invalid_")) {
      return c.json({ error: error.message }, 400);
    }
    console.error("[web-api/games] puzzle check failed", { game, error });
    return c.json({ error: "puzzle_unavailable" }, 503);
  }
});
