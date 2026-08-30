import type {
  RerankingModelV3,
  RerankingModelV3CallOptions,
} from '@ai-sdk/provider';

export type PhaseoRerankingConfig = {
  apiKey: string;
  baseURL: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
};

type RerankResponse = {
  id?: unknown;
  model?: unknown;
  provider?: unknown;
  nativeResponseId?: unknown;
  results?: unknown;
};

type RerankRow = {
  index?: unknown;
  relevance_score?: unknown;
};

/** Phaseo reranking model for AI SDK 6's ProviderV3 contract. */
export class PhaseoRerankingModel implements RerankingModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'phaseo' as const;
  readonly modelId: string;

  constructor(
    modelId: string,
    private readonly config: PhaseoRerankingConfig
  ) {
    this.modelId = modelId;
  }

  async doRerank(options: RerankingModelV3CallOptions) {
    const payload: Record<string, unknown> = {
      model: this.modelId,
      query: options.query,
      documents: options.documents.values,
      ...(options.topN != null && { top_n: options.topN }),
    };

    if (options.providerOptions) {
      for (const providerConfig of Object.values(options.providerOptions)) {
        Object.assign(payload, providerConfig);
      }
    }

    const url = `${this.config.baseURL}/rerank`;
    const response = await (this.config.fetch ?? fetch)(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...this.config.headers,
        ...options.headers,
      },
      body: JSON.stringify(payload),
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Phaseo rerank request failed with ${response.status}: ${body}`);
    }

    const data = (await response.json()) as RerankResponse;
    if (!Array.isArray(data.results)) {
      throw new Error('Phaseo rerank response is missing a results array.');
    }

    const ranking = data.results.map((rawRow, position) => {
      const row = rawRow as RerankRow;
      if (
        typeof row?.index !== 'number' ||
        !Number.isInteger(row.index) ||
        row.index < 0 ||
        row.index >= options.documents.values.length ||
        typeof row.relevance_score !== 'number' ||
        !Number.isFinite(row.relevance_score)
      ) {
        throw new Error(`Phaseo rerank response contains an invalid result at position ${position}.`);
      }
      return { index: row.index, relevanceScore: row.relevance_score };
    });

    const responseHeaders = Object.fromEntries(response.headers.entries());
    const metadata: Record<string, string> = {};
    const requestId = responseHeaders['x-request-id'];
    if (requestId) metadata.requestId = requestId;
    if (typeof data.id === 'string') metadata.responseId = data.id;
    if (typeof data.provider === 'string') metadata.provider = data.provider;
    if (typeof data.nativeResponseId === 'string') {
      metadata.nativeResponseId = data.nativeResponseId;
    }

    return {
      ranking,
      providerMetadata:
        Object.keys(metadata).length > 0 ? { phaseo: metadata } : undefined,
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
