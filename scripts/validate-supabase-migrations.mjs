import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIR, "..");
const MIGRATIONS_DIRECTORY = join(REPOSITORY_ROOT, "supabase", "migrations");
const MIGRATION_NAME = /^(\d{14})_[a-z0-9][a-z0-9_]*\.sql$/;
const DESTRUCTIVE_APPROVAL = /^\s*--\s*phaseo:allow-destructive-migration\s+reason:\s*(.+)$/im;
const DESTRUCTIVE_PATTERNS = [
	["DROP TABLE", /\bdrop\s+table\b/i],
	["DROP SCHEMA", /\bdrop\s+schema\b/i],
	["DROP TYPE", /\bdrop\s+type\b/i],
	["DROP VIEW", /\bdrop\s+(?:materialized\s+)?view\b/i],
	["TRUNCATE", /\btruncate(?:\s+table)?\b/i],
	["DROP COLUMN", /\balter\s+table[\s\S]*?\bdrop\s+column\b/i],
	["DELETE", /\bdelete\s+from\b/i],
];

function listMigrationFiles() {
	if (!existsSync(MIGRATIONS_DIRECTORY)) {
		throw new Error("Missing supabase/migrations directory");
	}

	return readdirSync(MIGRATIONS_DIRECTORY)
		.filter((name) => name.endsWith(".sql"))
		.sort();
}

function validateNames(files) {
	const errors = [];
	const versions = new Map();

	for (const file of files) {
		const match = file.match(MIGRATION_NAME);
		if (!match) {
			errors.push(
				`${file}: expected YYYYMMDDHHMMSS_lower_snake_case.sql`,
			);
			continue;
		}

		const [, version] = match;
		const previous = versions.get(version);
		if (previous) {
			errors.push(`${file}: duplicates migration version used by ${previous}`);
		} else {
			versions.set(version, file);
		}
	}

	return errors;
}

function getMigrationChanges(baseSha) {
	if (!baseSha || /^0+$/.test(baseSha)) return [];

	const output = execFileSync(
		"git",
		[
			"diff",
			"--name-status",
			"--find-renames",
			`${baseSha}...HEAD`,
			"--",
			"supabase/migrations",
		],
		{ cwd: REPOSITORY_ROOT, encoding: "utf8" },
	).trim();

	if (!output) return [];

	return output.split(/\r?\n/).map((line) => {
		const [status, ...paths] = line.split("\t");
		return { status, paths };
	});
}

function stripSqlComments(sql) {
	return sql
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/--.*$/gm, " ");
}

function validateAddedMigration(path) {
	const errors = [];
	const absolutePath = resolve(REPOSITORY_ROOT, path);
	if (!absolutePath.startsWith(`${MIGRATIONS_DIRECTORY}${sep}`)) {
		return [`${path}: migration path escaped supabase/migrations`];
	}

	const sql = readFileSync(absolutePath, "utf8");
	if (!sql.trim()) return [`${path}: migration is empty`];

	const statements = stripSqlComments(sql);
	const dangerous = DESTRUCTIVE_PATTERNS
		.filter(([, pattern]) => pattern.test(statements))
		.map(([label]) => label);

	if (dangerous.length === 0) return errors;

	const approval = sql.match(DESTRUCTIVE_APPROVAL);
	const reason = approval?.[1]?.trim() ?? "";
	if (reason.length < 12) {
		errors.push(
			`${path}: destructive SQL detected (${dangerous.join(", ")}). ` +
			"Add '-- phaseo:allow-destructive-migration reason: <specific justification>' " +
			"and call it out in the pull request.",
		);
	}

	return errors;
}

export function validateSupabaseMigrations(baseSha = "") {
	const files = listMigrationFiles();
	const errors = validateNames(files);
	const changes = getMigrationChanges(baseSha);
	const added = [];

	for (const change of changes) {
		if (change.status === "A" && change.paths.length === 1) {
			added.push(change.paths[0]);
			continue;
		}

		errors.push(
			`${change.paths.join(" -> ")}: existing migrations are immutable; ` +
			"add a new migration instead of modifying, deleting, or renaming one",
		);
	}

	for (const path of added) {
		errors.push(...validateAddedMigration(path));
	}

	if (errors.length > 0) {
		throw new Error(`Invalid Supabase migrations:\n- ${errors.join("\n- ")}`);
	}

	return { total: files.length, added: added.length };
}

const isDirectRun =
	process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
	const { total, added } = validateSupabaseMigrations(process.argv[2]);
	console.log(
		`Supabase migration history is valid (${total} total, ${added} added in this change).`,
	);
}
