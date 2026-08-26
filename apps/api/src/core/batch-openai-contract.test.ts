import { describe, expect, it } from "vitest";

import { BatchSchema } from "./schemas";

describe("OpenAI Batch schema contract", () => {
	it("accepts the current output expiry and metadata contract", () => {
		const result = BatchSchema.safeParse({
			input_file_id: "file_batch_input",
			endpoint: "/v1/responses",
			completion_window: "24h",
			metadata: { tenant: "north" },
			output_expires_after: { anchor: "created_at", seconds: 3_600 },
		});
		expect(result.success).toBe(true);
	});

	it("rejects invalid output expiry and metadata limits", () => {
		expect(BatchSchema.safeParse({
			input_file_id: "file_batch_input",
			endpoint: "/v1/responses",
			output_expires_after: { anchor: "created_at", seconds: 3_599 },
		}).success).toBe(false);
		expect(BatchSchema.safeParse({
			input_file_id: "file_batch_input",
			endpoint: "/v1/responses",
			metadata: Object.fromEntries(Array.from({ length: 17 }, (_, index) => [`key-${index}`, "value"])),
		}).success).toBe(false);
	});
});
