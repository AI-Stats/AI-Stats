import {
    ImporterDatabaseError,
    isTransientImporterError,
} from "./supa";

describe("isTransientImporterError", () => {
    it("retries transient database and network failures", () => {
        expect(isTransientImporterError(new ImporterDatabaseError("upsert", { code: "40001" }))).toBe(true);
        expect(isTransientImporterError(new Error("fetch failed: connection reset"))).toBe(true);
    });

    it("does not retry deterministic constraint failures", () => {
        expect(isTransientImporterError(new ImporterDatabaseError("upsert", { code: "23505" }))).toBe(false);
    });
});
