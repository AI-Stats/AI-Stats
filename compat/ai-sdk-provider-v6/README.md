# Phaseo provider for AI SDK 6

This maintenance release provides the Phaseo Gateway provider for Vercel AI SDK 6's ProviderV3 contract.

```bash
npm install @phaseo/ai-sdk-provider@ai-sdk-v6
```

```typescript
import { phaseo } from '@phaseo/ai-sdk-provider';
import { generateText } from 'ai';

const result = await generateText({
  model: phaseo('openai/gpt-5.6-sol'),
  prompt: 'Hello from AI SDK 6',
});

console.log(result.text);
```

Set `PHASEO_API_KEY` in the server environment. `PHASEO_BASE_URL` is optional and defaults to `https://api.phaseo.app/v1`.

This line supports ProviderV3 text generation and streaming, tools, structured output, embeddings, images, transcription, speech, and reranking. New features are developed on the current AI SDK 7 line.
