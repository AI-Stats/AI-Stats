import { describe, expect, it } from "vitest";
import { execute } from "./index";

describe("Venice text executor", () => {
	it("refuses to send E2EE prompts through the plaintext adapter", async () => {
		await expect(execute({ providerId: "venice-e2ee" } as any))
			.rejects.toThrow("venice_e2ee_encryption_not_implemented");
	});
});
