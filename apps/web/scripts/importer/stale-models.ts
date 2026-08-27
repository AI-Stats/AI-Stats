import { assertOk, ImporterDatabaseError } from "./supa";

type ModelDeleteClient = {
    from(table: "v2_models"): {
        delete(): {
            eq(column: "model_slug", value: string): PromiseLike<{ data: unknown, error: unknown }>;
        };
        update(values: { hidden: boolean }): {
            eq(column: "model_slug", value: string): PromiseLike<{ data: unknown, error: unknown }>;
        };
    };
};

export async function deleteStaleModels(
    supa: ModelDeleteClient,
    modelSlugs: string[],
) {
    const deletionOrder = [...modelSlugs].sort((left, right) => {
        const freeDifference = Number(!left.endsWith(":free")) - Number(!right.endsWith(":free"));
        return freeDifference || left.localeCompare(right);
    });
    for (const modelSlug of deletionOrder) {
        try {
            assertOk(
                await supa.from("v2_models").delete().eq("model_slug", modelSlug),
                "v2 sync delete stale v2_models",
            );
        } catch (error) {
            if (error instanceof ImporterDatabaseError && error.code === "23503") {
                assertOk(
                    await supa.from("v2_models").update({ hidden: true }).eq("model_slug", modelSlug),
                    "v2 sync hide referenced stale v2_models",
                );
                console.warn(`[v2-sync] retaining stale model referenced by historical data: ${modelSlug}`);
                continue;
            }
            throw error;
        }
    }
}
