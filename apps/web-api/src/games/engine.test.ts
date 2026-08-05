import { describe, expect, it } from "vitest";
import { buildPuzzle, evaluatePuzzle } from "./engine";
import type { GameModel } from "./types";

function model(index: number): GameModel {
  return {
    id: `lab/model-${index}`,
    name: `Model ${index}`,
    labSlug: index < 6 ? "shared-lab" : `lab-${index}`,
    labName: index < 6 ? "Shared Lab" : `Lab ${index}`,
    countryCode: index % 2 ? "GB" : "US",
    releaseDate: `202${index % 6}-${String((index % 9) + 1).padStart(
      2,
      "0"
    )}-${String((index % 20) + 1).padStart(2, "0")}`,
    releaseYear: 2020 + (index % 6),
    access: index % 2 ? "open_source" : "proprietary",
    inputModalities: index % 3 ? ["text"] : ["image", "text"],
    outputModalities: ["text"],
    providerCount: index + 1,
    contextLength: (index + 1) * 8_000,
    inputPrice: index + 0.25,
    outputPrice: index + 1.25,
    priceUnit: "1M tokens",
    family: index % 2 ? "odd" : "even",
  };
}

const models = Array.from({ length: 14 }, (_, index) => model(index));

describe("daily catalogue puzzle engine", () => {
  it("builds all five games without exposing Modele's target", () => {
    for (const game of [
      "modele",
      "timeline",
      "pricele",
      "head-to-head",
      "sprint",
    ] as const) {
      const puzzle = buildPuzzle(game, models, 42);
      expect(puzzle.public_payload).toBeTruthy();
      expect(JSON.stringify(puzzle.public_payload)).not.toContain('"target"');
      expect(puzzle.answer_payload).toBeTruthy();
    }
  });

  it("returns factual Modele clues and the answer only for a correct guess", () => {
    const puzzle = buildPuzzle("modele", models, 9);
    const target = puzzle.answer_payload.target as GameModel;
    const wrong = models.find((entry) => entry.id !== target.id) as GameModel;
    const wrongResult = evaluatePuzzle("modele", puzzle.answer_payload, {
      guessId: wrong.id,
    });
    expect(wrongResult.correct).toBe(false);
    expect(wrongResult).not.toHaveProperty("answer");

    const correctResult = evaluatePuzzle("modele", puzzle.answer_payload, {
      guessId: target.id,
    });
    expect(correctResult).toMatchObject({
      correct: true,
      answer: { id: target.id },
    });
  });

  it("scores timeline order and head-to-head answers on the server", () => {
    const timeline = buildPuzzle("timeline", models, 12);
    const order = timeline.answer_payload.orderedIds as string[];
    expect(
      evaluatePuzzle("timeline", timeline.answer_payload, { order })
    ).toMatchObject({
      correct: true,
      score: 5,
    });

    const head = buildPuzzle("head-to-head", models, 12);
    const answers = head.answer_payload.answers as Record<
      string,
      { winner: string }
    >;
    const guesses = Object.fromEntries(
      Object.entries(answers).map(([id, answer]) => [id, answer.winner])
    );
    expect(
      evaluatePuzzle("head-to-head", head.answer_payload, { answers: guesses })
    ).toMatchObject({ score: 5 });
  });

  it("accepts only models in the selected sprint category", () => {
    const sprint = buildPuzzle("sprint", models, 3);
    const candidates = sprint.answer_payload.candidates as Array<{
      id: string;
      name: string;
    }>;
    expect(
      evaluatePuzzle("sprint", sprint.answer_payload, {
        guess: candidates[0]?.name,
      })
    ).toMatchObject({ accepted: true });
    expect(
      evaluatePuzzle("sprint", sprint.answer_payload, {
        guess: "Definitely not a model",
      })
    ).toEqual({ accepted: false });
  });
});
