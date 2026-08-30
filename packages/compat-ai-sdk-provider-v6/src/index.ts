import {
  createAIStats,
} from '@ai-stats/ai-sdk-provider';
import type {
  EmbeddingModelV3,
  LanguageModelV3,
  ProviderV3,
  RerankingModelV3,
  SpeechModelV3,
  TranscriptionModelV3,
} from '@ai-sdk/provider';
import { PhaseoRerankingModel } from './phaseo-reranking-model.js';
import { PhaseoLanguageModel } from './phaseo-language-model.js';
import type { PhaseoModelSettings, PhaseoSettings } from './phaseo-settings.js';

const DEFAULT_BASE_URL = 'https://api.phaseo.app/v1';

export type PhaseoProvider = Omit<
  ProviderV3,
  'textEmbeddingModel' | 'transcriptionModel' | 'speechModel' | 'rerankingModel'
> & {
  textEmbeddingModel(modelId: string): EmbeddingModelV3;
  transcriptionModel(modelId: string): TranscriptionModelV3;
  speechModel(modelId: string): SpeechModelV3;
  rerankingModel(modelId: string): RerankingModelV3;
} & ((modelId: string, modelSettings?: PhaseoModelSettings) => LanguageModelV3);

export type { PhaseoModelSettings, PhaseoSettings } from './phaseo-settings.js';

/** Create a Phaseo provider compatible with Vercel AI SDK 6. */
export function createPhaseo(settings: PhaseoSettings = {}): PhaseoProvider {
  const apiKey = settings.apiKey ?? process.env.PHASEO_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Phaseo API key is required. Provide it via the apiKey option or set PHASEO_API_KEY.'
    );
  }

  const baseURL = settings.baseURL ?? process.env.PHASEO_BASE_URL ?? DEFAULT_BASE_URL;
  const baseProvider = createAIStats({
    ...settings,
    apiKey,
    baseURL,
  });

  const brandModel = <T extends { readonly provider: string }>(model: T): T => {
    Object.defineProperty(model, 'provider', { value: 'phaseo', configurable: true });
    return model;
  };
  const createLanguageModel = (modelId: string, modelSettings?: PhaseoModelSettings) =>
    new PhaseoLanguageModel(
      modelId,
      { apiKey, baseURL, headers: settings.headers, fetch: settings.fetch },
      modelSettings
    );
  const provider = ((modelId: string, modelSettings?: PhaseoModelSettings) =>
    createLanguageModel(modelId, modelSettings)) as unknown as PhaseoProvider;
  Object.defineProperty(provider, 'specificationVersion', { value: 'v3' });
  provider.languageModel = (modelId: string) => createLanguageModel(modelId);
  provider.embeddingModel = (modelId: string) =>
    brandModel(baseProvider.embeddingModel(modelId));
  provider.textEmbeddingModel = (modelId: string) =>
    brandModel(baseProvider.textEmbeddingModel!(modelId));
  provider.imageModel = (modelId: string) =>
    brandModel(baseProvider.imageModel(modelId));
  provider.transcriptionModel = (modelId: string) =>
    brandModel(baseProvider.transcriptionModel!(modelId));
  provider.speechModel = (modelId: string) =>
    brandModel(baseProvider.speechModel!(modelId));
  provider.rerankingModel = (modelId: string) =>
    new PhaseoRerankingModel(modelId, {
      apiKey,
      baseURL,
      headers: settings.headers,
      fetch: settings.fetch,
    });

  return provider;
}

let defaultProvider: PhaseoProvider | undefined;

function getDefaultProvider(): PhaseoProvider {
  defaultProvider ??= createPhaseo();
  return defaultProvider;
}

const defaultPhaseo = (modelId: string, modelSettings?: PhaseoModelSettings) =>
  getDefaultProvider()(modelId, modelSettings);

export const phaseo = Object.assign(defaultPhaseo, {
  specificationVersion: 'v3' as const,
  languageModel: (modelId: string) => getDefaultProvider().languageModel(modelId),
  embeddingModel: (modelId: string) => getDefaultProvider().embeddingModel(modelId),
  textEmbeddingModel: (modelId: string) =>
    getDefaultProvider().textEmbeddingModel(modelId),
  imageModel: (modelId: string) => getDefaultProvider().imageModel(modelId),
  transcriptionModel: (modelId: string) =>
    getDefaultProvider().transcriptionModel(modelId),
  speechModel: (modelId: string) => getDefaultProvider().speechModel(modelId),
  rerankingModel: (modelId: string) => getDefaultProvider().rerankingModel(modelId),
}) as PhaseoProvider;

export { PhaseoRerankingModel } from './phaseo-reranking-model.js';
export { PhaseoLanguageModel } from './phaseo-language-model.js';
export {
  AIStatsEmbeddingModel as PhaseoEmbeddingModel,
  AIStatsImageModel as PhaseoImageModel,
  AIStatsTranscriptionModel as PhaseoTranscriptionModel,
  AIStatsSpeechModel as PhaseoSpeechModel,
} from '@ai-stats/ai-sdk-provider';
