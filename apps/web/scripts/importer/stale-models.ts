import { deleteImportRows, updateImportRows } from "./database";
import { ImporterDatabaseError } from "./runtime";

function databaseErrorCode(error: unknown): string | null {
	let current: unknown = error;
	for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
		const value = current as { code?: unknown; cause?: unknown };
		if (typeof value.code === "string") return value.code;
		current = value.cause;
	}
	return null;
}

export async function deleteStaleModels(
	_database: undefined,
	modelSlugs: string[],
) {
	for (const modelSlug of modelSlugs) {
		try {
			await deleteImportRows({
				table: "v2_models",
				filters: [{ column: "model_slug", value: modelSlug }],
			});
		} catch (error) {
			const code = error instanceof ImporterDatabaseError
				? error.code ?? databaseErrorCode(error)
				: databaseErrorCode(error);
			if (code === "23503" || code === "23001") {
				await updateImportRows(
					"v2_models",
					{ hidden: true, status: "retired", retired_at: new Date().toISOString() },
					[{ column: "model_slug", value: modelSlug }],
				);
				console.warn(`[v2-sync] retaining stale model referenced by historical data: ${modelSlug}`);
				continue;
			}
			throw error;
		}
	}
}
