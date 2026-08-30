import { describe, expect, it } from 'vitest';
import { rerank } from 'ai';
import { createPhaseo } from '../src/index.js';

describe('Phaseo Vercel AI SDK reranking compatibility', () => {
  it('reranks text documents through /rerank', async () => {
    const requests: Array<{ url: string; body: any; headers: Headers }> = [];
    const phaseo = createPhaseo({
      apiKey: 'test-key',
      baseURL: 'https://gateway.example/v1',
      fetch: async (input, init) => {
        requests.push({
          url: String(input),
          body: JSON.parse(String(init?.body ?? '{}')),
          headers: new Headers(init?.headers),
        });
        return new Response(JSON.stringify({
          id: 'rerank_123',
          model: 'cohere/rerank-v4.0-fast',
          provider: 'cohere',
          results: [
            { index: 1, relevance_score: 0.93 },
            { index: 0, relevance_score: 0.21 },
          ],
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'x-request-id': 'req_rerank_123',
          },
        });
      },
    });

    const result = await rerank({
      model: phaseo.rerankingModel('cohere/rerank-v4.0-fast'),
      query: 'best document',
      documents: ['first', 'second'],
      topN: 2,
    });

    expect(result.rerankedDocuments).toEqual(['second', 'first']);
    expect(result.ranking).toEqual([
      { originalIndex: 1, score: 0.93, document: 'second' },
      { originalIndex: 0, score: 0.21, document: 'first' },
    ]);
    expect(result.providerMetadata).toEqual({
      phaseo: {
        requestId: 'req_rerank_123',
        responseId: 'rerank_123',
        provider: 'cohere',
      },
    });
    expect(requests[0]).toMatchObject({
      url: 'https://gateway.example/v1/rerank',
      body: {
        model: 'cohere/rerank-v4.0-fast',
        query: 'best document',
        documents: ['first', 'second'],
        top_n: 2,
      },
    });
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer test-key');
  });

  it('supports structured documents and provider options', async () => {
    const requests: any[] = [];
    const phaseo = createPhaseo({
      apiKey: 'test-key',
      fetch: async (_input, init) => {
        requests.push(JSON.parse(String(init?.body ?? '{}')));
        return new Response(JSON.stringify({
          results: [{ index: 0, relevance_score: 0.8 }],
        }), { status: 200 });
      },
    });

    await rerank({
      model: phaseo.rerankingModel('voyage/rerank-2.5'),
      query: 'typescript',
      documents: [{ title: 'Guide', text: 'TypeScript handbook' }],
      topN: 1,
      providerOptions: {
        phaseo: {
          model: 'overridden-model',
          query: 'overridden-query',
          documents: ['overridden-document'],
          top_n: 99,
          return_documents: true,
          max_tokens_per_doc: 256,
        },
        other: { ignored: true },
      },
    });

    expect(requests[0]).toEqual({
      model: 'voyage/rerank-2.5',
      query: 'typescript',
      documents: [{ title: 'Guide', text: 'TypeScript handbook' }],
      top_n: 1,
      return_documents: true,
      max_tokens_per_doc: 256,
    });
  });
});
