import type {
  LanguageModelV4,
  ProviderV4,
  EmbeddingModelV4,
  ImageModelV4,
  TranscriptionModelV4,
  SpeechModelV4,
} from '@ai-sdk/provider';
import { PhaseoLanguageModel } from './phaseo-language-model.js';
import { PhaseoEmbeddingModel } from './phaseo-embedding-model.js';
import { PhaseoImageModel } from './phaseo-image-model.js';
import { PhaseoTranscriptionModel } from './phaseo-transcription-model.js';
import { PhaseoSpeechModel } from './phaseo-speech-model.js';
import type { PhaseoSettings, PhaseoModelSettings } from './phaseo-settings.js';

/**
 * Default base URL for the Phaseo Gateway API
 */
const DEFAULT_BASE_URL = 'https://api.phaseo.app/v1';

export type PhaseoProvider = ProviderV4 & ((
  modelId: string,
  modelSettings?: PhaseoModelSettings
) => LanguageModelV4);

/**
 * Creates a Phaseo provider instance for use with Vercel AI SDK.
 *
 * @param settings - Configuration settings for the provider
 * @returns A provider function that creates language model instances
 *
 * @example
 * ```typescript
 * import { createPhaseo } from '@phaseo/ai-sdk-provider';
 * import { generateText } from 'ai';
 *
 * const phaseo = createPhaseo({
 *   apiKey: process.env.PHASEO_API_KEY,
 * });
 *
 * const result = await generateText({
 *   model: phaseo('openai/gpt-4o'),
 *   prompt: 'Hello, world!',
 * });
 * ```
 */
export function createPhaseo(settings: PhaseoSettings = {}): PhaseoProvider {
  // Resolve API key from settings or environment variable
	const apiKey =
		settings.apiKey ??
		process.env.PHASEO_API_KEY;

	if (!apiKey) {
		throw new Error(
			'Phaseo API key is required. ' +
			'Provide it via the apiKey option or set the PHASEO_API_KEY environment variable.'
		);
	}

  // Resolve base URL with default
	const baseURL =
		settings.baseURL ??
		process.env.PHASEO_BASE_URL ??
		DEFAULT_BASE_URL;

  // Create the provider function that returns language model instances
  const provider = (
    modelId: string,
    modelSettings?: PhaseoModelSettings
  ): LanguageModelV4 => {
    return new PhaseoLanguageModel(
      modelId,
      {
        apiKey,
        baseURL,
        headers: settings.headers,
        fetch: settings.fetch,
      },
      modelSettings
    );
  };

  // Set the provider ID for debugging
  provider.specificationVersion = 'v4' as const;

  provider.languageModel = (modelId: string, modelSettings?: PhaseoModelSettings) => {
    return provider(modelId, modelSettings);
  };

  provider.embeddingModel = (
    modelId: string,
    modelSettings?: PhaseoModelSettings
  ): EmbeddingModelV4 => {
    return new PhaseoEmbeddingModel(
      modelId,
      {
        apiKey,
        baseURL,
        headers: settings.headers,
        fetch: settings.fetch,
      },
      modelSettings
    );
  };

  provider.textEmbeddingModel = (
    modelId: string,
    modelSettings?: PhaseoModelSettings
  ): EmbeddingModelV4 => provider.embeddingModel(modelId, modelSettings);

  provider.imageModel = (
    modelId: string,
    modelSettings?: PhaseoModelSettings
  ): ImageModelV4 => {
    return new PhaseoImageModel(
      modelId,
      {
        apiKey,
        baseURL,
        headers: settings.headers,
        fetch: settings.fetch,
      },
      modelSettings
    );
  };

  provider.transcriptionModel = (
    modelId: string,
    modelSettings?: PhaseoModelSettings
  ): TranscriptionModelV4 => {
    return new PhaseoTranscriptionModel(
      modelId,
      {
        apiKey,
        baseURL,
        headers: settings.headers,
        fetch: settings.fetch,
      },
      modelSettings
    );
  };

  provider.speechModel = (
    modelId: string,
    modelSettings?: PhaseoModelSettings
  ): SpeechModelV4 => {
    return new PhaseoSpeechModel(
      modelId,
      {
        apiKey,
        baseURL,
        headers: settings.headers,
        fetch: settings.fetch,
      },
      modelSettings
    );
  };

  return provider as PhaseoProvider;
}

