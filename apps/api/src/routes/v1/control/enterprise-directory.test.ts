import { describe, expect, it } from "vitest";
import { normalizeDepartment } from "./enterprise-directory";

describe("enterprise directory validation", () => {
	it("normalizes a department", () => {
		expect(normalizeDepartment({ name: " Engineering ", description: " Product builders ", icon: "code", color: "indigo" })).toEqual({
			value: { name: "Engineering", description: "Product builders", icon: "code", color: "indigo" },
		});
	});

	it("rejects unsupported visual values", () => {
		expect(normalizeDepartment({ name: "Engineering", icon: "rocket", color: "blue" })).toEqual({ error: "department_icon_invalid" });
	});

	it("allows partial updates", () => {
		expect(normalizeDepartment({ color: "emerald" }, true)).toEqual({ value: { color: "emerald" } });
	});
});
