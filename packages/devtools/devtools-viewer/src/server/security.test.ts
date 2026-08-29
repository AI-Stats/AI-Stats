import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as path from "path";
import { resolveDevtoolsAssetPath } from "./security";

describe("resolveDevtoolsAssetPath", () => {
	it("keeps assets inside the capture directory", () => {
		assert.equal(
			resolveDevtoolsAssetPath("captures", "images/example.png"),
			path.resolve("captures", "assets", "images", "example.png"),
		);
	});

	for (const value of ["../session.jsonl", "../../.env", "C:\\Windows\\win.ini", "/etc/passwd"]) {
		it(`rejects escaping asset path ${value}`, () => {
			assert.equal(resolveDevtoolsAssetPath("captures", value), null);
		});
	}
});
