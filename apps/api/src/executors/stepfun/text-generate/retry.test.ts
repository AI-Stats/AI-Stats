import { describe, expect, it, vi } from "vitest";

const { executeOpenAIWireMock } = vi.hoisted(() => ({
	executeOpenAIWireMock: vi.fn(async () => ({ kind: "completed" })),
}));
vi.mock("@executors/_shared/text-generate/openai-compat", () => ({
	executeOpenAIWire: executeOpenAIWireMock,
}));
import { execute } from "./index";

describe("StepFun transient errors", () => {
	it("allows one adapter retry for documented 429 and 5xx responses", async () => {
		const args = { providerId: "stepfun" } as any;
		await execute(args);
		expect(executeOpenAIWireMock).toHaveBeenCalledWith(args, { transientRetries: 1 });
	});
});
