import { generateText, jsonSchema, rerank, streamText, tool } from 'ai';
import { createPhaseo } from '../dist/index.js';

const requests = [];

const phaseo = createPhaseo({
  apiKey: 'phaseo_test',
  baseURL: 'https://phaseo.test/v1',
  fetch: async (url, init = {}) => {
    const href = String(url);
    const body =
      typeof init.body === 'string'
        ? JSON.parse(init.body)
        : init.body;
    requests.push({ href, body, headers: new Headers(init.headers) });

    if (href.endsWith('/chat/completions')) {
      if (body.stream) return streamingChatResponse();
      return jsonResponse({
        id: 'chatcmpl_test',
        object: 'chat.completion',
        created: 1,
        model: 'openai/test',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              reasoning_content: 'Checked the weather tool.',
              content: 'I need the current weather.',
              annotations: [
                {
                  type: 'url_citation',
                  url_citation: {
                    url: 'https://example.com/weather',
                    title: 'Weather source',
                  },
                },
              ],
              tool_calls: [
                {
                  id: 'call_weather',
                  type: 'function',
                  function: {
                    name: 'weather',
                    arguments: '{"city":"Toronto"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 6,
          total_tokens: 14,
          completion_tokens_details: { reasoning_tokens: 3 },
        },
      });
    }

    if (href.endsWith('/embeddings')) {
      return jsonResponse({
        data: [{ index: 0, embedding: [0.1, 0.2] }],
        usage: { total_tokens: 2 },
      });
    }

    if (href.endsWith('/rerank')) {
      return jsonResponse({
        id: 'rerank_test',
        model: body.model,
        results: [
          { index: 1, relevance_score: 0.95 },
          { index: 0, relevance_score: 0.25 },
        ],
      });
    }

    if (href.endsWith('/images/generations')) {
      return jsonResponse({ data: [{ b64_json: 'aW1hZ2U=' }] });
    }

    if (href.endsWith('/audio/transcriptions')) {
      return jsonResponse({
        text: 'transcribed',
        language: 'en',
        duration: 1,
        segments: [{ text: 'transcribed', start: 0, end: 1 }],
      });
    }

    if (href.endsWith('/audio/speech')) {
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' },
      });
    }

    throw new Error(`Unexpected URL: ${href}`);
  },
});

assert(phaseo.specificationVersion === 'v4', 'Provider is not ProviderV4');
assert(
  phaseo('openai/test').specificationVersion === 'v4',
  'Language model is not ProviderV4'
);

const weather = tool({
  description: 'Get weather',
  inputSchema: jsonSchema({
    type: 'object',
    properties: { city: { type: 'string' } },
    required: ['city'],
    additionalProperties: false,
  }),
});

const generated = await generateText({
  model: phaseo('openai/test'),
  prompt: 'What is the weather?',
  reasoning: 'medium',
  tools: { weather },
});

assert(generated.text === 'I need the current weather.', 'generateText text failed');
assert(
  generated.reasoningText === 'Checked the weather tool.',
  'Non-streaming reasoning output failed'
);
assert(generated.toolCalls.length === 1, 'Non-streaming tool call failed');
assert(
  generated.toolCalls[0].input.city === 'Toronto',
  'Tool input was not parsed'
);
assert(generated.sources.length === 1, 'URL source mapping failed');

const generateRequest = requests.find(
  (request) =>
    request.href.endsWith('/chat/completions') && request.body.stream === false
);
assert(generateRequest.body.reasoning_effort === 'medium', 'Reasoning option was not forwarded');
assert(generateRequest.body.tools?.[0]?.function?.name === 'weather', 'Tool definition was not forwarded');

await phaseo('openai/test').doGenerate({
  prompt: [{ role: 'user', content: [{ type: 'text', text: 'Return JSON' }] }],
  maxOutputTokens: 100,
  stopSequences: ['STOP'],
  responseFormat: {
    type: 'json',
    name: 'weather_response',
    description: 'Weather result',
    schema: {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      additionalProperties: false,
    },
  },
  headers: { 'x-phaseo-test': 'yes' },
});

