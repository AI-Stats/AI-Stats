const DRY_RUN = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";

export function isDryRun() { return DRY_RUN; }

export function logWrite(table: string, op: string, payload: unknown, extra?: Record<string, any>) {
	if (!DRY_RUN) return;
	console.log(`DRY-RUN ${op} -> ${table}`);
	console.log(JSON.stringify(payload, null, 2));
	if (extra) console.log("  extra:", extra);
}

function formatDatabaseError(error: any): string {
	if (!error) return "unknown_error";
	const parts: string[] = [];
	parts.push(typeof error?.message === "string" && error.message.trim() ? error.message.trim() : String(error));
	if (typeof error?.detail === "string" && error.detail.trim()) parts.push(`detail=${error.detail.trim()}`);
	if (typeof error?.hint === "string" && error.hint.trim()) parts.push(`hint=${error.hint.trim()}`);
	if (typeof error?.code === "string" && error.code.trim()) parts.push(`code=${error.code.trim()}`);
	return parts.join(" | ");
}

export class ImporterDatabaseError extends Error {
	readonly code: string | null;
	readonly status: number | null;

	constructor(ctx: string, error: any) {
		super(`${ctx}: ${formatDatabaseError(error)}`);
		this.name = "ImporterDatabaseError";
		this.code = typeof error?.code === "string" ? error.code : null;
		this.status = typeof error?.status === "number" ? error.status : null;
		this.cause = error;
	}
}

export function isTransientImporterError(error: unknown): boolean {
	const value = error as { code?: unknown; status?: unknown; message?: unknown; cause?: any };
	const code = typeof value?.code === "string"
		? value.code
		: typeof value?.cause?.code === "string" ? value.cause.code : "";
	const status = typeof value?.status === "number"
		? value.status
		: typeof value?.cause?.status === "number" ? value.cause.status : null;
	const message = typeof value?.message === "string" ? value.message : String(error);
	return /^(08|40P01|40001|53|57P0)/.test(code)
		|| status === 408
		|| status === 429
		|| (status !== null && status >= 500)
		|| /network|timed out|timeout|connection reset|socket hang up/i.test(message);
}
