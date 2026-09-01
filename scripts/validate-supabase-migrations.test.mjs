import assert from "node:assert/strict";
import test from "node:test";
import { validateMigrationOrder } from "./validate-supabase-migrations.mjs";

test("accepts migrations newer than the latest migration on the base branch", () => {
	assert.deepEqual(
		validateMigrationOrder(
			[
				"20260830120000_existing.sql",
				"20260901105106_latest.sql",
			],
			["supabase/migrations/20260901120000_new_change.sql"],
		),
		[],
	);
});

test("rejects an out-of-order migration after another PR has merged", () => {
	assert.match(
		validateMigrationOrder(
			["20260901105106_already_merged.sql"],
			["supabase/migrations/20260901100000_stale_branch.sql"],
		).join("\n"),
		/must be newer than the base branch's latest version 20260901105106/,
	);
});

test("accepts the first migration in a repository", () => {
	assert.deepEqual(
		validateMigrationOrder(
			[],
			["supabase/migrations/20260901120000_initial.sql"],
		),
		[],
	);
});
