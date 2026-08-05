import type { BuiltPuzzle, GameKey, GameModel, ModelCandidate } from "./types";
import { toCandidate } from "./types";

type Direction = "correct" | "higher" | "lower" | "unknown";
type Match = "correct" | "partial" | "wrong" | "unknown";

const ACCESS_LABELS = {
  open_source: "Open source",
  open_weights: "Open weights",
  proprietary: "Proprietary",
  unknown: "Unknown",
} as const;

function createRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let output = value;
    output = Math.imul(output ^ (output >>> 15), output | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
    return ((output ^ (output >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffle<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [
      result[swapIndex] as T,
      result[index] as T,
    ];
  }
  return result;
}

function pick<T>(values: T[], random: () => number): T {
  const value = values[Math.floor(random() * values.length)];
  if (value == null)
    throw new Error("No eligible catalogue entries for puzzle");
  return value;
}

function numericDirection(
  guess: number | null,
  target: number | null
): Direction {
  if (guess == null || target == null) return "unknown";
  if (guess === target) return "correct";
  return target > guess ? "higher" : "lower";
}

function exactMatch(guess: string | null, target: string | null): Match {
  if (!guess || !target || guess === "unknown" || target === "unknown")
    return "unknown";
  return guess === target ? "correct" : "wrong";
}

function listMatch(guess: string[], target: string[]): Match {
  if (guess.length === 0 || target.length === 0) return "unknown";
  const guessSet = new Set(guess);
  const targetSet = new Set(target);
  if (
    guessSet.size === targetSet.size &&
    [...guessSet].every((value) => targetSet.has(value))
  ) {
    return "correct";
  }
  return [...guessSet].some((value) => targetSet.has(value))
    ? "partial"
    : "wrong";
}

function modeleEligible(model: GameModel): boolean {
  return Boolean(
    model.countryCode &&
      model.releaseYear &&
      model.access !== "unknown" &&
      model.inputModalities.length &&
      model.outputModalities.length
  );
}

function priceleEligible(model: GameModel): boolean {
  return (
    model.inputPrice != null &&
    model.outputPrice != null &&
    model.inputModalities.includes("text") &&
    model.outputModalities.includes("text")
  );
}

function candidateList(models: GameModel[]): ModelCandidate[] {
  return models
    .map(toCandidate)
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        left.labName.localeCompare(right.labName)
    );
}

function buildModele(models: GameModel[], random: () => number): BuiltPuzzle {
  const eligible = models.filter(modeleEligible);
  if (eligible.length < 10)
    throw new Error("Modele needs at least 10 eligible models");
  return {
    public_payload: { maxGuesses: 8, candidates: candidateList(eligible) },
    answer_payload: { target: pick(eligible, random), models: eligible },
  };
}

function buildPricele(models: GameModel[], random: () => number): BuiltPuzzle {
  const eligible = models.filter(priceleEligible);
  if (eligible.length < 10)
    throw new Error("Pricele needs at least 10 eligible models");
  return {
    public_payload: {
      maxGuesses: 6,
      candidates: candidateList(eligible),
      priceBasis: "Lowest standard text price per 1M tokens",
    },
    answer_payload: { target: pick(eligible, random), models: eligible },
  };
}

function buildTimeline(models: GameModel[], random: () => number): BuiltPuzzle {
  const eligible = models.filter((model) => model.releaseDate);
  const selection: GameModel[] = [];
  const dates = new Set<string>();
  for (const model of shuffle(eligible, random)) {
    if (!model.releaseDate || dates.has(model.releaseDate)) continue;
    selection.push(model);
    dates.add(model.releaseDate);
    if (selection.length === 5) break;
  }
  if (selection.length < 5)
    throw new Error("Timeline needs five distinct release dates");
  const ordered = [...selection].sort((left, right) =>
    String(left.releaseDate).localeCompare(String(right.releaseDate))
  );
  return {
    public_payload: { models: shuffle(selection.map(toCandidate), random) },
    answer_payload: {
      orderedIds: ordered.map((model) => model.id),
      dates: Object.fromEntries(
        ordered.map((model) => [model.id, model.releaseDate])
      ),
    },
  };
}

type HeadMetric = {
  key: string;
  label: string;
  eligible: (model: GameModel) => boolean;
  winner: (left: GameModel, right: GameModel) => "left" | "right" | null;
};

const HEAD_METRICS: HeadMetric[] = [
  {
    key: "newer",
    label: "Which model was released more recently?",
    eligible: (model) => Boolean(model.releaseDate),
    winner: (left, right) =>
      left.releaseDate === right.releaseDate
        ? null
        : String(left.releaseDate) > String(right.releaseDate)
        ? "left"
        : "right",
  },
  {
    key: "context",
    label: "Which model has the larger context window?",
    eligible: (model) => model.contextLength != null,
    winner: (left, right) =>
      left.contextLength === right.contextLength
        ? null
        : Number(left.contextLength) > Number(right.contextLength)
        ? "left"
        : "right",
  },
  {
    key: "providers",
    label: "Which model has more active API providers?",
    eligible: (model) => model.providerCount != null,
    winner: (left, right) =>
      left.providerCount === right.providerCount
        ? null
        : Number(left.providerCount) > Number(right.providerCount)
        ? "left"
        : "right",
  },
  {
    key: "price",
    label: "Which model has the lower standard input-token price?",
    eligible: (model) => model.inputPrice != null,
    winner: (left, right) =>
      left.inputPrice === right.inputPrice
        ? null
        : Number(left.inputPrice) < Number(right.inputPrice)
        ? "left"
        : "right",
  },
];

function metricValue(metric: string, model: GameModel): string | number | null {
  if (metric === "newer") return model.releaseDate;
  if (metric === "context") return model.contextLength;
  if (metric === "providers") return model.providerCount;
  return model.inputPrice;
}

function buildHeadToHead(
  models: GameModel[],
  random: () => number
): BuiltPuzzle {
  const rounds: Array<Record<string, unknown>> = [];
  const answers: Record<string, unknown> = {};
  for (let index = 0; index < 5; index += 1) {
    const metric = HEAD_METRICS[index % HEAD_METRICS.length] as HeadMetric;
    const eligible = shuffle(models.filter(metric.eligible), random);
    let pair: [GameModel, GameModel] | null = null;
    let winner: "left" | "right" | null = null;
    for (
      let leftIndex = 0;
      leftIndex < eligible.length && !pair;
      leftIndex += 1
    ) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < eligible.length;
        rightIndex += 1
      ) {
        const left = eligible[leftIndex] as GameModel;
        const right = eligible[rightIndex] as GameModel;
        const result = metric.winner(left, right);
        if (result) {
          pair = [left, right];
          winner = result;
          break;
        }
      }
    }
    if (!pair || !winner)
      throw new Error(`No head-to-head pair for ${metric.key}`);
    const roundId = `round-${index + 1}`;
    rounds.push({
      id: roundId,
      metric: metric.key,
      label: metric.label,
      left: toCandidate(pair[0]),
      right: toCandidate(pair[1]),
    });
    answers[roundId] = {
      winner,
      leftValue: metricValue(metric.key, pair[0]),
      rightValue: metricValue(metric.key, pair[1]),
    };
  }
  return { public_payload: { rounds }, answer_payload: { answers } };
}

