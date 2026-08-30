import { createAIStats } from '@ai-stats/ai-sdk-provider';
import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
} from '@ai-sdk/provider';
import type { PhaseoRerankingConfig } from './phaseo-reranking-model.js';
import type { PhaseoModelSettings } from './phaseo-settings.js';

/**
 * Phaseo-branded ProviderV3 language model that repairs settings added after
 * the original AI SDK 6 adapter was published.
 */
export class PhaseoLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'phaseo' as const;
  readonly supportedUrls = {};

  constructor(
    readonly modelId: string,
    private readonly config: PhaseoRerankingConfig,
    private readonly modelSettings: PhaseoModelSettings = {}
  ) {}

  doGenerate(options: LanguageModelV3CallOptions) {
    return this.createDelegate(options).doGenerate(options);
  }

  doStream(options: LanguageModelV3CallOptions) {
    return this.createDelegate(options).doStream(options);
  }

  private createDelegate(options: LanguageModelV3CallOptions): LanguageModelV3 {
    const requestFetch = this.config.fetch ?? fetch;
    const patchedFetch: typeof fetch = async (input, init = {}) => {
      const headers = new Headers(init.headers);
      for (const [key, value] of Object.entries(options.headers ?? {})) {
        if (value != null) headers.set(key, value);
      }

      if (typeof init.body !== 'string') {
        return requestFetch(input, { ...init, headers });
      }

      const body = JSON.parse(init.body) as Record<string, unknown>;
      if (options.stopSequences?.length) body.stop = options.stopSequences;
      if (options.responseFormat?.type === 'json') {
        body.response_format = options.responseFormat.schema
          ? {
              type: 'json_schema',
              json_schema: {
                name: options.responseFormat.name ?? 'response',
                ...(options.responseFormat.description
                  ? { description: options.responseFormat.description }
                  : {}),
                schema: options.responseFormat.schema,
                strict: true,
              },
            }
          : { type: 'json_object' };
      }

      const phaseoOptions = options.providerOptions?.phaseo;
      if (phaseoOptions) Object.assign(body, phaseoOptions);

      return requestFetch(input, {
        ...init,
        headers,
        body: JSON.stringify(body),
      });
    };

    return createAIStats({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      headers: this.config.headers,
      fetch: patchedFetch,
    })(this.modelId, this.modelSettings);
  }
}
