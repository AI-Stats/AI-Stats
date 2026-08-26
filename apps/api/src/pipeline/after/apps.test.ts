import { describe, expect, it } from "vitest";

import { ensureAppId } from "./apps";

describe("ensureAppId", () => {
	it("does not create an app without explicit user attribution", async () => {
		await expect(ensureAppId({ workspaceId: "workspace_1" })).resolves.toBeNull();
	});
});
