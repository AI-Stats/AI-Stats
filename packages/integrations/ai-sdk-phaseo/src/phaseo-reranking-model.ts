import type {
  RerankingModelV4,
  RerankingModelV4CallOptions,
  RerankingModelV4Result,
} from '@ai-sdk/provider';
import type { PhaseoConfig } from './phaseo-settings.js';
import { mapPhaseoProviderMetadata } from './map-phaseo-provider-metadata.js';
import { createPhaseoErrorHandler } from './utils/error-handler.js';

type PhaseoRerankResult = {
  index?: unknown;
  relevance_score?: unknown;
};

type PhaseoRerankResponse = {
  id?: unknown;
  model?: unknown;
  results?: unknown;
};

/** Phaseo reranking model implementation for Vercel AI SDK v7. */
export class PhaseoRerankingModel implements RerankingModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider = 'phaseo' as const;
  readonly modelId: string;

  private readonly config: PhaseoConfig;

  constructor(modelId: string, config: PhaseoConfig) {
    this.modelId = modelId;
    this.config = config;
  }

  async doRerank(options: RerankingModelV4CallOptions): Promise<RerankingModelV4Result> {
    const { documents, query, topN, abortSignal, headers, providerOptions } = options;
    const payload: Record<string, unknown> = {
      model: this.modelId,
      query,
      documents: documents.values,
      ...(topN != null && { top_n: topN }),
    };

    if (providerOptions) {
      for (const providerConfig of Object.values(providerOptions)) {
        Object.assign(payload, providerConfig);
      }
    }

    const url = `${this.config.baseURL}/rerank`;
    const fetchImpl = this.config.fetch ?? fetch;
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...this.config.headers,
        ...headers,
      },
      body: JSON.stringify(payload),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorHandler = createPhaseoErrorHandler();
      throw (await errorHandler({ url, requestBodyValues: payload, response })).value;
    }

    const data = (await response.json()) as PhaseoRerankResponse;
    if (!Array.isArray(data.results)) {
      throw new Error('Phaseo rerank response is missing a results array.');
    }

    const ranking = data.results.map((rawResult, position) => {
      const result = rawResult as PhaseoRerankResult;
      if (
        typeof result?.index !== 'number' ||
        !Number.isInteger(result.index) ||
        result.index < 0 ||
        result.index >= documents.values.length ||
        typeof result.relevance_score !== 'number' ||
        !Number.isFinite(result.relevance_score)
      ) {
        throw new Error(`Phaseo rerank response contains an invalid result at position ${position}.`);
      }
      return {
        index: result.index,
        relevanceScore: result.relevance_score,
      };
    });
    const responseHeaders = Object.fromEntries(response.headers.entries());

    return {
      ranking,
      providerMetadata: mapPhaseoProviderMetadata(data, responseHeaders),
      response: {
        id: typeof data.id === 'string' ? data.id : undefined,
        modelId: typeof data.model === 'string' ? data.model : this.modelId,
        headers: responseHeaders,
        body: data,
      },
      warnings: [],
    };
  }
}