function buildSprint(models: GameModel[], random: () => number): BuiltPuzzle {
  const categories: Array<{
    kind: string;
    value: string;
    label: string;
    models: GameModel[];
  }> = [];
  const labs = new Map<string, GameModel[]>();
  const years = new Map<string, GameModel[]>();
  for (const model of models) {
    labs.set(model.labName, [...(labs.get(model.labName) ?? []), model]);
    if (model.releaseYear) {
      const year = String(model.releaseYear);
      years.set(year, [...(years.get(year) ?? []), model]);
    }
  }
  for (const [lab, matches] of labs) {
    if (matches.length >= 5 && matches.length <= 30)
      categories.push({
        kind: "developer",
        value: lab,
        label: `Models by ${lab}`,
        models: matches,
      });
  }
  for (const [year, matches] of years) {
    if (matches.length >= 5 && matches.length <= 40)
      categories.push({
        kind: "release_year",
        value: year,
        label: `Models released in ${year}`,
        models: matches,
      });
  }
  if (categories.length === 0)
    throw new Error("Sprint needs a category with 5–40 models");
  const category = pick(categories, random);
  return {
    public_payload: {
      category: {
        kind: category.kind,
        value: category.value,
        label: category.label,
      },
      durationSeconds: 60,
      totalAnswers: category.models.length,
    },
    answer_payload: { candidates: candidateList(category.models) },
  };
}

export function buildPuzzle(
  game: GameKey,
  models: GameModel[],
  seed: number
): BuiltPuzzle {
  const random = createRandom(seed);
  if (game === "modele") return buildModele(models, random);
  if (game === "timeline") return buildTimeline(models, random);
  if (game === "pricele") return buildPricele(models, random);
  if (game === "head-to-head") return buildHeadToHead(models, random);
  return buildSprint(models, random);
}

