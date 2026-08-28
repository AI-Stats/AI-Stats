import type { Env } from "@/env";
import { runProviderCatalogPollingJob } from "@/routes/account/provider-catalog-sync";

export async function handleProviderCatalogScheduledEvent(_event: ScheduledController, env: Env): Promise<void> {
	try {
		const summary = await runProviderCatalogPollingJob(env);
		console.log("provider_catalog_poll_completed", summary);
	} catch (error) {
		console.error("provider_catalog_poll_failed", error instanceof Error ? error.message : String(error));
	}
}