const structuredRequest = requests.filter((request) =>
  request.href.endsWith('/chat/completions')
).at(-1);
assert(structuredRequest.body.max_tokens === 100, 'maxOutputTokens was not forwarded');
assert(structuredRequest.body.stop[0] === 'STOP', 'Stop sequences were not forwarded');
assert(
  structuredRequest.body.response_format?.type === 'json_schema',
  'JSON Schema structured output was not forwarded'
);
assert(
  structuredRequest.headers.get('x-phaseo-test') === 'yes',
  'Per-call headers were not forwarded'
);

const streamed = streamText({
  model: phaseo('openai/test'),
  prompt: 'Stream with a tool',
  tools: { weather },
  includeRawChunks: true,
});
const streamParts = [];
for await (const part of streamed.fullStream) streamParts.push(part);

assert(
  streamParts.some((part) => part.type === 'reasoning-start') &&
    streamParts.some(
      (part) => part.type === 'reasoning-delta' && part.text === 'Thinking first.'
    ) &&
    streamParts.some((part) => part.type === 'reasoning-end'),
  'Streaming reasoning lifecycle failed'
);
assert(
  streamParts.some(
    (part) =>
      part.type === 'tool-call' &&
      part.toolName === 'weather' &&
      part.input.city === 'Toronto'
  ),
  'Streaming tool call failed'
);
assert(
  streamParts.some((part) => part.type === 'text-delta' && part.text === 'Streaming answer.'),
  'Streaming text failed'
);
assert(streamParts.some((part) => part.type === 'raw'), 'Raw chunk opt-in failed');

const embedding = await phaseo.embeddingModel('openai/embedding').doEmbed({
  values: ['hello'],
});
assert(embedding.embeddings[0][1] === 0.2, 'Embedding ProviderV4 failed');

const reranked = await rerank({
  model: phaseo.rerankingModel('cohere/rerank-v4.0-fast'),
  query: 'most relevant',
  documents: ['first', 'second'],
  topN: 2,
});
assert(reranked.rerankedDocuments[0] === 'second', 'Reranking ProviderV4 failed');
const rerankRequest = requests.find((request) => request.href.endsWith('/rerank'));
assert(rerankRequest.body.top_n === 2, 'Reranking topN was not forwarded');

const image = await phaseo.imageModel('openai/image').doGenerate({
  prompt: 'A blue square',
  n: 1,
});
assert(image.images[0] === 'aW1hZ2U=', 'Image ProviderV4 failed');

const transcription = await phaseo
  .transcriptionModel('openai/transcribe')
  .doGenerate({
    audio: new Uint8Array([1, 2]),
    mediaType: 'audio/wav',
  });
assert(transcription.text === 'transcribed', 'Transcription ProviderV4 failed');

const speech = await phaseo.speechModel('openai/speech').doGenerate({
  text: 'hello',
  voice: 'alloy',
  outputFormat: 'mp3',
});
assert(speech.audio.length === 3, 'Speech ProviderV4 failed');

await assertRejects(
  () =>
    phaseo('openai/test').doGenerate({
      prompt: [
        {
          role: 'assistant',
          content: [
            {
              type: 'custom',
              kind: 'other.unsupported',
              providerOptions: {},
            },
          ],
        },
      ],
    }),
  'Unsupported ProviderV4 custom parts must fail explicitly'
);

console.log('AI SDK 7 ProviderV4 compatibility matrix passed');

function streamingChatResponse() {
  const chunks = [
    {
      id: 'chatcmpl_stream',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'openai/test',
      choices: [{ index: 0, delta: { reasoning_content: 'Thinking first.' } }],
    },
    {
      id: 'chatcmpl_stream',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { content: 'Streaming answer.' } }],
    },
    {
      id: 'chatcmpl_stream',
      object: 'chat.completion.chunk',
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: 'call_weather_stream',
                function: { name: 'weather', arguments: '{"city":' },
              },
            ],
          },
        },
      ],
    },
    {
      id: 'chatcmpl_stream',
      object: 'chat.completion.chunk',
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                function: { arguments: '"Toronto"}' },
              },
            ],
          },
        },
      ],
    },
    {
      id: 'chatcmpl_stream',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
      usage: {
        prompt_tokens: 8,
        completion_tokens: 8,
        total_tokens: 16,
        completion_tokens_details: { reasoning_tokens: 2 },
      },
    },
  ];
  const encoded =
    chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') +
    'data: [DONE]\n\n';
  return new Response(encoded, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertRejects(operation, message) {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error(message);
}
