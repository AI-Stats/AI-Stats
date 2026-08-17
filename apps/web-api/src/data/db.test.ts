import { normalizePostgresTimestamp } from "@phaseo/db/hyperdrive";
import { describe, expect, it } from "vitest";

describe("PlanetScale timestamp normalization", () => {
	it("preserves microseconds while emitting the established API timestamp shape", () => {
		expect(normalizePostgresTimestamp("2026-07-22 10:23:46.119047+00")).toBe(
			"2026-07-22T10:23:46.119047+00:00",
		);
	});

	it("does not alter dates or ordinary text", () => {
		expect(normalizePostgresTimestamp("2026-07-22")).toBe("2026-07-22");
		expect(normalizePostgresTimestamp("Personal Workspace")).toBe("Personal Workspace");
	});
});
