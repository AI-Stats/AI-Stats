import { describe, expect, it } from "vitest";
import { buildGameProfileSummary } from "./profile";
import { gameCompletion } from "./results";

describe("game results", () => {
  it("only completes guessing games on a win or reveal", () => {
    expect(gameCompletion("modele", { guessId: "x" }, { correct: false }, {})).toBeNull();
    expect(gameCompletion("modele", { action: "reveal", attempts: 8 }, { answer: {} }, {})).toEqual({
      won: false,
      score: 0,
      maxScore: 1,
      attempts: 8,
    });
  });

  it("scores sprint ids against server candidates", () => {
    expect(
      gameCompletion(
        "sprint",
        { action: "finish", foundIds: ["a", "a", "not-valid"] },
        {},
        { candidates: [{ id: "a" }, { id: "b" }] }
      )
    ).toEqual({ won: false, score: 1, maxScore: 2, attempts: 1 });
  });

  it("builds per-game totals and a daily streak", () => {
    const summary = buildGameProfileSummary([
      { game_key: "modele", puzzle_date: "2026-07-31", won: true, score: 1, max_score: 1, completed_at: "2026-07-31T10:00:00Z" },
      { game_key: "pricele", puzzle_date: "2026-07-30", won: false, score: 0, max_score: 1, completed_at: "2026-07-30T10:00:00Z" },
    ]);
    expect(summary).toMatchObject({ totalPlayed: 2, totalWins: 1, currentStreak: 2, averageScore: 50 });
    expect(summary.games.find((game) => game.game === "modele")).toMatchObject({ played: 1, wins: 1, bestScore: 100 });
  });
});
