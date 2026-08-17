import { catalogueGameResults, catalogueInteractionPuzzles, v2Labs, v2Models } from "@phaseo/db/schema";
import { and, eq, sql } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";
import type { GameKey, PuzzleRecord } from "./types";

export async function listGameCatalogueModels(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		return await db.select({
			model_slug: v2Models.modelSlug, name: v2Models.name, lab_slug: v2Models.labSlug,
			family_slug: v2Models.familySlug, status: v2Models.status, announced_at: v2Models.announcedAt,
			released_at: v2Models.releasedAt, license: v2Models.license, input_modalities: v2Models.inputModalities,
			output_modalities: v2Models.outputModalities, metadata: v2Models.metadata,
			lab: sql<Record<string, unknown>>`jsonb_build_object('lab_slug',${v2Labs.labSlug},'name',${v2Labs.name},'country_code',${v2Labs.countryCode})`,
		}).from(v2Models).leftJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug)).where(eq(v2Models.hidden, false));
	} finally { await client.end({ timeout: 1 }); }
}

function puzzleRecord(row: typeof catalogueInteractionPuzzles.$inferSelect): PuzzleRecord {
	return { puzzle_id: row.puzzleId, game_key: row.gameKey as GameKey, puzzle_date: row.puzzleDate, public_payload: row.publicPayload as Record<string, unknown>, answer_payload: row.answerPayload as Record<string, unknown> };
}

export async function findGamePuzzle(env: Env, game: GameKey, date: string): Promise<PuzzleRecord | null> {
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db.select().from(catalogueInteractionPuzzles).where(and(eq(catalogueInteractionPuzzles.gameKey, game), eq(catalogueInteractionPuzzles.puzzleDate, date))).limit(1);
		return row ? puzzleRecord(row) : null;
	} finally { await client.end({ timeout: 1 }); }
}

export async function createGamePuzzle(env: Env, puzzle: PuzzleRecord): Promise<PuzzleRecord | null> {
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db.insert(catalogueInteractionPuzzles).values({ puzzleId: puzzle.puzzle_id, gameKey: puzzle.game_key, puzzleDate: puzzle.puzzle_date, publicPayload: puzzle.public_payload, answerPayload: puzzle.answer_payload }).onConflictDoNothing({ target: [catalogueInteractionPuzzles.gameKey, catalogueInteractionPuzzles.puzzleDate] }).returning();
		return row ? puzzleRecord(row) : null;
	} finally { await client.end({ timeout: 1 }); }
}

export async function saveGameCompletion(env: Env, input: { userId: string; gameKey: GameKey; puzzleId: string; puzzleDate: string; won: boolean; score: number; maxScore: number; attempts: number | null; completedAt: string }) {
	const { db, client } = createDatabase(env);
	try {
		await db.insert(catalogueGameResults).values({ userId: input.userId, gameKey: input.gameKey, puzzleId: input.puzzleId, puzzleDate: input.puzzleDate, won: input.won, score: input.score, maxScore: input.maxScore, attempts: input.attempts, completedAt: input.completedAt }).onConflictDoNothing({ target: [catalogueGameResults.userId, catalogueGameResults.gameKey, catalogueGameResults.puzzleDate] });
	} finally { await client.end({ timeout: 1 }); }
}
