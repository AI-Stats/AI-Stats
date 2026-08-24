import type { ProviderSyncProvider } from "../types";
import { provider as deepinfra } from "./deepinfra";
import { provider as fastRouter } from "./fastrouter";
import { provider as nanoGpt } from "./nano-gpt";
import { provider as novitaAi } from "./novita-ai";
import { provider as openRouter } from "./openrouter";
import { provider as orcaRouter } from "./orcarouter";
import { provider as pioneer } from "./pioneer";
import { provider as poe } from "./poe";
import { provider as requesty } from "./requesty";
import { provider as vercel } from "./vercel";
import { provider as zenmux } from "./zenmux";

export const PROVIDER_SYNC_PROVIDERS: ProviderSyncProvider[] = [
	deepinfra,
	fastRouter,
	nanoGpt,
	novitaAi,
	openRouter,
	orcaRouter,
	pioneer,
	poe,
	requesty,
	vercel,
	zenmux,
].sort((left, right) => left.id.localeCompare(right.id));

const PROVIDER_SYNC_BY_ID = new Map(PROVIDER_SYNC_PROVIDERS.map((provider) => [provider.id, provider]));

export function getProviderSyncProvider(providerId: string): ProviderSyncProvider | undefined {
	return PROVIDER_SYNC_BY_ID.get(providerId);
}

export function getProviderSyncProviderIds(): string[] {
	return PROVIDER_SYNC_PROVIDERS.map((provider) => provider.id);
}
