import { deleteStaleModels } from "./stale-models";

describe("deleteStaleModels", () => {
    it("deletes free dependants before their stale base models", async () => {
        const eq = jest.fn().mockResolvedValue({ data: null, error: null });
        const from = jest.fn(() => ({ delete: () => ({ eq }), update: jest.fn() }));
        await deleteStaleModels({ from } as never, ["xiaomi/model", "xiaomi/model:free"]);
        expect(eq).toHaveBeenNthCalledWith(1, "model_slug", "xiaomi/model:free");
        expect(eq).toHaveBeenNthCalledWith(2, "model_slug", "xiaomi/model");
    });

    it("retains referenced historical models and continues pruning", async () => {
        const eq = jest.fn()
            .mockResolvedValueOnce({
                data: null,
                error: { code: "23503", message: "still referenced" },
            })
            .mockResolvedValueOnce({ data: null, error: null });
        const updateEq = jest.fn().mockResolvedValue({ data: null, error: null });
        const update = jest.fn(() => ({ eq: updateEq }));
        const from = jest.fn(() => ({
            delete: () => ({ eq }),
            update,
        }));
        const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

        await deleteStaleModels(
            { from } as never,
            ["anthropic/claude-opus-4.7-fast", "unused/model"],
        );

        expect(eq).toHaveBeenNthCalledWith(1, "model_slug", "anthropic/claude-opus-4.7-fast");
        expect(eq).toHaveBeenNthCalledWith(2, "model_slug", "unused/model");
        expect(update).toHaveBeenCalledWith({ hidden: true });
        expect(updateEq).toHaveBeenCalledWith("model_slug", "anthropic/claude-opus-4.7-fast");
        expect(warn).toHaveBeenCalledWith(
            "[v2-sync] retaining stale model referenced by historical data: anthropic/claude-opus-4.7-fast",
        );
        warn.mockRestore();
    });
});
