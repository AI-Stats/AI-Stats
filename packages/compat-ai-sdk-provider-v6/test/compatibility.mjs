import {
  embed,
  experimental_generateSpeech,
  experimental_transcribe,
  generateText,
  rerank,
  streamText,
} from 'ai';
import { createPhaseo } from '../dist/index.js';

const requests = [];
const phaseo = createPhaseo({
  apiKey: 'phaseo_test',
  baseURL: 'https://phaseo.test/v1',
  fetch: async (input, init = {}) => {
    const url = String(input);
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    requests.push({ url, body, headers: new Headers(init.headers) });

    if (url.endsWith('/chat/completions') && body.stream) return streamResponse();
    if (url.endsWith('/chat/completions')) return chatResponse(body.model);
    if (url.endsWith('/embeddings')) {
      return jsonResponse({
        data: [{ index: 0, embedding: [0.1, 0.2] }],
        usage: { prompt_tokens: 2, total_tokens: 2 },
      });
    }
    if (url.endsWith('/images/generations')) {
      return jsonResponse({ data: [{ b64_json: 'aW1hZ2U=' }] });
    }
    if (url.endsWith('/audio/transcriptions')) {
      return jsonResponse({
        text: 'transcribed',
        language: 'en',
        duration: 1,
        segments: [{ text: 'transcribed', start: 0, end: 1 }],
      });
    }
    if (url.endsWith('/audio/speech')) {
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' },
      });
    }
    if (url.endsWith('/rerank')) {
      return jsonResponse({
        id: 'rerank_v6',
        model: body.model,
        provider: 'cohere',
        results: [
          { index: 1, relevance_score: 0.95 },
          { index: 0, relevance_score: 0.2 },
        ],
      }, { 'x-request-id': 'req_rerank_v6' });
    }
    throw new Error(`Unexpected URL: ${url}`);
  },
});

assert(phaseo.specificationVersion === 'v3', 'ProviderV3 marker is missing');
assert(phaseo('openai/test').provider === 'phaseo', 'language model branding failed');

const generated = await generateText({
  model: phaseo('openai/test'),
  prompt: 'Confirm compatibility',
});
assert(generated.text === 'AI SDK 6 works', 'generateText compatibility failed');

await phaseo('openai/test').doGenerate({
  prompt: [{ role: 'user', content: [{ type: 'text', text: 'Return JSON' }] }],
  responseFormat: {
    type: 'json',
    name: 'result',
    schema: {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      additionalProperties: false,
    },
  },
  tools: [
    {
      type: 'function',
      name: 'lookup',
      description: 'Look up a value',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
        additionalProperties: false,
      },
    },
  ],
});
const advancedRequest = requests.filter(request =>
  request.url.endsWith('/chat/completions')
).at(-1);
assert(
  advancedRequest.body.response_format?.type === 'json_schema',
  'structured output was not forwarded'
);
assert(
  advancedRequest.body.tools?.[0]?.function?.name === 'lookup',
  'tool definition was not forwarded'
);

const streamed = streamText({
  model: phaseo('openai/test'),
  prompt: 'Stream compatibility',
});
let streamedText = '';
for await (const chunk of streamed.textStream) streamedText += chunk;
assert(streamedText === 'AI SDK 6 streams', 'streamText compatibility failed');

const embedded = await embed({
  model: phaseo.embeddingModel('openai/text-embedding-3-small'),
  value: 'embed me',
});
assert(embedded.embedding[1] === 0.2, 'embedding compatibility failed');

const image = await phaseo.imageModel('openai/image').doGenerate({
  prompt: 'A blue square',
  n: 1,
  size: '1024x1024',
  aspectRatio: undefined,
  seed: undefined,
  providerOptions: {},
});
assert(image.images[0] === 'aW1hZ2U=', 'image compatibility failed');

const transcription = await experimental_transcribe({
  model: phaseo.transcriptionModel('openai/transcribe'),
  audio: new Uint8Array([1, 2]),
});
assert(transcription.text === 'transcribed', 'transcription compatibility failed');

const speech = await experimental_generateSpeech({
  model: phaseo.speechModel('openai/speech'),
  text: 'hello',
  voice: 'alloy',
  outputFormat: 'mp3',
});
assert(speech.audio.uint8Array.length === 3, 'speech compatibility failed');

const reranked = await rerank({
  model: phaseo.rerankingModel('cohere/rerank-v4.0-fast'),
  query: 'most relevant',
  documents: ['first', 'second'],
  topN: 2,
});
assert(reranked.rerankedDocuments[0] === 'second', 'reranking compatibility failed');
assert(
  reranked.providerMetadata?.phaseo?.requestId === 'req_rerank_v6',
  'reranking metadata failed'
);

assert(
  requests.every(request => request.headers.get('authorization') === 'Bearer phaseo_test'),
  'authorization header was not forwarded'
);

console.log('AI SDK 6 ProviderV3 compatibility passed');

function chatResponse(model) {
  return jsonResponse({
    id: 'chatcmpl_v6',
    object: 'chat.completion',
    created: 1,
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'AI SDK 6 works' },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 4, completion_tokens: 4, total_tokens: 8 },
  });
}

function streamResponse() {
  const chunks = [
    {
      id: 'chatcmpl_v6_stream',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'openai/test',
      choices: [{ index: 0, delta: { content: 'AI SDK 6 streams' } }],
    },
    {
      id: 'chatcmpl_v6_stream',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'openai/test',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 2, completion_tokens: 4, total_tokens: 6 },
    },
  ];
  const body = chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') +
    'data: [DONE]\n\n';
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function jsonResponse(value, headers = {}) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
