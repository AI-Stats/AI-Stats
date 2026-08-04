export const GAME_KEYS = [
  "modele",
  "timeline",
  "pricele",
  "head-to-head",
  "sprint",
] as const;

export type GameKey = (typeof GAME_KEYS)[number];

export type ModelAccess =
  | "open_source"
  | "open_weights"
  | "proprietary"
  | "unknown";

export type ModelCandidate = {
  id: string;
  name: string;
  labName: string;
  labSlug?: string;
};

export type GameModel = ModelCandidate & {
  labSlug: string;
  countryCode: string | null;
  releaseDate: string | null;
  releaseYear: number | null;
  access: ModelAccess;
  inputModalities: string[];
  outputModalities: string[];
  providerCount: number | null;
  contextLength: number | null;
  inputPrice: number | null;
  outputPrice: number | null;
  priceUnit: string | null;
  family: string | null;
};

export type PuzzleRecord = {
  puzzle_id: string;
  game_key: GameKey;
  puzzle_date: string;
  public_payload: Record<string, unknown>;
  answer_payload: Record<string, unknown>;
};

export type BuiltPuzzle = Pick<
  PuzzleRecord,
  "public_payload" | "answer_payload"
>;

export function isGameKey(value: string): value is GameKey {
  return (GAME_KEYS as readonly string[]).includes(value);
}

export function toCandidate(model: GameModel): ModelCandidate {
  return {
    id: model.id,
    name: model.name,
    labName: model.labName,
    labSlug: model.labSlug,
  };
}
