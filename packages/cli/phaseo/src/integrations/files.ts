import { constants } from "node:fs";
import { access, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { delimiter, dirname, join } from "node:path";
import type { FileChange } from "./types.js";

export async function readOptionalFile(path: string): Promise<string | null> {
	try {
		return await readFile(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

export function renderPlan(changes: FileChange[]): string {
	if (changes.length === 0) return "No changes required.\n";
	return changes.map((change) => `${change.description}\n  ${change.path}\n`).join("");
}

export async function isCommandAvailable(candidates: string[]): Promise<boolean> {
	for (const directory of (process.env.PATH || "").split(delimiter)) {
		if (!directory) continue;
		for (const candidate of candidates) {
			try {
				await access(join(directory, candidate), constants.F_OK);
				return true;
			} catch {}
		}
	}
	return false;
}

export async function applyChanges(changes: FileChange[]): Promise<void> {
	const applied: Array<{ path: string; before: string | null }> = [];
	try {
		for (const change of changes) {
			const current = await readOptionalFile(change.path);
			if (current !== change.before) {
				throw new Error(`Refusing to apply stale file change: ${change.path}`);
			}
			await mkdir(dirname(change.path), { recursive: true });
			applied.push({ path: change.path, before: change.before });
			if (change.after === null) {
				await unlink(change.path).catch((error: NodeJS.ErrnoException) => {
					if (error.code !== "ENOENT") throw error;
				});
			} else {
				const temporary = `${change.path}.phaseo-tmp-${process.pid}`;
				try {
					await writeFile(temporary, change.after, { mode: 0o600 });
					await rename(temporary, change.path);
				} catch (error) {
					await unlink(temporary).catch(() => undefined);
					throw error;
				}
			}
		}
	} catch (error) {
		for (const item of applied.reverse()) {
			if (item.before === null) {
				await unlink(item.path).catch((rollbackError: NodeJS.ErrnoException) => {
					if (rollbackError.code !== "ENOENT") throw rollbackError;
				});
			} else await writeFile(item.path, item.before, { mode: 0o600 });
		}
		throw error;
	}
}
