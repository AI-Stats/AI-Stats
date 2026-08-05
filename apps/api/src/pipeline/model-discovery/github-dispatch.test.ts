import { afterEach, describe, expect, it } from "vitest";
import { installFetchMock } from "../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../tests/helpers/runtime";
import { dispatchProviderCatalogSync } from "./github-dispatch";

afterEach(() => teardownTestRuntime());

describe("dispatchProviderCatalogSync", () => {
	it("skips without a GitHub token", async () => {
		setupRuntimeFromEnv({} as any);
		await expect(dispatchProviderCatalogSync(["openai"])).resolves.toMatchObject({
			dispatched: false,
			reason: "missing GITHUB_TOKEN/GH_TOKEN",
		});
	});

	it("dispatches one deduplicated provider payload", async () => {
		setupRuntimeFromEnv({ GITHUB_TOKEN: "test-token", GITHUB_REPOSITORY: "phaseoteam/Phaseo" } as any);
		const mock = installFetchMock([{
			match: (url) => url === "https://api.github.com/repos/phaseoteam/Phaseo/dispatches",
			response: new Response(null, { status: 204 }),
		}]);
		try {
			await expect(dispatchProviderCatalogSync(["OpenAI", "openai", "deepinfra"])).resolves.toEqual({
				dispatched: true,
				skipped: false,
				providers: ["deepinfra", "openai"],
			});
			expect(mock.calls[0]!.bodyJson).toEqual({
				event_type: "provider-catalog-change",
				client_payload: { providers: ["deepinfra", "openai"] },
			});
		} finally {
			mock.restore();
		}
	});
});
