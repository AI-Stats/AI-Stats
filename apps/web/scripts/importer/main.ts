import "dotenv/config";
import { isDryRun, isTransientImporterError } from "./runtime";
import { syncV2Catalogue } from "./v2";
import { DATA_ROOT } from "./paths";

const VERBOSE = process.argv.includes("--verbose");

const getArgValue = (name: string) =>
    process.argv.find(a => a.startsWith(`${name}=`) || a.startsWith(`--${name}=`))?.split("=")[1];

async function main() {
    const modelFilter = getArgValue("model");
    const requestedSection =
        process.argv.find(a => a.startsWith("--section="))?.split("=")[1] || "all";

    const timed = async (name: string, task: () => Promise<void>) => {
        const startedAt = performance.now();
        try {
            await task();
        } finally {
            console.log(`[importer-timing] section=${name} duration_ms=${Math.round(performance.now() - startedAt)}`);
        }
    };

    if (isDryRun()) console.log("==================== DRY RUN (no writes) ====================");
    if (VERBOSE) console.log(`DATA_ROOT: ${DATA_ROOT}`);

    if (requestedSection !== "all" || modelFilter) {
        console.log(">> V2 imports are atomic; section/model filters are accepted for compatibility but the complete JSON catalogue will be reconciled.");
    }
    console.log(">> Importing repository JSON directly into V2");
    await timed("v2-catalogue", () => syncV2Catalogue());
    console.log(">> Done.");
}

// Force the importer CLI to terminate cleanly in CI after awaited work completes.
main()
    .then(() => {
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(isTransientImporterError(err) ? 75 : 1);
    });
