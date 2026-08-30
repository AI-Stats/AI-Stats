# Phaseo provider for AI SDK 5

This maintenance release provides the Phaseo Gateway provider for Vercel AI SDK 5's ProviderV2 contract.

```bash
npm install @phaseo/ai-sdk-provider@ai-sdk-v5 ai@ai-v5
```

```typescript
import { phaseo } from '@phaseo/ai-sdk-provider';
import { generateText } from 'ai';

const result = await generateText({
  model: phaseo('openai/gpt-4o'),
  prompt: 'Hello from AI SDK 5',
});

console.log(result.text);
```

Set `PHASEO_API_KEY` in the server environment. `PHASEO_BASE_URL` is optional and defaults to `https://api.phaseo.app/v1`.

This line supports ProviderV2 text generation and streaming, tools, structured output, embeddings, image generation, transcription, and speech. Standardized reranking was introduced in newer provider contracts and requires AI SDK 6 or 7.