function asModel(value: unknown): GameModel {
  return value as GameModel;
}

function modelGuess(model: GameModel, target: GameModel) {
  return {
    model: toCandidate(model),
    correct: model.id === target.id,
    clues: {
      developer: {
        value: model.labName,
        match: exactMatch(model.labSlug, target.labSlug),
      },
      country: {
        value: model.countryCode,
        match: exactMatch(model.countryCode, target.countryCode),
      },
      access: {
        value: ACCESS_LABELS[model.access],
        match: exactMatch(model.access, target.access),
      },
      releaseYear: {
        value: model.releaseYear,
        direction: numericDirection(model.releaseYear, target.releaseYear),
      },
      inputModalities: {
        value: model.inputModalities,
        match: listMatch(model.inputModalities, target.inputModalities),
      },
      outputModalities: {
        value: model.outputModalities,
        match: listMatch(model.outputModalities, target.outputModalities),
      },
      providers: {
        value: model.providerCount,
        direction: numericDirection(model.providerCount, target.providerCount),
      },
      family: {
        value: model.family,
        match: exactMatch(model.family, target.family),
      },
    },
  };
}

function findCandidate(models: GameModel[], id: unknown): GameModel | null {
  const candidateId = String(id ?? "").trim();
  return models.find((model) => model.id === candidateId) ?? null;
}

export function evaluatePuzzle(
  game: GameKey,
  answerPayload: Record<string, unknown>,
  body: Record<string, unknown>
): Record<string, unknown> {
  if (body.action === "reveal") {
    const target = answerPayload.target ? asModel(answerPayload.target) : null;
    return target ? { answer: toCandidate(target) } : { answer: answerPayload };
  }
  if (game === "modele") {
    const target = asModel(answerPayload.target);
    const guess = findCandidate(
      (answerPayload.models as GameModel[]) ?? [],
      body.guessId
    );
    if (!guess) throw new Error("invalid_guess");
    const result = modelGuess(guess, target);
    return result.correct ? { ...result, answer: toCandidate(target) } : result;
  }
  if (game === "pricele") {
    const target = asModel(answerPayload.target);
    const guess = findCandidate(
      (answerPayload.models as GameModel[]) ?? [],
      body.guessId
    );
    if (!guess || !priceleEligible(guess)) throw new Error("invalid_guess");
    const correct = guess.id === target.id;
    return {
      model: toCandidate(guess),
      correct,
      prices: {
        input: {
          value: guess.inputPrice,
          direction: numericDirection(guess.inputPrice, target.inputPrice),
        },
        output: {
          value: guess.outputPrice,
          direction: numericDirection(guess.outputPrice, target.outputPrice),
        },
        unit: guess.priceUnit ?? "1M tokens",
      },
      ...(correct ? { answer: toCandidate(target) } : {}),
    };
  }
  if (game === "timeline") {
    const orderedIds = Array.isArray(body.order) ? body.order.map(String) : [];
    const correctOrder = (answerPayload.orderedIds as string[]) ?? [];
    if (
      orderedIds.length !== correctOrder.length ||
      new Set(orderedIds).size !== correctOrder.length
    ) {
      throw new Error("invalid_order");
    }
    return {
      correct: orderedIds.every((id, index) => id === correctOrder[index]),
      score: orderedIds.filter((id, index) => id === correctOrder[index])
        .length,
      correctOrder,
      dates: answerPayload.dates,
    };
  }
  if (game === "head-to-head") {
    const guesses =
      body.answers && typeof body.answers === "object"
        ? (body.answers as Record<string, unknown>)
        : {};
    const answers = answerPayload.answers as Record<
      string,
      { winner: string; leftValue: unknown; rightValue: unknown }
    >;
    const results = Object.fromEntries(
      Object.entries(answers).map(([id, answer]) => [
        id,
        {
          correct: guesses[id] === answer.winner,
          ...answer,
        },
      ])
    );
    return {
      results,
      score: Object.values(results).filter((result) => result.correct).length,
    };
  }
  const candidates = (answerPayload.candidates as ModelCandidate[]) ?? [];
  if (body.action === "finish") return { answers: candidates };
  const normalizedGuess = String(body.guess ?? "")
    .trim()
    .toLowerCase();
  const match = candidates.find(
    (candidate) =>
      candidate.id.toLowerCase() === normalizedGuess ||
      candidate.name.toLowerCase() === normalizedGuess
  );
  return match ? { accepted: true, model: match } : { accepted: false };
}
