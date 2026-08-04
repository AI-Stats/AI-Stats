export const GAME_KEYS = [
  "modele",
  "timeline",
  "pricele",
  "head-to-head",
  "sprint",
] as const;
export type GameKey = (typeof GAME_KEYS)[number];

export type ModelCandidate = {
  id: string;
  name: string;
  labName: string;
  labSlug?: string;
};

type PuzzleBase = { game: GameKey; puzzleId: string; date: string };

export type ModelePuzzle = PuzzleBase & {
  game: "modele";
  maxGuesses: number;
  candidates: ModelCandidate[];
};

export type PricelePuzzle = PuzzleBase & {
  game: "pricele";
  maxGuesses: number;
  candidates: ModelCandidate[];
  priceBasis: string;
};

export type TimelinePuzzle = PuzzleBase & {
  game: "timeline";
  models: ModelCandidate[];
};

export type HeadToHeadPuzzle = PuzzleBase & {
  game: "head-to-head";
  rounds: Array<{
    id: string;
    metric: string;
    label: string;
    left: ModelCandidate;
    right: ModelCandidate;
  }>;
};

export type SprintPuzzle = PuzzleBase & {
  game: "sprint";
  category: { kind: string; value: string; label: string };
  durationSeconds: number;
  totalAnswers: number;
};

export type DailyPuzzle =
  | ModelePuzzle
  | PricelePuzzle
  | TimelinePuzzle
  | HeadToHeadPuzzle
  | SprintPuzzle;

export type Direction = "correct" | "higher" | "lower" | "unknown";
export type Match = "correct" | "partial" | "wrong" | "unknown";

export type ModeleResult = {
  model: ModelCandidate;
  correct: boolean;
  answer?: ModelCandidate;
  clues: Record<
    string,
    { value: unknown; match?: Match; direction?: Direction }
  >;
};

export type PriceleResult = {
  model: ModelCandidate;
  correct: boolean;
  answer?: ModelCandidate;
  prices: {
    input: { value: number; direction: Direction };
    output: { value: number; direction: Direction };
    unit: string;
  };
};

export const GAME_INFO: Record<
  GameKey,
  { title: string; description: string; path: string }
> = {
  modele: {
    title: "Modele",
    description:
      "Find the model from developer, origin, access, release and modality clues.",
    path: "/games/modele",
  },
  timeline: {
    title: "Model Timeline",
    description: "Put five models in release order, oldest to newest.",
    path: "/games/timeline",
  },
  pricele: {
    title: "Pricele",
    description:
      "Identify the model by its standard input and output token prices.",
    path: "/games/pricele",
  },
  "head-to-head": {
    title: "Head-to-Head",
    description: "Pick the winner across five catalogue comparisons.",
    path: "/games/head-to-head",
  },
  sprint: {
    title: "Model Sprint",
    description:
      "Name as many models as you can from one daily category in 60 seconds.",
    path: "/games/sprint",
  },
};

export function isGameKey(value: string): value is GameKey {
  return (GAME_KEYS as readonly string[]).includes(value);
}
