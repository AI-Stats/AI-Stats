import {
  createOpenAICompatible,
  type OpenAICompatibleProvider,
  type OpenAICompatibleProviderSettings,
} from '@ai-sdk/openai-compatible';

const DEFAULT_BASE_URL = 'https://api.phaseo.app/v1';

export type PhaseoProvider = OpenAICompatibleProvider<string, string, string, string>;

export type PhaseoSettings = Omit<
  OpenAICompatibleProviderSettings,
  'apiKey' | 'baseURL' | 'name'
> & {
  apiKey?: string;
  baseURL?: string;
};

/** Create a Phaseo provider compatible with Vercel AI SDK 5. */
export function createPhaseo(settings: PhaseoSettings = {}): PhaseoProvider {
  const apiKey = settings.apiKey ?? process.env.PHASEO_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Phaseo API key is required. Provide it via the apiKey option or set PHASEO_API_KEY.'
    );
  }

  return createOpenAICompatible<string, string, string, string>({
    ...settings,
    name: 'phaseo',
    apiKey,
    baseURL: settings.baseURL ?? process.env.PHASEO_BASE_URL ?? DEFAULT_BASE_URL,
    includeUsage: settings.includeUsage ?? true,
    supportsStructuredOutputs: settings.supportsStructuredOutputs ?? true,
  });
}

let defaultProvider: PhaseoProvider | undefined;

function getDefaultProvider(): PhaseoProvider {
  defaultProvider ??= createPhaseo();
  return defaultProvider;
}

const defaultPhaseo = (modelId: string) => getDefaultProvider()(modelId);

export const phaseo = Object.assign(defaultPhaseo, {
  languageModel: (
    modelId: string,
    config?: Parameters<PhaseoProvider['languageModel']>[1]
  ) => getDefaultProvider().languageModel(modelId, config),
  chatModel: (modelId: string) => getDefaultProvider().chatModel(modelId),
  completionModel: (modelId: string) => getDefaultProvider().completionModel(modelId),
  textEmbeddingModel: (modelId: string) =>
    getDefaultProvider().textEmbeddingModel(modelId),
  imageModel: (modelId: string) => getDefaultProvider().imageModel(modelId),
}) as PhaseoProvider;
