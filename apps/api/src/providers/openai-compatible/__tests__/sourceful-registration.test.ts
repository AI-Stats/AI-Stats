import { describe, expect, it } from "vitest";
import { EXECUTORS_BY_PROVIDER, resolveProviderExecutor } from "@executors/index";
import { isOpenAICompatProvider } from "../config";

describe("Sourceful registration boundaries", () => {
	it("does not advertise an undocumented native text.generate API", () => {
		expect(isOpenAICompatProvider("sourceful")).toBe(false);
		expect(EXECUTORS_BY_PROVIDER.sourceful).toBeUndefined();
		expect(resolveProviderExecutor("sourceful", "text.generate")).toBeNull();
	});
});
