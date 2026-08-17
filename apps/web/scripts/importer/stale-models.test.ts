import { deleteImportRows, updateImportRows } from "./database";
import { deleteStaleModels } from "./stale-models";

jest.mock("./database", () => ({
	deleteImportRows: jest.fn(),
	updateImportRows: jest.fn(),
}));

describe("deleteStaleModels", () => {
	it("retires referenced historical models and continues pruning", async () => {
		jest.mocked(deleteImportRows)
			.mockRejectedValueOnce(Object.assign(new Error("delete failed"), {
				cause: Object.assign(new Error("still referenced"), { code: "23001" }),
			}))
			.mockResolvedValueOnce(1);
		jest.mocked(updateImportRows).mockResolvedValueOnce(undefined);
		const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

		await deleteStaleModels(undefined, ["anthropic/claude-opus-4.7-fast", "unused/model"]);

		expect(deleteImportRows).toHaveBeenNthCalledWith(1, {
			table: "v2_models",
			filters: [{ column: "model_slug", value: "anthropic/claude-opus-4.7-fast" }],
		});
		expect(deleteImportRows).toHaveBeenNthCalledWith(2, {
			table: "v2_models",
			filters: [{ column: "model_slug", value: "unused/model" }],
		});
		expect(updateImportRows).toHaveBeenCalledWith(
			"v2_models",
			expect.objectContaining({ hidden: true, status: "retired", retired_at: expect.any(String) }),
			[{ column: "model_slug", value: "anthropic/claude-opus-4.7-fast" }],
		);
		expect(warn).toHaveBeenCalledWith(
			"[v2-sync] retaining stale model referenced by historical data: anthropic/claude-opus-4.7-fast",
		);
		warn.mockRestore();
	});
});
