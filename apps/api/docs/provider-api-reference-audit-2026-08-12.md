# Provider API Reference Audit — 2026-08-12

## Scope and method

This log records an implementation-level comparison of every Phaseo gateway provider/capability path against the provider's current first-party API reference as retrieved on 2026-08-12. The audit follows requests from the public protocol decoder into the internal representation (IR), through capability policy and provider execution, and back through normalized responses and usage accounting.

Canonical provider families are audited once when aliases use the same upstream API contract. Alias coverage is stated explicitly. A capability is only marked checked after its request mapping, endpoint and authentication contract, response/stream mapping, errors, lifecycle behavior, and relevant usage fields have been compared. Unsupported or disabled Video and Batch surfaces remain in scope. Newly documented provider modalities are recorded even when Phaseo does not yet expose them.

Only first-party provider documentation, first-party OpenAPI specifications, and first-party SDK types/examples are treated as normative. Search-result summaries, third-party tutorials, and provider marketing pages are not sufficient evidence for a code change.

## Status legend

- `fixed`: a documented discrepancy was corrected and covered by a deterministic test.
- `verified`: the implementation matches the cited current contract; no code change was needed.
- `unsupported`: the provider documents the capability, but Phaseo intentionally has no implementation; the gap and rationale are recorded.
- `not offered`: no current first-party API reference for that provider capability was found.
- `blocked`: the first-party reference was unavailable or insufficiently precise; no speculative change was made.

## Coverage matrix

The executable inventory contains 111 exact provider-id registrations across 12 IR capabilities. Aliases that use the same upstream account, hostname, protocol, and implementation are reported as one provider family, but every registered alias is checked for equivalent routing. Batch is a separate seven-provider registry and is audited independently. Realtime sessions, Files, and video lifecycle methods are separate public surfaces and are included even though they do not use the ordinary `ProviderExecutor` interface.

| Provider family | Capability | Status | Official reference |
| --- | --- | --- | --- |
| OpenAI (`openai`, `openai-eu`) | moderations | fixed | [Moderations API reference](https://platform.openai.com/docs/api-reference/moderations), [official OpenAPI specification](https://github.com/openai/openai-openapi) |
| OpenAI (`openai`, `openai-eu`) | rerank | fixed (unsupported declaration removed) | [OpenAPI commit `11854aef`](https://github.com/openai/openai-openapi/commit/11854aef674352d3f9cd5c0a7038f079a7bbac06), [official model/API catalogue](https://developers.openai.com/api/docs/models/text-embedding-3-large) |
| OpenAI (`openai`, `openai-eu`) | embeddings | fixed | [Create embeddings](https://developers.openai.com/api/reference/resources/embeddings/methods/create), [embeddings guide](https://developers.openai.com/api/docs/guides/embeddings), [data residency](https://developers.openai.com/api/docs/guides/your-data) |
| OpenAI (`openai`, `openai-eu`) | image.generate | fixed | [Pinned OpenAPI](https://raw.githubusercontent.com/openai/openai-openapi/11854aef674352d3f9cd5c0a7038f079a7bbac06/openapi.json), [image guide](https://developers.openai.com/api/docs/guides/image-generation), [GPT Image 2](https://developers.openai.com/api/docs/models/gpt-image-2) |
| OpenAI (`openai`, `openai-eu`) | image.edit | fixed | [Image edit API](https://developers.openai.com/api/reference/resources/images/methods/edit), [image guide](https://developers.openai.com/api/docs/guides/image-generation), [GPT Image 2](https://developers.openai.com/api/docs/models/gpt-image-2) |
| OpenAI (`openai`, `openai-eu`) | text.generate | fixed | [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create), [Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [streaming](https://developers.openai.com/api/docs/guides/streaming-responses) |
| OpenAI (`openai`, `openai-eu`) | audio.speech | fixed | [Create speech](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create), [text-to-speech guide](https://developers.openai.com/api/docs/guides/text-to-speech), [GPT-4o mini TTS](https://developers.openai.com/api/docs/models/gpt-4o-mini-tts) |
| OpenAI (`openai`, `openai-eu`) | audio.translations | fixed | [Create translation](https://developers.openai.com/api/reference/resources/audio/subresources/translations/methods/create), [speech-to-text guide](https://developers.openai.com/api/docs/guides/speech-to-text), [Whisper](https://developers.openai.com/api/docs/models/whisper-1) |
| OpenAI (`openai`, `openai-eu`) | audio.transcription | fixed | [Create transcription](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create), [speech-to-text guide](https://developers.openai.com/api/docs/guides/speech-to-text), [transcription models](https://developers.openai.com/api/docs/models/gpt-4o-transcribe) |
| OpenAI (`openai`, `openai-eu`) | audio.realtime | fixed metadata/strict rejection; partial product support | [Realtime guide](https://developers.openai.com/api/docs/guides/realtime), [transcription](https://developers.openai.com/api/docs/guides/realtime-transcription), [translation](https://developers.openai.com/api/docs/guides/realtime-translation), [client secrets](https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets), [calls](https://developers.openai.com/api/reference/resources/realtime/subresources/calls) |
| OpenAI (`openai`) | video.generate and lifecycle | fixed | [Create video](https://developers.openai.com/api/reference/resources/videos/methods/create), [retrieve](https://developers.openai.com/api/reference/resources/videos/methods/retrieve), [list](https://developers.openai.com/api/reference/resources/videos/methods/list), [delete](https://developers.openai.com/api/reference/resources/videos/methods/delete), [content](https://developers.openai.com/api/reference/resources/videos/methods/download_content) |
| OpenAI (`openai`) | batch + Files dependency | fixed; list cursor gap recorded | [Create Batch](https://developers.openai.com/api/reference/resources/batches/methods/create), [Batch guide](https://developers.openai.com/api/docs/guides/batch), [upload File](https://developers.openai.com/api/reference/resources/files/methods/create), [data controls](https://developers.openai.com/api/docs/guides/your-data) |
| Azure OpenAI | text.generate | fixed | [Responses REST](https://learn.microsoft.com/en-us/rest/api/microsoft-foundry/azureopenai/responses), [v1 migration](https://learn.microsoft.com/en-us/azure/foundry/how-to/model-inference-to-openai-migration), [Chat](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/chatgpt), [API lifecycle](https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle) |
| AI21 | text.generate | fixed | [Jamba API](https://docs.ai21.com/reference/jamba-1-6-api-ref), [response](https://docs.ai21.com/reference/jamba-api-response), [models](https://docs.ai21.com/docs/jamba-foundation-models), [function calling](https://docs.ai21.com/docs/function-calling) |
| Anthropic family (`anthropic`, `anthropic-us`, `anthropic-aws`, `anthropic-aws-us`) | text.generate | fixed | [Messages](https://platform.claude.com/docs/en/api/messages/create), [Claude Platform on AWS](https://platform.claude.com/docs/en/build-with-claude/claude-platform-on-aws), [AWS Messages](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html) |
| Amazon Bedrock Mantle | text.generate | fixed | [Mantle](https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-mantle.html), [Chat Completions](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-chat-completions-mantle.html), [Messages](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-messages-api.html), [Converse](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html) |
| AkashML | text.generate | fixed | [OpenAI compatibility](https://akashml.com/docs/api-reference/openai), [Chat Completions](https://akashml.com/docs/api-reference/openai/post-v1-chat-completions), [Anthropic Messages](https://akashml.com/docs/api-reference/anthropic/post-anthropic-v1-messages), [models](https://akashml.com/docs/platform/models) |
| Arcee (`arcee`, `arcee-ai`) | text.generate | fixed | [Chat Completions](https://docs.arcee.ai/api-reference/chat-completion), [first call/auth](https://docs.arcee.ai/api-reference/your-first-api-call), [models](https://docs.arcee.ai/api-reference/models), [streaming](https://docs.arcee.ai/capabilities/streaming-messages) |
| Ambient | text.generate | fixed | [API overview](https://docs.ambient.xyz/API-27ee653486a3808f8393faae8960d0aa), [OpenAI SDK](https://docs.ambient.xyz/OpenAI-SDK-2d1e653486a380e5bdfcdb60c21b3e81?pvs=21), [live OpenAPI](https://api.ambient.xyz/openapi.json), [models](https://api.ambient.xyz/v1/models) |
| Avian | text.generate | fixed | [current API](https://avian.io/docs/), [models](https://avian.io/models/), [function calling](https://docs.avian.io/get-started/function-calling), [JSON mode](https://docs.avian.io/get-started/json-mode) |
| Aion Labs (`aion-labs`, `aionlabs`) | text.generate | fixed | [API reference](https://api.aionlabs.ai/docs/api-reference/), [models](https://www.aionlabs.ai/docs/models/), [quickstart](https://www.aionlabs.ai/docs/quickstart/) |
| Baidu Qianfan (China v2) | text.generate | fixed | [v2 overview](https://cloud.baidu.com/doc/qianfan/s/qmh4sv5vi), [Chat](https://cloud.baidu.com/doc/qianfan-api/s/3m7of64lb), [Responses](https://cloud.baidu.com/doc/qianfan-api/s/vmhejnuy8), [auth](https://cloud.baidu.com/doc/qianfan-api/s/ym9chdsy5) |
| Cerebras | text.generate | fixed | [Chat](https://inference-docs.cerebras.ai/api-reference/chat-completions), [auth](https://inference-docs.cerebras.ai/api-reference/authentication), [reasoning](https://inference-docs.cerebras.ai/capabilities/reasoning), [models](https://inference-docs.cerebras.ai/models/overview) |
| BytePlus ModelArk | text.generate | fixed | [Chat](https://docs.byteplus.com/en/docs/ModelArk/ChatCompletions), [Responses](https://docs.byteplus.com/en/docs/modelark/1585128), [structured output](https://docs.byteplus.com/en/docs/ModelArk/1958523), [video input](https://docs.byteplus.com/en/docs/ModelArk/1895586) |
| Baseten | text.generate | fixed | [LLM OpenAPI](https://docs.baseten.co/reference/inference-api/llm-openapi-spec.json), [Chat](https://docs.baseten.co/reference/inference-api/chat-completions), [reasoning](https://docs.baseten.co/inference/model-apis/reasoning), [vision](https://docs.baseten.co/inference/model-apis/vision), [audio](https://docs.baseten.co/inference/model-apis/audio) |
| Chutes | text.generate | fixed | [docs](https://chutes.ai/docs), [auth](https://chutes.ai/docs/getting-started/authentication), [vLLM](https://chutes.ai/docs/templates/vllm), [live models](https://llm.chutes.ai/v1/models) |
| Clarifai | text.generate | fixed | [OpenAI compatibility](https://docs.clarifai.com/compute/inference/open-ai/), [inference](https://docs.clarifai.com/compute/inference/), [MCP](https://docs.clarifai.com/compute/inference/mcp-servers/) |
| Cohere | text.generate | fixed | [OpenAI compatibility](https://docs.cohere.com/docs/compatibility-api), [v2 Chat](https://docs.cohere.com/v2/reference/chat), [streaming](https://docs.cohere.com/v2/reference/chat-stream), [image input](https://docs.cohere.com/v2/docs/image-inputs) |
| Cohere | embeddings | verified; native-v2 gaps recorded | [compatibility](https://docs.cohere.com/docs/compatibility-api), [v2 Embed](https://docs.cohere.com/v2/reference/embed), [models](https://docs.cohere.com/docs/cohere-embed) |
| Cohere | rerank | fixed | [v2 Rerank](https://docs.cohere.com/v2/reference/rerank), [models](https://docs.cohere.com/v2/docs/rerank), [best practices](https://docs.cohere.com/docs/reranking-best-practices) |
| Cloudflare Workers AI | text.generate | fixed | [OpenAI compatibility](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/), [REST/AI Gateway](https://developers.cloudflare.com/ai-gateway/usage/rest-api/), [models](https://developers.cloudflare.com/workers-ai/models/) |
| CrofAI | text.generate | fixed/partially blocked | [quickstart](https://crof.ai/home), [models/pricing](https://crof.ai/pricing), [docs](https://crof.ai/docs) |
| Crusoe | text.generate | fixed/partially blocked | [serverless inference](https://docs.crusoecloud.com/serverless-inference/index.html), [self-serve deployments](https://docs.crusoecloud.com/quickstart/self-serve-deployments/index.html), [metrics](https://docs.crusoecloud.com/serverless-inference/inference-metrics/index.html) |
| Darkbloom | text.generate | fixed | [console](https://console.darkbloom.dev/api-console), [API contract](https://github.com/Layr-Labs/d-inference/blob/master/docs/reference/api-contracts.md), [model catalogue](https://api.darkbloom.dev/v1/models/catalog) |
| DeepInfra | text.generate | fixed | [Chat](https://docs.deepinfra.com/api-reference/chat-completions/openai-chat-completions), [reasoning](https://docs.deepinfra.com/chat/reasoning), [structured output](https://docs.deepinfra.com/chat/structured-outputs), [OpenAPI](https://api.deepinfra.com/openapi.json) |
| DeepSeek | text.generate | fixed | [Chat](https://api-docs.deepseek.com/api/create-chat-completion), [models/pricing](https://api-docs.deepseek.com/quick_start/pricing/), [thinking](https://api-docs.deepseek.com/guides/thinking_mode), [errors](https://api-docs.deepseek.com/quick_start/error_codes/) |
| Fireworks | text.generate | fixed | [Chat](https://docs.fireworks.ai/api-reference/post-chatcompletions), [Responses](https://docs.fireworks.ai/api-reference/post-responses), [auth](https://docs.fireworks.ai/api-reference/introduction) |
| Fireworks | embeddings | fixed | [Create embeddings](https://docs.fireworks.ai/api-reference/creates-an-embedding-vector-representing-the-input-text), [guide](https://docs.fireworks.ai/guides/querying-embeddings-models) |
| Fireworks | rerank | fixed | [Rerank](https://docs.fireworks.ai/api-reference/rerank-documents), [guide](https://docs.fireworks.ai/guides/querying-embeddings-models) |
| Friendli | text.generate | fixed | [Chat](https://friendli.ai/docs/openapi/model-apis/chat-completions), [OpenAI compatibility](https://friendli.ai/docs/guides/openai-compatibility), [beta Responses](https://friendli.ai/docs/openapi/model-apis/responses), [multimodality](https://friendli.ai/docs/guides/multi-modality) |
| GMI Cloud | text.generate | fixed | [LLM API](https://docs.gmicloud.ai/inference-engine/api-reference/llm-api-reference), [rate limits](https://docs.gmicloud.ai/inference-engine/api-reference/rate-limit), [video API](https://docs.gmicloud.ai/inference-engine/api-reference/video-api-reference) |
| Groq | text.generate | fixed | [API reference](https://console.groq.com/docs/api-reference), [Responses](https://console.groq.com/docs/responses-api), [models](https://console.groq.com/docs/models), [deprecations](https://console.groq.com/docs/deprecations) |
| Hyperbolic | text.generate | fixed/contract-limited | [REST](https://docs.hyperbolic.xyz/docs/rest-api), [OpenAI compatibility](https://docs.hyperbolic.xyz/docs/inference-api), [models](https://docs.hyperbolic.xyz/docs/supported-models) |
| Infermatic | text.generate | fixed/contract-limited | [current docs](https://ui.infermatic.ai/docs), [legacy reference](https://infermatic.ai/docs/overview/) |
| Inflection | text.generate | fixed | [API reference](https://developers.inflection.ai/api/docs), [auth](https://developers.inflection.ai/docs/authentication), [models](https://developers.inflection.ai/docs/workspaces) |
| Inception Labs | text.generate | fixed | [OpenAPI](https://api.inceptionlabs.ai/openapi.json), [Chat](https://docs.inceptionlabs.ai/capabilities/chat-completions), [structured output](https://docs.inceptionlabs.ai/capabilities/structured-outputs), [tools](https://docs.inceptionlabs.ai/capabilities/tool-use) |
| Inference.net | text.generate | fixed | [quickstart](https://docs.inference.net/api/api-quickstart), [structured output](https://docs.inference.net/api/structured-outputs), [reasoning](https://docs.inference.net/api/reasoning), [vision](https://docs.inference.net/api/vision) |
| IonRouter | text.generate | fixed | [API reference](https://ionrouter.io/docs) |
| Liquid AI (`liquid`, `liquid-ai`) | text.generate | fixed/hosted contract unavailable | [docs index](https://docs.liquid.ai/llms.txt), [model library](https://docs.liquid.ai/lfm/models/complete-library), [vLLM deployment](https://docs.liquid.ai/deployment/gpu-inference/vllm) |
| LongCat | text.generate | fixed | [API overview](https://longcat.chat/platform/docs/APIDocs.html), [Chat reference](https://longcat.ai/platform/docs/zh/api/chat), [models](https://longcat.chat/platform/docs/zh/api/models.html) |
| Meta Model API (`meta`) | text.generate | fixed | [Model API](https://developer.meta.com/ai/products/meta-model-api/), [developer docs](https://dev.meta.ai/docs), [Muse Spark announcement](https://ai.meta.com/blog/introducing-muse-spark-meta-model-api/) |
| Mancer | text.generate | fixed | [Swagger](https://mancer.tech/docs-api/), [OpenAPI](https://mancer.tech/resources/api-docs-webui.yml), [models](https://mancer.tech/models?order=desc) |
| MARA | text.generate | fixed; routing remains disabled | [overview](https://mara-cloud-docs-qa.vercel.app/get-started/overview), [text generation](https://mara-cloud-docs-qa.vercel.app/api-features/text-generation), [functions/JSON](https://mara-cloud-docs-qa.vercel.app/api-features/function-calling-and-json-mode) |
| MiniMax (`minimax`, `minimax-lightning`) | text.generate | fixed | [Chat OpenAPI](https://platform.minimax.io/docs/api-reference/text/api/openapi-chat-openai.json), [Responses OpenAPI](https://platform.minimax.io/docs/api-reference/text/api/openapi-responses.json), [models](https://platform.minimax.io/docs/guides/models-intro) |
| MiniMax | image.generate, image.edit | fixed | [image guide](https://platform.minimax.io/docs/guides/image-generation), [text-to-image OpenAPI](https://platform.minimax.io/docs/api-reference/image/generation/api/text-to-image.json), [image-to-image OpenAPI](https://platform.minimax.io/docs/api-reference/image/generation/api/image-to-image.json) |
| MiniMax | video.generate and lifecycle | fixed | [video guide](https://platform.minimax.io/docs/guides/video-generation), [T2V](https://platform.minimax.io/docs/api-reference/video-generation-t2v), [I2V](https://platform.minimax.io/docs/api-reference/video-generation-i2v), [task query](https://platform.minimax.io/docs/api-reference/video-generation-query) |
| MiniMax | audio.speech | fixed | [HTTP TTS](https://platform.minimax.io/docs/api-reference/speech-t2a-http.md), [WebSocket TTS](https://platform.minimax.io/docs/api-reference/speech-t2a-websocket.md), [async TTS](https://platform.minimax.io/docs/api-reference/speech-t2a-async-create.md) |
| MiniMax (`minimax`, `minimax-lightning`) | audio.transcription, audio.translations | fixed (false declarations removed) | [complete docs index](https://platform.minimax.io/docs/llms.txt), [API overview](https://platform.minimax.io/docs/api-reference/api-overview.md), [models](https://platform.minimax.io/docs/guides/models-intro.md) |
| MiniMax | music.generate | fixed; public route remains disabled | [Music API](https://platform.minimax.io/docs/api-reference/music-generation), [guide](https://platform.minimax.io/docs/guides/music-generation), [cover preprocess](https://platform.minimax.io/docs/api-reference/music-cover-preprocess) |
| Mistral (`mistral`, `mistral-eu`) | text.generate | fixed | [Chat API](https://docs.mistral.ai/api/endpoint/chat), [regional inference](https://docs.mistral.ai/studio-api/regional-inference), [limitations](https://docs.mistral.ai/resources/known-limitations) |
| Mistral (`mistral`, `mistral-eu`) | embeddings | fixed | [Embeddings API](https://docs.mistral.ai/api/endpoint/embeddings), [regional inference](https://docs.mistral.ai/inference/regional-inference), [Codestral Embed](https://docs.mistral.ai/models/model-cards/codestral-embed-25-05) |
| Mistral | moderations | fixed | [moderation guide](https://docs.mistral.ai/studio-api/safety-moderation), [Moderation 2](https://docs.mistral.ai/models/model-cards/mistral-moderation-26-03), [official OpenAPI](https://github.com/mistralai/platform-docs-public/blob/main/openapi.yaml) |
| Mistral | OCR | fixed | [OCR API](https://docs.mistral.ai/api/endpoint/ocr), [processor guide](https://docs.mistral.ai/studio/document-processing/basic_ocr), [OCR 4](https://docs.mistral.ai/models/ocr-4-0) |
| Mistral (`mistral`; EU explicitly blocked) | Batch + Files dependency | fixed | [Batch API](https://docs.mistral.ai/api/endpoint/batch), [guide](https://docs.mistral.ai/studio/batch-processing), [Files API](https://docs.mistral.ai/api/endpoint/files), [regional limitations](https://docs.mistral.ai/inference/regional-inference) |
| Mistral | audio.transcription | fixed (new capability) | [transcription API](https://docs.mistral.ai/api/endpoint/audio/transcriptions), [offline guide](https://docs.mistral.ai/studio/audio/speech_to_text/offline_transcription), [Voxtral Mini Transcribe 2](https://docs.mistral.ai/models/model-cards/voxtral-mini-transcribe-26-02) |
| Moonshot/Kimi (`moonshot-ai`, `moonshotai`, turbo aliases) | text.generate | fixed | [Chat API](https://platform.kimi.ai/docs/api/chat), [models](https://platform.kimi.ai/docs/models), [K2.6 guide](https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart) |
| Moonshot/Kimi (`moonshotai`; aliases inferred) | Batch + Files | fixed (new capability) | [Batch guide](https://platform.kimi.ai/docs/guide/use-batch-api), [create](https://platform.kimi.ai/docs/api/batch-create), [Files upload](https://platform.kimi.ai/docs/api/files-upload) |
| Morph | text.generate | fixed | [complete docs](https://docs.morphllm.com/llms.txt), [models](https://www.morphllm.com/products/models), [pricing](https://www.morphllm.com/pricing) |
| Morpheus | text.generate | fixed | [docs index](https://apidocs.mor.org/llms.txt), [live OpenAPI](https://api.mor.org/api/v1/openapi.json), [models](https://apidocs.mor.org/documentation/models) |
| Morpheus | embeddings | fixed (new capability) | [live OpenAPI](https://api.mor.org/api/v1/openapi.json), [models](https://apidocs.mor.org/documentation/models), [LangChain example](https://apidocs.mor.org/documentation/integrations/langchain) |
| Morpheus | audio.speech | fixed; catalog disabled pending price/usage | [live OpenAPI](https://api.mor.org/api/v1/openapi.json), [models](https://apidocs.mor.org/documentation/models), [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) |
| Morpheus | audio.transcription | fixed (unsafe declaration removed) | [live OpenAPI](https://api.mor.org/api/v1/openapi.json), [models](https://apidocs.mor.org/documentation/models) |
| Nebius Token Factory (base, Fast, EU North, US Central) | text.generate | fixed | [docs index](https://docs.tokenfactory.nebius.com/llms.txt), [Chat](https://docs.tokenfactory.nebius.com/api-reference/inference/create-chat-completion), [Responses](https://docs.tokenfactory.nebius.com/api-reference/inference/create-a-response), [live models](https://tokenfactory.nebius.com/api/public/models_info) |
| Nebius Token Factory (base, EU North) | embeddings | fixed (new capability) | [Embeddings API](https://docs.tokenfactory.nebius.com/api-reference/inference/create-embeddings), [models API](https://docs.tokenfactory.nebius.com/api-reference/models/list-models), [live models](https://tokenfactory.nebius.com/api/public/models_info) |
| Nebius Token Factory (base only) | rerank | fixed (new capability) | [Rerank API](https://docs.tokenfactory.nebius.com/api-reference/inference/rerank-documents), [live OpenAPI](https://api.tokenfactory.nebius.com/openapi.json), [models API](https://docs.tokenfactory.nebius.com/api-reference/models/list-models) |
| Nebius Token Factory family | image.generate | verified unsupported/retired | [retirement notice](https://docs.tokenfactory.nebius.com/other-capabilities/deprecation-info), [live models](https://tokenfactory.nebius.com/api/public/models_info), [residual API](https://docs.tokenfactory.nebius.com/api-reference/inference/generate) |
| Nebius Token Factory | Batch + Files | blocked explicitly | [live OpenAPI](https://api.tokenfactory.nebius.com/openapi.json), [Data Lab Batch](https://docs.tokenfactory.nebius.com/data-lab/batch-inference), [operations](https://docs.tokenfactory.nebius.com/api-reference/datasets/run-operation) |
| NVIDIA NIM | text.generate | fixed | [LLM APIs](https://docs.api.nvidia.com/nim/reference/llm-apis), [LLM API reference](https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html), [VLM API](https://docs.nvidia.com/nim/vision-language-models/latest/api-reference.html) |
| Novita (`novita`, `novitaai`) | text.generate | fixed | [docs index](https://novita.ai/docs/llms.txt), [Chat API](https://novita.ai/docs/api-reference/model-apis-llm-create-chat-completion), [LLM guide](https://novita.ai/docs/guides/llm-api) |
| Novita (`novita`, `novitaai`) | embeddings, rerank | fixed (new capabilities) | [Embeddings](https://novita.ai/docs/api-reference/model-apis-llm-create-embeddings), [rerank](https://novita.ai/docs/api-reference/model-apis-llm-create-rerank), [models](https://novita.ai/models) |
| OVHcloud AI Endpoints | text.generate | fixed | [catalogue](https://www.ovhcloud.com/en/public-cloud/ai-endpoints/catalog/), [capabilities](https://help.ovhcloud.com/csm/en-sg-public-cloud-ai-endpoints-capabilities?id=kb_article_view&sysparm_article=KB0065415), [errors](https://help.ovhcloud.com/csm/en-ca-public-cloud-ai-endpoints-troubleshooting?id=kb_article_view&sysparm_article=KB0066996) |
| OVHcloud AI Endpoints | embeddings, moderations | fixed (new capabilities) | [live OpenAPI](https://oai.endpoints.kepler.ai.cloud.ovh.net/openapi.json), [catalogue](https://www.ovhcloud.com/en/public-cloud/ai-endpoints/catalog/), [Qwen3Guard](https://www.ovhcloud.com/en/public-cloud/ai-endpoints/catalog/qwen-guard-gen-8b/) |
| OVHcloud AI Endpoints | Batch + Files, audio.transcription | fixed (new capabilities) | [Batch guide](https://docs.ovhcloud.com/en/guides/public-cloud/ai-machine-learning/ai-endpoints-batch-mode), [speech guide](https://docs.ovhcloud.com/en/guides/public-cloud/ai-machine-learning/ai-endpoints-audio-models), [Whisper V3](https://www.ovhcloud.com/en/public-cloud/ai-endpoints/catalog/whisper-large-v3/) |
| Parasail | text.generate | fixed | [serverless/models](https://docs.parasail.io/parasail-docs/serverless-and-models), [Chat](https://docs.parasail.io/parasail-docs/cookbooks/chat-completions), [parameters](https://docs.parasail.io/parasail-docs/serverless/available-parameters) |
| Parasail | Batch + Files | fixed (new capability) | [Batch API](https://docs.parasail.io/parasail-docs/batch/api-reference), [JSONL format](https://docs.parasail.io/parasail-docs/batch/batch-file-format), [lifecycle](https://docs.parasail.io/parasail-docs/batch/batch-quickstart) |
| Parasail | audio.speech | blocked explicitly | [compatible endpoint reference](https://docs.parasail.io/parasail-docs/resources/silly-tavern-guide), [serverless](https://docs.parasail.io/parasail-docs/serverless/serverless), [Orpheus workflow](https://docs.parasail.io/parasail-docs/cookbooks/text-to-speech-orpheus) |
| Phala | text.generate | fixed | [current models/API](https://phala.com/confidential-ai-models), [model example](https://phala.com/models/phala/uncensored-24b), [private inference](https://phala.com/solutions/private-ai-inference) |
| Perplexity | text.generate | fixed | [Sonar API](https://docs.perplexity.ai/api-reference/sonar-post), [filters](https://docs.perplexity.ai/docs/sonar/filters), [pricing](https://docs.perplexity.ai/docs/getting-started/pricing) |
| Perplexity | embeddings | fixed (new capability) | [Embeddings API](https://docs.perplexity.ai/api-reference/embeddings-post), [pricing](https://docs.perplexity.ai/docs/getting-started/pricing) |
| Poolside | text.generate | fixed | [API overview](https://docs.poolside.ai/api/overview), [OpenAI examples](https://docs.poolside.ai/api/openai-api-examples), [models](https://poolside.ai/models) |
| Relace | text.generate | fixed | [Fast Agentic Search](https://docs.relace.ai/docs/fast-agentic-search/agent), [API introduction](https://docs.relace.ai/api-reference/introduction), [errors](https://docs.relace.ai/api-reference/errors) |
| SambaNova Cloud | text.generate | fixed | [keys/URLs](https://docs.sambanova.ai/docs/en/get-started/api-keys-urls), [OpenAI compatibility](https://docs.sambanova.ai/docs/en/features/openai-compatibility), [Chat API](https://docs.sambanova.ai/docs/api-reference/chat-completions/create-chat-based-completion) |
| Reka | text.generate | fixed | [Chat API](https://docs.reka.ai/chat/api-reference/create), [models](https://docs.reka.ai/chat/models), [multimodal Chat](https://docs.reka.ai/chat/chat-with-image-video-and-audio) |
| Scaleway Generative APIs | text.generate, embeddings | fixed | [API reference](https://www.scaleway.com/en/developers/api/generative-apis), [models](https://www.scaleway.com/en/docs/generative-apis/reference-content/supported-models/), [tools](https://www.scaleway.com/en/docs/generative-apis/how-to/use-function-calling/) |
| Scaleway Generative APIs | rerank, audio.transcription, Batch | fixed; Batch explicitly blocked | [rerank guide](https://www.scaleway.com/en/docs/generative-apis/how-to/query-reranking-models/), [audio API](https://www.scaleway.com/en/developers/api/generative-apis/audio), [Batch guide](https://www.scaleway.com/en/docs/generative-apis/how-to/use-batch-processing/) |
| Sakana AI | text.generate | fixed | [provider API/reference and pricing recorded in catalogue](https://api.sakana.ai/) |
| SiliconFlow | text.generate | fixed | [Chat API](https://docs.siliconflow.com/en/api-reference/chat-completions/chat-completions), [docs index](https://docs.siliconflow.com/llms.txt), [errors](https://docs.siliconflow.com/en/faqs/error-code) |
| Sourceful | text.generate | fixed (fabricated integration removed) | [Sourceful](https://www.sourceful.com/) |
| StreamLake | text.generate | fixed | [provider contract and evidence recorded in catalogue](https://www.streamlake.ai/) |
| StepFun | text.generate | fixed | [docs index](https://platform.stepfun.com/docs/llms.txt), [Chat API](https://platform.stepfun.com/docs/zh/api-reference/chat/chat-completion-create), [Responses API](https://platform.stepfun.com/docs/zh/api-reference/responses/responses-create) |
| xAI family (`x-ai`, `xai`, `spacex-ai`) | text/image/video/audio/Batch closure | fixed | [REST API](https://docs.x.ai/developers/rest-api-reference), [video](https://docs.x.ai/developers/rest-api-reference/inference/videos), [speech-to-text](https://docs.x.ai/developers/model-capabilities/audio/speech-to-text), [Batch](https://docs.x.ai/developers/advanced-api-usage/batch-api) |
| Together AI | text.generate, embeddings, moderations, Batch closure | fixed | [compatibility](https://docs.together.ai/docs/inference/openai-compatibility), [embeddings](https://docs.together.ai/reference/embeddings), [Batch](https://docs.together.ai/docs/inference/batch/overview) |
| Switchpoint | text.generate | fixed/contract-limited | [first-party service](https://switchpoint.dev/) |
| Alibaba/Qwen (`alibaba`, `alibaba-cloud`, `qwen`) | capability closure | fixed | [text API](https://www.alibabacloud.com/help/en/model-studio/qwen-api-reference), [embeddings](https://www.alibabacloud.com/help/en/model-studio/embedding), [Batch](https://www.alibabacloud.com/help/en/model-studio/batch-interfaces-compatible-with-openai/) |
| TensorX (`tensorx`, legacy `tensorix`) | text.generate | fixed | [current documentation](https://docs.tensorx.ai/) |
| Thinking Machines / Tinker | text.generate | fixed; beta routes disabled | [first-party Tinker service](https://thinkingmachines.ai/) |
| Google (`google-ai-studio`, `google-vertex`, `google-vertex-eu`) | capability closure | fixed | [Gemini models](https://ai.google.dev/gemini-api/docs/models), [Batch](https://ai.google.dev/gemini-api/docs/batch-api), [Vertex](https://cloud.google.com/vertex-ai/generative-ai/docs) |
| Upstage | text.generate | fixed | [first-party API](https://console.upstage.ai/docs) |
| Runway (`runway`, `runwayml`), fal, LTX | video.generate lifecycle | fixed | [Runway API](https://docs.dev.runwayml.com/api/), [fal queue](https://fal.ai/docs/documentation/model-apis/inference/queue), [LTX jobs](https://docs.ltx.io/async-jobs) |
| Atlas Cloud, ByteDance Seed/BytePlus, Black Forest Labs | media closure | fixed | [BFL docs](https://docs.bfl.ai/) |
| ElevenLabs and Suno | audio/music closure | fixed | [ElevenLabs API](https://elevenlabs.io/docs/api-reference), [Suno](https://suno.com/) |
| Xiaomi | capability closure | fixed | [first-party platform reference recorded in provider catalogue](https://platform.xiaomimimo.com/) |
| Venice (`venice`, `venice-e2ee`) | text.generate closure | fixed | [Chat API](https://docs.venice.ai/api-reference/endpoint/chat/completions), [API spec](https://docs.venice.ai/api-reference/api-spec), [E2EE](https://docs.venice.ai/guides/features/tee-e2ee-models) |
| Wafer | text.generate | fixed | [models](https://app.wafer.ai/models), [privacy](https://www.wafer.ai/privacy-policy), [terms](https://www.wafer.ai/terms) |
| Weights & Biases Inference | text.generate | fixed | [API reference](https://docs.wandb.ai/inference/api-reference), [streaming](https://docs.wandb.ai/inference/response-settings/streaming), [models](https://docs.wandb.ai/inference/models) |
| Voyage (`voyage`, `voyageai`) | text.generate, embeddings, rerank | fixed (false text removed) | [Voyage API introduction](https://docs.voyageai.com/docs/introduction) |
| Z.AI (`z-ai`, `zai`) | text.generate closure | fixed | [Chat API](https://docs.z.ai/api-reference/llm/chat-completion), [thinking](https://docs.z.ai/guides/capabilities/thinking-mode), [OpenAPI](https://docs.z.ai/openapi.json) |
| Featherless | text.generate | fixed | [Completions](https://featherless.ai/docs/completions), [models](https://featherless.ai/docs/api-reference-models), [tools](https://featherless.ai/docs/tool-calling), [vision](https://featherless.ai/docs/vision) |

## Fix log

### OpenAI - moderations

1. **Allow the documented omitted `model` field.** OpenAI documents `model` as optional with `omni-moderation-latest` as the default, but `ModerationsSchema` previously rejected requests without a model before they reached the IR. The schema now supplies Phaseo's canonical `openai/omni-moderation` identifier, allowing normal model discovery to resolve the upstream `omni-moderation-latest` slug. This restores OpenAI-compatible omitted-model requests without bypassing gateway routing or pricing.
2. **Preserve nullable legacy category flags in the IR.** OpenAI's official schema permits `null` for categories such as `illicit` and `illicit/violent` when legacy moderation models do not calculate them. `IRModerationsResult.categories` previously claimed every value was boolean. The IR type now represents `boolean | null`, preventing consumers and future transforms from treating "not calculated" as `false`.
3. **Add contract coverage for multimodal pass-through.** A focused executor test now proves that mixed text/image moderation input is sent unchanged and that `category_applied_input_types` plus nullable categories survive the provider-to-IR mapping.

Files: `src/core/schemas.ts`, `src/core/ir.ts`, `src/core/__tests__/schemas-moderations.test.ts`, `src/executors/openai/moderations/index.test.ts`.

### OpenAI - rerank

1. **Remove a nonexistent native capability.** The OpenAI-authored OpenAPI snapshot at commit `11854aef` (2026-08-12) contains 182 paths and no `/rerank` or rank-named API. Phaseo nevertheless resolved both OpenAI aliases to the shared rerank executor, which would issue `POST /v1/rerank` to an endpoint OpenAI does not provide. The `openai` and `openai-eu` rerank registrations were removed. Resolver coverage now rejects both canonical `rerank` and the `text.rerank` alias for these providers.
2. **Remove fabricated provider-mock contracts.** The generated OpenAI and OpenAI-EU mock bundles had an overlay-created `/rerank` operation. That operation, its manifests, provenance hashes, and the overlay generator entry were removed so tests cannot reintroduce or certify an invented upstream contract.
3. **Keep provider-neutral reranking intact.** The IR, public schema, protocol mapping, and shared executor remain because Cohere, Fireworks, and Voyage expose real rerank APIs. OpenAI hosted file/vector search ranking is not an arbitrary query-plus-documents rerank endpoint and is not treated as one.

Files: `src/executors/index.ts`, `src/executors/__tests__/index.test.ts`, `packages/testing/provider-mock/scripts/sync-capability-overlays.mjs`, OpenAI/OpenAI-EU provider-mock manifests/OpenAPI/provenance, and `packages/testing/provider-mock/src/openai-contract.test.ts`.

### OpenAI - embeddings

1. **Enforce documented structural input limits.** Empty strings and arrays containing more than 2,048 inputs/token arrays are now rejected by the public schema. The 8,192-token per-input and 300,000-token aggregate limits remain upstream validations because correct local enforcement requires the selected model's tokenizer.
2. **Preserve base64 embeddings end to end.** `encoding_format: "base64"` responses were decoded into empty numeric vectors because the IR only allowed `number[]`. The IR now permits the documented wire representation, and decode/encode preserve base64 strings without data loss.
3. **Return the documented OpenAI usage shape.** The public encoder now emits `prompt_tokens` and `total_tokens`; internal `input_tokens`, `embedding_tokens`, and detail meters no longer leak into the OpenAI response contract.
4. **Correct EU data residency routing.** `openai-eu` now defaults to `https://eu.api.openai.com`, and does not inherit the general `OPENAI_BASE_URL` override that could silently move EU-routed traffic to the global endpoint. The official data controls document EU storage and processing for `/v1/embeddings` and the current embedding models.
5. **Expand deterministic contract coverage.** Tests cover token-array batches, dimensions, base64 format, user, normalized provider model ids, usage and billing meters, array cardinality, and the EU URL.

Files: `src/core/schemas.ts`, `src/core/ir.ts`, `src/core/__tests__/schemas-embeddings.test.ts`, `src/protocols/openai-embeddings/{decode.ts,encode.ts,__tests__/decode-encode.test.ts}`, `src/executors/openai/embeddings/index.test.ts`, `src/providers/openai/config.ts`, and the OpenAI-compatible config test.

### OpenAI - image generation

1. **Preserve resolved response metadata and detailed usage.** Provider `background`, `output_format`, `size`, and `quality` plus nested input/output token details were lost between the native response, IR, and public response. The response IR and shared non-text encoder now retain them.
2. **Implement and verify the documented SSE contract.** Partial and completed image-generation events now have deterministic passthrough coverage, with the completed event's text/image token usage captured for pricing.
3. **Validate GPT Image requests before spending upstream quota.** Added model-scoped prompt, quality, response format, style, compression, transparency, and GPT Image 2 flexible-size constraints. Other providers' image vocabulary remains accepted outside the OpenAI model scope.
4. **Verify EU endpoint parity.** OpenAI EU generation explicitly targets `https://eu.api.openai.com/v1/images/generations`.
5. **Correct catalogue output modalities.** GPT Image 1.5 and GPT Image 2 routes no longer advertise text output; their output modality is image.

Files: image-generation regions of `src/core/schemas.ts` and `src/core/ir.ts`, `src/providers/openai/endpoints/images.ts`, shared non-text bridge/encoder, focused schema/provider/bridge/public-output tests, and the two affected OpenAI catalogue model routes.

### OpenAI - image editing

1. **Support the official multipart contract.** `File`/`Blob`, `image[]` arrays (up to 16), masks, filenames, and MIME types now survive parsing, schema validation, IR, and multipart construction. The old string-only schema rejected official curl/SDK uploads before execution.
2. **Add current model and cross-field rules.** Form string coercion, prompt limits, DALL-E 2 restrictions, GPT quality/format rules, compression/background combinations, fidelity behavior, streaming, and partial-image validation now match the current endpoint. GPT Image 2's always-high fidelity and transparent-background restriction are represented.
3. **Complete edit streaming and usage accounting.** `image_edit.partial_image` and `image_edit.completed` events pass through and final usage is billed. Invalid local media errors use the structured OpenAI error envelope.
4. **Raise the GPT image transport cap and preserve uploads.** Multiple uploads and masks are appended under the documented multipart field names without lossy conversion. Binary geometry/alpha validation remains upstream because it requires decoding customer images.

Files: image-edit regions of `src/core/schemas.ts` and `src/core/ir.ts`, `src/executors/_shared/non-text/adapter-bridge.ts`, `src/providers/openai/endpoints/images-edits.ts`, a narrow BytePlus type adjustment, and focused schema/media endpoint tests.

### OpenAI - text generation

1. **Update current Responses request controls.** `context_management` now uses the official array shape and decodes from the top level; prompt cache options/breakpoints, reasoning context, and text verbosity are represented while retaining compatible legacy provider options.
2. **Preserve current Chat controls.** Audio request configuration, prediction, moderation, optional function parameters/strictness, and allowed tool choices survive protocol decode and provider mapping.
3. **Round-trip native and custom tools losslessly.** Native Responses tools and Chat/Responses custom tools, calls, and outputs are preserved through IR instead of being narrowed to function tools.
4. **Correct Responses output and lifecycle semantics.** Public responses use `created_at`, `input_tokens`, and `output_tokens`; incomplete details, errors, refusals, annotations, cache-write meters, and audio token details are normalized without silent loss.
5. **Preserve file inputs and EU parity.** Provider input-file blocks pass through, and OpenAI-EU receives the same reasoning, metadata, idempotency, and max-completion behavior as the global alias.

Files: text-related regions of `src/core/{ir.ts,schemas.ts}`, shared content normalization, OpenAI Chat/Responses protocol decode/encode and tests, OpenAI-compatible reasoning/transforms/tests, synthetic Responses streaming, and the OpenAI text executor/tests.

### OpenAI - audio speech

1. **Expose the documented streaming contract.** `stream_format: "audio" | "sse"` is now accepted. Explicit SSE forwards `speech.audio.delta`/`speech.audio.done` unchanged and finalizes authoritative token usage.
2. **Return OpenAI-compatible binary output.** Default speech responses remain raw audio bytes with the requested MIME type instead of being converted into gateway JSON containing base64. For GPT mini TTS, the adapter may internally consume SSE to obtain authoritative usage, reconstruct the exact bytes, and still return the documented binary surface.
3. **Validate current fields and models.** The schema enforces 4,096-character input/instruction limits and speed `0.25..4`. Custom voices retain their `{id}` representation. Structured local errors cover missing voices, legacy TTS instructions, and legacy TTS SSE; upstream failures remain unchanged.
4. **Protect billing and EU routing.** Missing terminal usage on internally requested SSE returns a structured 502 before public binary output, and OpenAI-EU speech is covered on the regional endpoint.

Files: audio-speech region of `src/core/schemas.ts`, `src/providers/openai/endpoints/audio-speech.ts`, shared non-text bridge behavior, and focused schema/media/bridge tests.

### OpenAI - audio translations

1. **Correct request defaults and constraints.** The default response format is now `json` rather than `verbose_json`; temperature is `0..1`; formats are limited to `json`, `text`, `srt`, `verbose_json`, and `vtt`.
2. **Validate multipart audio safely.** The 25 MB limit and documented audio formats are enforced from upload metadata, and anonymous Blob uploads receive a MIME-derived extension.
3. **Preserve verbose response fields.** `duration` and English `language` now survive provider response to IR to public output. The OpenAI adapter continues to omit the gateway's cross-provider `language` request field because this endpoint always translates to English.
4. **Verify regional parity.** OpenAI-EU uses the regional multipart endpoint. Existing model validation correctly limits the OpenAI translation path to `whisper-1`.

Files: translation-specific schema/tests, translation response IR, `src/providers/openai/endpoints/audio-translation.ts`, shared bridge/public encoder, focused media tests, and a public audio-translation response test.

### OpenAI - audio transcription

1. **Represent the current request contract.** Added plural `languages`, `keywords`, multipart stream coercion, official response-format and temperature constraints, ISO-639-1 validation, model-specific language/keyword rules, and speaker-reference consistency checks.
2. **Validate upload metadata.** The public schema enforces the 25 MiB limit and the documented audio formats. Duration-dependent constraints remain upstream because compressed audio must be decoded to measure them reliably.
3. **Preserve rich transcription output.** Task, language(s), duration, words, segments, log probabilities, speaker diarization, and both token/duration usage variants now survive provider response through IR to the public response.
4. **Support native transcription SSE.** The provider stream is passed through while a tee captures authoritative terminal usage, with estimation retained only as a fallback.
5. **Correct catalogue classification.** `gpt-4o-transcribe-diarize` is now `audio.transcription`, with audio/text input, ASR/text output, and the documented token limits. Gateway activation was not changed without independent pricing/routing evidence.
6. **Verify repeated multipart arrays and EU routing.** Guards parse bracketed/repeated arrays correctly; EU transcription targets the regional API.

Files: transcription-specific schema/IR/guards, shared bridge/public encoder, OpenAI transcription endpoint, provider catalogue, and focused contract/schema/guard/output tests.

### OpenAI - Realtime sessions and calls

1. **Reject unsupported session types instead of silently misrouting them.** Phaseo's gated relay intentionally implements a narrower voice-agent session, not the full OpenAI proxy. The create schema is now strict and requires `type: "realtime"`; transcription, translation, nested audio, tools, and other unsupported OpenAI session bodies fail explicitly instead of having fields stripped and creating the wrong session.
2. **Correct Realtime catalogue classification.** Live transcription, translation, Whisper Realtime, Realtime mini, 2.1, and 2.1 mini now use `audio.realtime`, with documented modalities and limits. The active `gpt-realtime` alias has its missing capability and current upstream slug.
3. **Keep EU execution disabled without evidence.** Matching OpenAI-EU metadata is corrected but remains inactive because the official references do not establish EU Realtime availability and Phaseo has no EU relay.
4. **Retain the validated narrower relay.** Server authentication, `wss://api.openai.com/v1/realtime`, direct WebRTC `/v1/realtime/calls`, PCM16/24 kHz, server VAD, `marin`, safety identifier, and authoritative `response.done` billing remain covered.

Unsupported but documented gaps: full client-secret schema, dedicated live transcription and translation sessions, G.711, semantic VAD, noise reduction, custom voices, tools/MCP, reasoning/tracing/truncation, SIP lifecycle, arbitrary client events, translation drain lifecycle, and duration settlement.

### OpenAI - video generation and lifecycle

1. **Correct create request transport.** Native `seconds` and `input_reference` are represented; multipart File/Blob uploads retain media metadata, while `{file_id}`/`{image_url}` references use JSON. Unsupported gateway-only fields are not sent upstream. Prompt/model/size/duration validation covers the current endpoint plus the guide's documented newer duration/resolution superset.
2. **Preserve the complete async object.** Object type, model, native statuses, progress, timestamps, structured errors, prompt, remix source, seconds, size, and quality now survive provider response through IR/public encoding. Successful upstream HTTP status is retained instead of being forced to 202.
3. **Align collection/content/delete behavior.** List supports official cursor, limit, ordering, and `has_more`; content forwards only `video|thumbnail|spritesheet`; delete calls OpenAI before local tombstoning, applies terminal-state rules, and returns `video.deleted`.
4. **Keep cancellation disabled.** OpenAI documents no Video cancel method, so Phaseo does not invent one.
5. **Remove unsupported EU routing.** `/v1/videos` is not documented for EU regional processing/storage and is blocked for MAM/ZDR, so `openai-eu` no longer advertises `video.generate`.

Additional documented gaps: character create/retrieve, video edit, extend, remix, and Batch video creation.

### OpenAI - Batch and Files

1. **Update current endpoint coverage and limits.** OpenAI Batch now models Responses, Chat, embeddings, legacy completions, moderations, image generation/editing, and videos. The input limit is 50,000 requests/200 MB; general File reads use the documented 512 MB ceiling. Embeddings' additional 50,000-input aggregate remains provider-enforced.
2. **Enforce JSONL invariants.** Direct files and inline shorthand preserve and validate unique `custom_id`, `POST`, declared endpoint equality, object bodies, method, and URL. Legacy completions map to the text policy.
3. **Validate lifecycle options.** Completion window defaults to and requires `24h`; metadata is limited to 16 pairs with key/value lengths; `output_expires_after` uses the documented anchor/range and reaches the provider. Caller metadata is preserved without internal gateway keys overflowing the provider limit.
4. **Reuse authoritative Files retrieval.** Image/video finalization reads provider output through the shared Files content adapter and the increased bounded limit.
5. **Keep EU Batch disabled.** The current residency matrix does not list `/v1/batches` as an EU regional-processing endpoint. Files regional storage does not imply Batch regional processing.

Remaining gap: the local Batch collection exposes limit/first/last ids but does not implement an `after` cursor and currently returns `has_more: false`; proper support requires cursor-aware async-operation persistence/query work. OpenAI create has no native webhook field, so Phaseo's webhook remains local with polling/native cancellation recovery.

### Azure OpenAI - text generation

1. **Route by protocol rather than model-name guesses.** Responses always uses `{resource}/openai/v1/responses`; Chat remains `{resource}/openai/v1/chat/completions`, including GPT-5.6. The case-sensitive deployment slug stays in `model`.
2. **Use the current v1 API by default.** Removed the stale default date version. Explicit configured legacy deployment routes remain supported, and `preview` selects the documented v1 preview query.
3. **Support both documented auth modes.** Added Microsoft Entra bearer-token configuration while preserving API-key/BYOK precedence, and applied the behavior to both the IR executor and older Chat adapter.
4. **Retain shared current OpenAI behavior.** Multimodal content, tools, structured output, reasoning, streaming, usage, and structured upstream errors continue through the audited shared transformations.

Files: Azure executor/tests, provider config/Chat endpoint/tests, and runtime binding types/keys.

### AI21 - text generation

1. **Use native non-stream execution when requested.** The executor previously forced streaming for every request, which made official function tools impossible. Native non-stream JSON now maps directly into the IR for Chat, Responses, and Anthropic-facing public surfaces; streaming still follows AI21 SSE and terminal usage behavior.
2. **Represent AI21-specific request fields.** Chat accepts `n` and `documents`; the decoder retains them under `vendor.ai21` and only the AI21 mapping emits them upstream. Cross-field validation covers `n`, stream/tool constraints, text-only content, function-only tools, JSON-object output, token and sampling limits.
3. **Constrain shared behavior to the documented contract.** AI21 does not receive unsupported reasoning, penalties, seed, logprobs, parallel tools, web search, `stream_options`, strict JSON schema, or other provider leakage. Developer messages map to system. Tool argument objects are normalized to JSON strings in the gateway response.
4. **Declare explicit parameter policy.** The profile enumerates supported Jamba parameters rather than relying on broad OpenAI compatibility.

Files: AI21 executor/tests, opt-in shared streaming behavior, AI21 mappings in Chat decode/transform, Chat schema and parameter registry regions, and the AI21 provider profile.

### Anthropic family - text generation

1. **Correct Claude Platform on AWS routing and authentication.** `anthropic-aws` aliases now use `aws-external-anthropic.{region}.api.aws/v1/messages`, workspace headers, API key or SigV4 `aws-external-anthropic`, AWS request ids, and reject unsupported Fast mode. They are not Amazon Bedrock aliases.
2. **Use native current Anthropic controls.** Structured output uses `output_config.format`; strict tools, parallel-tool disabling, `tool_choice:none`, adaptive/disabled/legacy thinking, effort, and the minimum legacy thinking budget are represented.
3. **Preserve native content losslessly.** Documents/PDF/files, citations, thinking/redacted thinking/signatures, native server tools/results, and future provider blocks survive the Anthropic Messages IR path. File references activate the documented beta automatically.
4. **Finalize streaming usage authoritatively.** Anthropic and shared Bedrock Messages capture input/output tokens, cache reads, cache-creation subcounts, and final stop reasons from SSE. Current stop reasons normalize without losing resumable provider state.
5. **Update request limits and cache warm behavior.** The Messages count/top-k bounds and `max_tokens:0` cache-warm request are supported.

Files: Anthropic schemas/current-contract tests, Messages decoder, executor/stream transformer/tests, AWS transport tests, and shared Bedrock Messages usage finalization.

### Amazon Bedrock Mantle - text generation

1. **Preserve the caller's public protocol.** Chat stays Chat, Responses stays Responses, and Anthropic Messages is used only for the Anthropic protocol; model-family guesses no longer rewrite endpoint semantics.
2. **Preserve Responses state.** Removed unconditional `store:false`; explicit/default storage and `previous_response_id` pass through.
3. **Correct AWS authentication.** SigV4 uses service `bedrock`; documented Bedrock bearer-key aliases are recognized; both `api.aws` and `amazonaws.com` Mantle hostnames/regions validate.
4. **Keep Converse explicit.** Native Converse/ConverseStream has a different URL, codec, event stream, and permission model and is recorded as a separate unimplemented capability, not silently used as fallback.

Files: Bedrock Mantle executor, auth/host utilities and tests, plus runtime binding declarations.

### AkashML - text generation

1. **Declare the documented provider surface.** The Akash profile now permits the current Chat controls rather than inheriting sparse static catalogue metadata; model-specific support still comes from the provider's `/v1/models` feature and sampling-parameter fields.
2. **Preserve `n` and reasoning controls.** Chat decode/wire mapping retains `n`; reasoning effort is sent, with GPT-OSS effort normalization and explicit rejection of unsupported `none`.
3. **Capture provider diagnostics.** The official `Inference-Id` response header becomes the upstream request id.
4. **Verify translated public protocols.** Deterministic tests cover native Chat, gateway Responses/Anthropic translations, image input, JSON schema output, streaming usage, and reasoning.

Files: Akash executor/tests, shared compatibility execution/reasoning/Chat mapping, Chat decoder, and provider profile.

### Arcee - text generation

1. **Preserve documented request fields.** `n` and Arcee vendor data survive public Chat decode and IR parameter selection for both aliases.
2. **Normalize Arcee reasoning.** Non-stream `message.reasoning` and stream `delta.reasoning` map into shared reasoning content; gateway `max` effort maps to the documented maximum `high`.
3. **Declare provider policy.** The profile now states temperature and reasoning bounds plus supported `n`/reasoning controls, while the upstream remains the documented Chat endpoint.
4. **Verify alias and public-protocol translation.** Both exact resolver ids share the same contract and deterministic coverage; requested public Responses/Anthropic output is produced after the common IR path.

Files: Chat decode, shared Chat transform, Arcee executor/quirks/profile, and focused Arcee tests.

### Ambient - text generation

1. **Enable the documented Responses API.** Ambient was incorrectly forced through Chat; its config now advertises the native `/v1/responses` surface.
2. **Remove the false text-input-only restriction.** Current model discovery includes image/video inputs and audio input on one model, while outputs remain text. This affects multimodal text-generation routing, not standalone media generation.
3. **Allowlist official Ambient extensions.** Thinking budget, usage/verification event controls, enabled tools, auction control, and guided JSON are preserved in a provider-specific bridge; arbitrary undocumented raw fields remain excluded.
4. **Verify current native protocols.** Ambient exposes Chat, Responses, Anthropic Messages/token count, and legacy Completions with streaming, tools, structured output, reasoning, and usage.

Files: Ambient config, provider profile/capability tests, provider-specific compatibility quirk and tests.

### Avian - text generation

1. **Declare the proven Chat controls.** Provider policy now permits max tokens, temperature, function tools/tool choice, parallel-tool disabling, and JSON-object response format; undocumented generic parameters remain unadvertised.
2. **Normalize temperature.** Avian's documented maximum is 2.
3. **Refresh current model/provider metadata.** Added GLM-4.7, GLM-5.2, and MiMo-V2.5 with current limits/evidence and moved provider docs metadata to the current reference.
4. **Verify endpoint/auth and IR translation.** Tests cover exact URL/env/bearer headers, public Chat to Avian wire, tools/JSON mode, and response/usage normalization. Responses/Anthropic public surfaces still translate through common IR to the Chat-only upstream.

Files: Avian provider profile block, executor/config tests, and catalogue provider/model metadata.

### Aion Labs - text generation

1. **Map Aion 2.0 reasoning effort.** Gateway effort values normalize to Aion's documented `none|low|medium|high`, boolean enable defaults to medium, and the field is only emitted for Aion 2.0.
2. **Decode Aion reasoning consistently.** Top-level Responses reasoning effort, non-stream `message.reasoning`, and stream `delta.reasoning` map into IR reasoning while retaining legacy think-tag compatibility.
3. **Refresh aliases, endpoints, and model metadata.** Both aliases share Chat/Responses transport; catalogue URLs/auth/formats, active model bounds, and the Aion 2.5 sunset are current. Provider mocks now include `/v1/responses` with updated provenance.
4. **Keep unsupported features explicit.** Current docs do not establish JSON schema or other modalities, so none are inferred.

Files: Aion Chat/provider quirks and tests, Responses decode, parameter policy, provider/model catalogue, and provider mock contracts/sync metadata.

### Baidu Qianfan - text generation

1. **Enable and select the native Responses API.** Responses callers now use `/v2/responses`; Chat callers remain on `/v2/chat/completions`, avoiding route-specific reasoning controls being lost in unnecessary translation.
2. **Map Qianfan reasoning and extensions.** Neutral reasoning maps to Chat `enable_thinking`/budget/strategy/effort or Responses thinking syntax; effort normalization follows Baidu's documented high/max mapping. `penalty_score` and `expire_at` are allowlisted.
3. **Remove the false text-input-only profile.** Qianfan text-generation routes accept visual/file inputs; provider metadata now advertises Responses with official evidence.
4. **Verify aliases, auth, endpoint, multimodal profile, and protocol selection.** The China `/v2` service remains distinct from the international `/v1` endpoint, which is not silently conflated.

Files: Baidu config/executor/provider quirk/profile, quirk registry/tests, and provider catalogue metadata.

### Cerebras - text generation

1. **Stop stripping supported sampling and caching fields.** Frequency/presence penalties, logit bias, prompt cache key, and structured response format are retained.
2. **Use current reasoning controls.** `reasoning_format` is allowlisted; undocumented `max_reasoning_tokens` and deprecated `disable_reasoning` are removed, with `reasoning_effort:none` used instead. GLM `clear_thinking` remains scoped.
3. **Preserve vision usage.** Cerebras top-level `image_tokens` maps to input-image usage.
4. **Refresh provider policy/metadata.** Removed obsolete unsupported flags and recorded the official endpoint/auth/evidence.

Files: Cerebras quirk/tests, provider profile, shared Chat usage transform, and provider metadata.

### BytePlus ModelArk - text generation

1. **Enable current Responses routing.** Current model versions can use `/api/v3/responses`; request input now uses the documented `input` field, while Chat uses `max_completion_tokens`.
2. **Map provider reasoning and multimodal content.** Neutral reasoning maps to `thinking.type`; top-level Responses thinking and `reasoning_content` survive IR. Video URLs use the documented string payload. Seed 2 Lite/Mini catalogue entries now include audio understanding.
3. **Handle beta MCP correctly.** Responses requests containing MCP tools automatically send `ark-beta-mcp:true`.
4. **Refresh contract artifacts.** Endpoint/auth/formats/evidence and the Responses mock overlay/provenance now match the provider.

Files: BytePlus config/executor tests, shared transforms/quirks/registries, Responses decode, provider/model catalogue, and provider-mock contract metadata.

### Baseten - text generation

1. **Declare the hosted Model API parameter surface.** Provider policy includes current tokens/sampling/penalties/logprobs/seed/stop/stream options/n/tools/structured/user/modalities/reasoning controls and the documented temperature maximum.
2. **Preserve Baseten reasoning and `n`.** `n` reaches provider preprocessing; requests emit top-level reasoning effort plus model opt-in flags; non-stream reasoning content maps into IR.
3. **Support current multimodal wire shapes.** Public audio URL/data input parses; shared audio/video parts map to Baseten `audio_url`/`video_url`; image detail including `original` is retained.
4. **Correct model modalities and provider evidence.** Kimi K2.6, Inkling, GLM and Fast entries now reflect documented image/video/audio inputs.

Files: shared schemas/content/Chat decode/transform, Baseten quirk/executor/profile/tests, and provider/model catalogue.

### Chutes - text generation

1. **Map multimodal Chat parts.** Generic IR audio/video becomes the documented `audio_url`/`video_url`, including audio data URLs.
2. **Scope template extensions.** Allowlists `chat_template_kwargs` and maps neutral reasoning enablement to the documented Kimi/Nemotron template switches.
3. **Refresh provider evidence.** Records the shared gateway/auth/Chat contract without claiming a native Responses endpoint; the E2EE local proxy's translation does not alter upstream support.
4. **Verify live model modalities.** Shared models currently accept text/image/video/audio inputs and text output, with model-dependent tools, JSON, structured outputs, and reasoning.

Files: Chutes provider quirk/registry/tests and provider metadata.

### Clarifai - text generation

1. **Correct transport/auth.** Uses Clarifai's `/v2/ext/openai/v1` prefix and `Authorization: Key <PAT>`.
2. **Align Chat and Responses payloads.** Chat emits `max_completion_tokens`; Responses uses `input`; Clarifai model URL/path identifiers remain unchanged.
3. **Preserve the documented MCP extension.** `mcp_servers` enters IR, is recognized by policy, and routes through Chat where Clarifai documents it.
4. **Verify multimodal, tools, and structured output.** Tests cover image input, strict JSON schema, tool calls/results, usage/finish reasons, streaming, and public protocol conversion.
5. **Repair provider reference fixtures.** Current URL/prefix/Responses operation and provenance/sync metadata now match first-party docs.

Files: Clarifai config/executor/tests, shared transforms/Chat decode/policy, and provider-mock contract artifacts.

### Cohere - text generation

1. **Sanitize to the documented compatibility subset.** Unsupported tool-choice/count, logprobs, repetition/top-k, user, cache, safety, web-search, and existing excluded fields no longer leak upstream.
2. **Normalize provider limits.** Temperature is capped at 1; neutral reasoning maps to Cohere's only enabled effort `high`, and disabled reasoning to `none`.
3. **Refresh provider policy/evidence.** Capability filters and metadata now reflect the Chat-only compatibility endpoint.
4. **Retain model-scoped vision.** Command A+/Vision documents image inputs and text output, but compatibility vision needs a credentialed smoke test before broad activation.

Files: Cohere quirk/profile/tests and provider metadata.

### Cohere - embeddings

1. **Verify the compatibility subset.** The current shared executor already sends only model/input/encoding format, strips unsupported dimensions/user/provider options, uses bearer auth and the compatibility URL, preserves float/base64 embeddings, and maps usage.
2. **Add base64 contract coverage and metadata.** A deterministic test covers Cohere base64 while retaining strip assertions; provider metadata now advertises the embeddings compatibility format and native-v2 boundary evidence.

Native `/v2/embed` gaps: input type, mixed/image inputs, selectable dimensions, integer/binary dtypes, truncation, max tokens, priority, native billed/image usage, and multiple representations. Supporting them requires a dedicated native codec; they were not forced into the OpenAI-compatible executor.

### Cohere - rerank

1. **Use the native endpoint.** Cohere rerank now targets `/v2/rerank`; `/compatibility/v1/rerank` does not exist.
2. **Represent current controls and billing.** `max_tokens_per_doc`, `priority`, and response `search_units` survive public schema/IR/encoder and billing.
3. **Filter provider-specific request shape.** Object documents serialize deterministically; legacy generic fields not accepted by v2 are omitted while remaining available for other rerank providers.

Files: shared rerank executor/tests, rerank schema/IR/decode/encode, and a Cohere v2 protocol test.

### Cloudflare Workers AI - text generation

1. **Derive the official account-scoped endpoint.** `CLOUDFLARE_ACCOUNT_ID` now builds `/client/v4/accounts/{id}/ai/v1`; an explicit AI Gateway base still overrides it.
2. **Select model-supported Responses.** GPT-OSS models use Cloudflare's native Responses route; other Workers AI models remain on Chat.
3. **Map current reasoning behavior.** Top-level effort reaches Cloudflare; Kimi 2.6/2.7 use `chat_template_kwargs.thinking`, and `message/delta.reasoning` normalizes into IR.
4. **Correct vision metadata and evidence.** Kimi K2.5/K2.6 now advertise image input; provider metadata records the account-scoped API template.

Files: shared compatibility config/reasoning, Cloudflare config/quirk/executor tests, and provider/model catalogue.

### CrofAI - text generation

1. **Correct the live endpoint.** Runtime now uses `https://ai.nahcrof.com/v1/chat/completions` with bearer auth.
2. **Remove gateway leakage and preserve reasoning.** `service_tier` is stripped; buffered `reasoning_content` maps into IR (stream support already existed).
3. **Disable ended routes and refresh evidence.** Greg routes absent from the current catalogue are disabled; provider/mock metadata now points to accessible first-party material.

Blocked: the current docs payload fails and the former documentation host is unavailable, so exact sampling, tools, structured output, vision wire, streaming, usage/errors, and Responses support were not guessed.

### Crusoe - text generation

1. **Correct the inference host.** Uses `https://api.inference.crusoecloud.com/v1` with bearer `CRUSOE_API_KEY`; private base override remains.
2. **Reconcile provider/model metadata.** Current official slugs/casing and documented context limits replace stale values, with endpoint/auth/evidence recorded.
3. **Verify shared Chat transport.** Tests cover endpoint/auth/body/SSE and response/usage to IR. No native Responses endpoint is documented.

Blocked: detailed parameters/tools/structured/reasoning/errors sit behind authenticated OpenAPI, so no unsupported fields were inferred. Several current hosted models are absent from the static catalogue and are recorded for model-catalog follow-up.

### Darkbloom - text generation

1. **Enable native Responses and correct request shape.** Uses `/responses` with OpenAI input/text/tool forms rather than Chat-only or nonstandard fields.
2. **Preserve documented sampling extensions.** `top_k` and repetition penalty pass through a scoped provider quirk.
3. **Verify multimodal/tools/structured/streaming.** Current public catalogue includes text/image/video input and text output on a beta Gemma model.

Files: Darkbloom config/tests, shared Responses transform, provider quirk/registry, and executor tests.

### DeepInfra - text generation

1. **Map reasoning.** Neutral enabled/disabled/effort controls reach `reasoning_effort`; buffered reasoning content maps into IR.
2. **Allowlist provider options.** Fail-fast, min-p, stop-token ids, template kwargs, continuation, and ignore-EOS are namespaced under `provider_options.deepinfra`.
3. **Normalize policy/tiering.** Temperature maximum and reasoning are documented; canonical standard tier maps to default; provider metadata records current endpoint/auth/tier evidence.

Files: DeepInfra provider options schema/Chat decode/quirk/tests/profile and provider metadata.

### DeepSeek - text generation

1. **Remove the nonexistent Responses route.** Current V4 Flash/Pro use `/v1/chat/completions`; public Responses can still translate through IR to Chat.
2. **Map current V4 controls.** Gateway user becomes `user_id`; reasoning effort normalizes to high/max; tool-call reasoning replay is preserved while stale ordinary-turn CoT is removed; tool choice is omitted in thinking mode.
3. **Filter deprecated/unsupported fields and normalize usage.** Cache hit/miss token fields reach billing; insufficient-resource finish maps to error.
4. **Declare current text-only policy.** Temperature and reasoning bounds plus supported parameters prevent unsupported modalities/tiering/parallel-tools from being advertised.

Files: DeepSeek config/quirk/profile and shared Chat transform/tests.

### Fireworks - text generation

1. **Map model-specific reasoning controls.** Effort/enabled/token budgets reach Fireworks; buffered reasoning content maps into IR.
2. **Allowlist official extensions.** Namespaced sampling, cache, raw/performance, mirostat, echo, truncation, history, token-id, and safe-tokenization fields survive without opening arbitrary passthrough.
3. **Declare current policy/tiering.** `n`, top-k, repetition, reasoning, tier aliases, and temperature bounds are explicit; provider metadata records Chat/Responses/auth/tier evidence.

Files: Fireworks provider-options schema/Chat decode/quirk/tests/profile and provider metadata.

### Fireworks - embeddings

1. **Represent provider extensions.** Namespaced prompt template, return logits, and normalize controls survive schema/IR/decode/executor.
2. **Preserve structured template inputs.** Object/object-array inputs reach Fireworks unchanged instead of becoming `"[object Object]"`; bare multimodal arrays remain rejected.
3. **Verify endpoint, dimensions, vectors, usage, and billing.** Float output is the only first-party verified encoding.

Files: embeddings schema/IR/decode/executor/tests.

### Fireworks - rerank

1. **Use the native request/response shape.** Model, top-N, document return, and namespaced task are sent; structured documents serialize to strings; unsupported generic fields are removed.
2. **Normalize native data and usage.** Ordered `data` becomes public results with documents/scores; prompt/total tokens reach billing.

Files: shared rerank executor/tests.

### Friendli - text generation

1. **Normalize roles and reasoning.** Developer becomes system; effort/budget map to Friendli reasoning fields.
2. **Preserve `n` and documented core controls.** Multiple choices survive Chat decode/IR/wire; provider policy reflects current sampling/tools/structured/reasoning support.
3. **Correct multimodal capability declaration.** Removed false text-only profile and precisely enabled dedicated image generation/edit and transcription while keeping unsupported TTS/translation/video off.
4. **Keep native Responses model-scoped.** Beta Responses is not universal, so public Responses continues safe IR-to-Chat translation absent per-model evidence.

Files: Friendli quirk/registry, shared reasoning/Chat n mapping, provider profile/capability tests, and transform tests.

### GMI Cloud - text generation

1. **Preserve documented provider controls.** Namespaced ignore-EOS and context-length behavior survive schema/IR/wire.
2. **Declare evidence-backed Chat policy.** Temperature and documented core controls are explicit while model-specific reasoning/Responses remain unclaimed.
3. **Remove false media routing.** Image/audio/video services use a separate async request-queue API; generic OpenAI media endpoint registrations are disabled.
4. **Verify existing endpoint/auth/retry/usage behavior.** Canonical/fallback key names, namespaced model slugs, multimodal Chat, retry, and usage remain covered.

Files: GMI provider options schema/Chat decode/quirk/profile/capability tests.

### Groq - text generation

1. **Preserve Responses reasoning and current logprobs.** Neutral reasoning reaches native Responses; `top_logprobs` is retained there while unsupported Chat logprob fields remain filtered.
2. **Declare current provider policy.** Removes false text-only restriction, enables documented vision routing, and rejects unimplemented/deprecated Chat fields.
3. **Reconcile model lifecycle.** Ended Llama/Qwen routes are disabled; current Qwen vision route is active; MiniMax slug is corrected; near-term deprecations remain active as of the audit date.
4. **Refresh endpoint/auth/formats/evidence and tests.** Chat/Responses protocol bridging is deterministic.

Files: Groq quirk/profile/config/executor tests and provider/model catalogue.

### Hyperbolic - text generation

1. **Represent documented sampling.** Added min-p across public schema/IR/decode/wire, plus top-k sentinel and repetition penalty support.
2. **Filter to the published Chat contract.** Tools, structured output, reasoning, multimodal output, cache, service tier, metadata/background/safety, and stream options are not forwarded without API evidence.
3. **Declare policy/evidence and refresh mock provenance.** Temperature and supported fields are code-first.

Files: shared Chat schema/IR/decode/transform/policy, Hyperbolic quirk/tests/profile, provider metadata and mock provenance.

### Infermatic - text generation

1. **Filter to documented Chat controls.** Tools, structured output, reasoning, multimodal output, cache, tiers, metadata/background/safety, and stream options are removed without evidence.
2. **Retain supported vLLM sampling.** `n`, top-k including `-1`, min-p, repetition, and the documented temperature bound are declared.
3. **Refresh provider/mock evidence.** Current endpoint/auth/docs and provenance are recorded.

Files: Infermatic quirk/tests/profile, provider metadata, and mock provenance/sync.

### Inflection - text generation

1. **Add the missing production endpoint.** Uses `https://api.inflection.ai/v1/chat/completions` without requiring an override.
2. **Declare current Chat controls.** `n`, tools/choice/parallel, response format, stream options, logprobs, and temperature bounds are recognized.
3. **Refresh provider/mock evidence and tests.** Covers default/override URL, bearer auth, tools, JSON, streaming usage, finish reason, and token usage.

Gaps: proprietary structural-tag response format and `/v1/chat/attributes` are not represented; Pi 3.1 remains preview/non-routable; no reasoning or multimodal contract is documented.

### Inception Labs - text generation

1. **Add current reasoning modes and boolean summary controls.** `instant` is first-class; summary/wait/diffusing/realtime preserve exact wire types; summaries normalize back into reasoning content.
2. **Normalize cached usage and retry guidance.** Top-level cached input tokens reach billing; transient 429/5xx gets one retry.
3. **Declare the exact text-only policy.** Temperature/reasoning/current controls are supported; generic unsupported sampling, modalities, web search, and parallel tools are rejected.
4. **Preserve diffusing without pretending append-only semantics.** Clients must treat refinement chunks as replacement snapshots.

Files: shared schema/IR/Chat decode/usage, Inception quirk/executor/profile/tests and URL/auth test.

### Inference.net - text generation

1. **Use the documented key name.** `INFERENCE_API_KEY` is canonical; the old namespaced key remains backward compatible in the resolver/discovery/runtime bindings.
2. **Lock upstream to documented Chat.** Native Responses is not claimed; public Responses/Anthropic translate through IR.
3. **Enable vision and reasoning.** Removed false text-only routing; reasoning effort/content map through a provider quirk; provider policy lists current Chat controls.
4. **Verify direct endpoint semantics.** Proxy-mode downstream headers/keys remain a separate product path.

Files: Inference.net config/key resolver/runtime/discovery/profile/quirk/tests.

### IonRouter - text generation

1. **Route provider models to their documented hosts.** `kimi-k2.5` now uses `kimi.ionrouter.io/v1`, `minimax-m2.5` uses `minimax.ionrouter.io/v1`, and other models retain the general `api.ionrouter.io/v1` endpoint. Provider identity remains IonRouter through IR and billing.
2. **Preserve the documented system prompt.** `system_prompt` now becomes the normalized system message instead of being silently dropped.
3. **Correct capability declarations.** The Chat policy and temperature ceiling are explicit. Image generation and speech stay enabled on compatible endpoints; unsupported image editing/transcription/translation are disabled. Async video is recorded but not falsely sent through the incompatible OpenAI video lifecycle adapter.
4. **Add model-aware endpoint and policy coverage.** Dedicated base overrides, bearer auth, retry behavior, endpoint selection, and system-prompt mapping are deterministic tests.
5. **Keep internal endpoint identities executable.** The dedicated Kimi and MiniMax URL-provider IDs resolve to the same IonRouter text executor, satisfying the configured-provider invariant without changing logical provider identity or billing.

Files: IonRouter configs/executor/profile/capability mapping and focused tests.

### Liquid AI - text generation

1. **Stop dispatching to an undocumented dead host.** Current first-party material documents models and self/on-device/third-party deployment, not a hosted `api.liquid.ai` inference API; direct model and Chat probes returned 404. Both aliases now fail safely unless an explicit enterprise/self-hosted OpenAI-compatible base is configured.
2. **Keep explicit deployments usable.** `LIQUID_BASE_URL` and `LIQUID_AI_BASE_URL` remain supported, both aliases accept either documented project key spelling, and upstream routing is explicitly Chat rather than speculative Responses.
3. **Disable invalid model discovery.** Neither alias repeatedly probes the dead hosted `/v1/models` route.

Files: Liquid configs/shared key resolver, discovery exclusions, and focused tests.

### LongCat - text generation

1. **Map LongCat thinking correctly.** Normalized reasoning becomes `thinking.type=enabled|disabled`; buffered `reasoning_content`, streamed reasoning deltas, and reasoning-token usage now survive normalization.
2. **Narrow requests to the current contract.** Undocumented tools, structured output, extra sampling, multimodal/audio/cache/tier/metadata controls are removed. The policy records text-only input, reasoning, and temperature maximum 1.
3. **Refresh model and provider evidence.** LongCat 2.0 records 1M context and 131,072 maximum output; endpoint/auth/formats/provenance and focused tests are current.

Files: LongCat quirk/registry/tests/profile, provider/model catalogue, and provider-mock provenance.

### Meta Model API - text generation

1. **Prefer the official credential binding.** `MODEL_API_KEY` now wins over the legacy `META_MODEL_API_KEY` fallback, and both provider catalogues advertise the current name.
2. **Preserve native Responses reasoning.** Meta model IDs may now carry the documented top-level `reasoning_effort` through public Responses decoding into IR and the upstream Meta request.
3. **Prove the multimodal request path.** Text, image URL, video URL, audio URL/format, and PDF `input_file` content survive normalization and the native Meta Responses transform. Both standard and contributor aliases share the same endpoint and wire contract.
4. **Verify current OpenAI-compatible behavior.** Responses routing, tools/results, structured output, state, SSE, usage—including reasoning/cache/media/server-tool details—and OpenAI-shaped errors remain intact.

Files: shared Meta config/test, Responses decoder/transform tests, and both provider metadata files.

### Mancer - text generation

1. **Use the current host and prefix.** Requests now target `https://neuro.mancer.tech/oai/v1`; endpoint, bearer auth, catalogue metadata, and model evidence are current.
2. **Preserve Mancer controls through IR.** Reasoning enablement, response role, token/sampler/banned-token controls, logging and timeout extensions, JSON output, supported function tools, and `n` are mapped; rejected non-auto tool choices and unsupported stream options are removed.
3. **Handle streaming accounting correctly.** Cumulative `x-input-token`/`x-output-token` counters become normalized usage without double-counting, and `x-spent-credits` survives IR and public usage. Client streaming mode is respected so non-stream calls receive canonical usage.
4. **Normalize provider finish states.** `custom_timeout`, `constraint`, `aborted`, and `error` are errors rather than false successful stops. The text-only policy and tests cover the published contract.

Files: Mancer config/executor/quirk/profile/policy, shared IR/Chat/payload usage, catalogue, and focused tests.

### MARA - text generation

1. **Respect MARA's JSON Schema dialect.** The provider quirk forces `strict:false`; the shared OpenAI default of `true` is explicitly unsupported by MARA.
2. **Constrain reasoning and ignored fields.** `reasoning_effort=high` is forwarded only for `gpt-oss-120b`; fields MARA explicitly ignores are removed, and temperature is capped at 1 with the documented text-only policy.
3. **Correct model and provider records.** Case-sensitive upstream slugs, two missing current models, context/pricing, supported capabilities, endpoint/auth/formats, and provider-mock provenance are current. Unpublished maximum-output values are no longer inferred.
4. **Keep routing disabled.** Contract and catalogue fixes do not silently activate the provider before the broader policy is complete.

Files: MARA quirk/registry/tests/profile, provider/model catalogue, and mock reference provenance.

### MiniMax - text generation

1. **Use the current Chat fields.** MiniMax receives `max_completion_tokens`; M3 reasoning maps to adaptive/disabled thinking, `reasoning_split` survives IR and policy, video parts use `video_url`, unsupported named tool choices are removed, and schema instructions remain without an unsupported structured-output wire field.
2. **Normalize both aliases consistently.** `minimax-lightning` now gets the same reasoning-content handling as the standard alias, while its highspeed model identity remains distinct from request-level priority service tier.
3. **Respect client mode and provider errors.** Non-stream callers receive JSON rather than a forced stream; nonzero HTTP-200 `base_resp` codes map to meaningful 400/401/402/429/502 errors.
4. **Refresh current models and aliases.** M2/M3 slugs, casing, contexts/output limits, highspeed labels, M3 reasoning metadata, provider evidence, and the `minimax-latest` resolution are corrected.

Files: MiniMax executor/quirks/shared Chat transform/decode, config and error tests, provider/model catalogues and alias.

### MiniMax - image generation and reference editing

1. **Replace fabricated OpenAI media paths with the native endpoint.** Both capabilities now use JSON `POST /v1/image_generation`, not `/images/generations` or multipart `/images/edits`.
2. **Map the exact native controls.** Aspect ratio or paired dimensions, seed, count, prompt optimizer, URL/base64 format, and character `subject_reference` survive the bridge. Blob references become data URLs; MiniMax outputs and `base_resp` errors normalize correctly; billing uses request/output-image counts rather than nonexistent token usage.
3. **Represent editing honestly.** MiniMax image-to-image is reference generation, not mask/inpainting. Masks and unsupported OpenAI controls are rejected. `image-01-live` is accepted by the adapter but remains unroutable until its model/pricing record exists.
4. **Remove false Lightning media support.** The highspeed text-only offer has no official image API mapping, so its image registrations and overrides are disabled. The standard `image-01` catalogue record is corrected.

Files: native MiniMax image endpoint/tests, shared bridge, executor registry/tests, provider profiles/capability tests, and image model/catalogue records.

### MiniMax - video generation

1. **Complete the V1 request contract.** First/last frames, subject references, optimizer and fast preprocessing now reach the native executor; Blob images become validated data URLs. Undocumented quality/seed are removed, documented defaults and model/mode/duration/resolution constraints are enforced, and promptless image-to-video is accepted.
2. **Handle application errors across the lifecycle.** Nonzero HTTP-200 `base_resp` failures are mapped during create, status, and file retrieval, preventing failed tasks from appearing queued forever and preserving reservation release.
3. **Correct lifecycle and provider boundaries.** Create/query/file-download remain the documented V1 sequence; no cancel endpoint is invented. Lightning's false video registration is removed. Hailuo V1 routes are activated with accurate modes, inputs, endpoint, pricing and provenance.
4. **Keep V2 explicit.** H3 requests are rejected with a V2-not-enabled error; H3's multimodal lifecycle requires a dedicated adapter. Deprecated Video Agent endpoints and challenge-response provider callbacks are not conflated with the gateway's polling/webhook system.

Files: video schema/tests, MiniMax executor/lifecycle routes/tests, resolver, provider/model catalogue and Hailuo pricing records.

### MiniMax - speech generation

1. **Use MiniMax's native speech API.** Standard MiniMax now sends JSON to `/v1/t2a_v2`, replacing the false OpenAI `/audio/speech` path. Hex and URL outputs, binary MIME, native SSE-to-public speech events, usage characters, and HTTP-200 `base_resp` errors normalize correctly.
2. **Preserve documented controls.** Model/input/voice/speed/format plus voice/audio settings, timbre mixes, pronunciation/language/voice modification and subtitle options survive provider configuration. Cloned/designed IDs are supported; invalid models/formats/instructions and streamed WAV are rejected.
3. **Represent streaming and limits accurately.** Native hex chunks become base64 deltas and a final usage event without duplicated aggregate audio. MiniMax permits 9,999 input characters while other speech providers retain their own limits.
4. **Remove false Lightning speech support.** Speech belongs to the standard API, not the highspeed text offer. Current 2.6/2.8 model IDs are adapter-supported but remain unroutable until catalogue/pricing onboarding.

Files: speech schema/IR/non-text decoder/bridge, native MiniMax endpoint/tests, resolver and provider capability/profile tests.

### MiniMax - transcription and audio translation

1. **Remove four nonexistent provider routes.** Neither standard nor Lightning publishes `/audio/transcriptions`, `/audio/translations`, or an equivalent standalone ASR/translation contract. Both generic OpenAI-adapter registrations are removed and capability profiles explicitly reject them.
2. **Do not conflate adjacent audio inputs.** Voice-clone upload, music-cover preprocessing, file storage and H3 audio context do not return general transcription or translated audio/text; text translation and TTS language selection are likewise different capabilities.

Files: executor registry/tests and provider capability/profile tests.

### MiniMax - music generation

1. **Replace a fictitious async lifecycle with the synchronous contract.** `/v1/music_generation` now receives the documented prompt/lyrics/optimizer/instrumental/audio settings or exactly one cover reference, and returns URL or decoded hex audio plus trace ID and duration usage.
2. **Validate exact native controls and errors.** Unsupported duration/callback/arbitrary passthrough fields are removed; sample-rate/bitrate/format and cover cardinality are enforced; HTTP-success `base_resp` failures map to meaningful statuses. Streaming is explicitly rejected until the public music response can represent progressive hex output.
3. **Correct offer boundaries and records.** Lightning's false music registration is removed; the paid Music 2.6 slug and paid/free endpoint/parameter/source metadata are corrected. Public music routes remain intentionally disabled with 501.

Files: music schema/executor/tests, resolver/tests, and MiniMax music catalogue records.

### Mistral - text generation

1. **Use the official credential contract.** `MISTRAL_API_KEY` takes precedence, with the old `MISTRAL_AI_API_KEY` retained as fallback; runtime bindings and both provider catalogues are corrected.
2. **Preserve documented Chat controls.** Prompt-cache key, top-level reasoning effort, `n`, prediction, safe prompt, prompt mode and guardrails now survive public Chat through IR/policy to Mistral. Existing seed-to-random-seed, roles, tools, structured output, usage and priority handling remain intact.
3. **Correct global and EU routing metadata.** Global and EU target their documented `/v1/chat/completions` hosts. Public Responses/Anthropic translate to Chat because Mistral publishes no Responses endpoint.

Remaining gap: EU only supports function tools, but regional policy does not yet specifically reject native Mistral server tools.

Files: Mistral/shared config/runtime bindings, executor/quirk/reasoning/Chat decode-transform tests, and both provider catalogues.

### Mistral - embeddings

1. **Preserve the full current request.** Public schema/IR now retain arbitrary documented metadata; both aliases map dimensions to `output_dimension`, carry `output_dtype`, encoding format and metadata to `/v1/embeddings`.
2. **Register the EU endpoint without inventing offers.** The EU alias can resolve the embeddings executor and both provider formats advertise it, but no static EU model route is activated because Mistral makes the regional `/models` response authoritative.
3. **Refresh models and verify output handling.** Codestral Embed and Mistral Embed record their official 8,192-token contexts and provenance; float/base64 values, prompt/total usage and provider errors already normalize correctly.

Files: embedding schema/IR/codec/executor/tests, resolver/tests, both provider catalogues and embedding model records.

### Mistral - moderations

1. **Support both native moderation surfaces.** String inputs route to `/v1/moderations`; conversations and batched conversations route to `/v1/chat/moderations`. Arbitrary nullable metadata survives schema and IR.
2. **Fix false-negative results.** Mistral returns categories/scores but no OpenAI `flagged` field; public `flagged` is now derived from any true category instead of always becoming false. Request-count billing remains correct because no usage object exists.
3. **Refresh model lifecycle and regional bounds.** Retired 24.11 routing is disabled; current `mistral-moderation-2603`, categories, formats, endpoints, provenance and lineage are corrected. EU remains unregistered because its regional model catalogue has not evidenced this model.

Files: moderation schema/IR/executor/tests, resolver assertion, provider/model catalogue and lineage exception cleanup.

### Mistral - OCR

1. **Carry the complete document contract.** The schema now supports global Files IDs, document URLs, image URLs/data URLs, legacy image shorthand, page arrays/ranges, image/table/header/footer extraction, OCR 4 blocks/confidence, document/bbox annotations and prompt dependencies.
2. **Preserve structured OCR results.** Pages, Markdown, images and annotations, tables, links, dimensions, confidence, structural blocks and document annotations survive provider response through IR to public output instead of collapsing to plain text.
3. **Correct wire, usage and pricing.** `/v1/ocr` receives the native shape; processed pages/document bytes and annotated-page uplift reach billing. OCR 4 routing, slug, release/provenance and $4 OCR/$5 annotated pricing (half-price Batch) are current.
   The annotation uplift uses a second validated `input_pages` pricing line rather than introducing an unrecognized meter name, so repository-wide pricing validation remains enforceable.
4. **Keep EU unavailable without evidence.** Regional model availability varies and regional Files are unavailable; no EU OCR offer is registered.

Files: OCR schema/IR/non-text surface/bridge, native endpoint/tests, resolver assertion, model/catalogue and pricing records.

### Mistral - Batch and Files

1. **Expand the false Chat-only matrix.** All ten documented endpoints—Chat, embeddings, FIM, raw/chat moderation, OCR, raw/chat classification, conversations and transcription—now have aliases and policy routing.
2. **Preserve native lifecycle semantics.** `agent_id`, completed request counts, `inline=true` retrieval, inline outputs and late output-file fallback are supported; existing status/cancel/error-file/usage/finalization behavior remains intact.
3. **Record provider bounds honestly.** Native inline and file request ceilings, 512 MB Files and `purpose=batch` are metadata; gateway-owned upload/inspection ceilings remain lower pending streaming settlement support.
4. **Block EU explicitly.** Regional Mistral forbids Batch and Files, so its capability record exposes no input mode or endpoint and cannot accidentally inherit global processing.

Files: Batch capability/adapter/routes and their tests.

### Mistral - audio transcription

1. **Add the discovered global capability natively.** A dedicated multipart/SSE adapter supports exactly one binary file, URL or uploaded file ID, plus language, temperature, diarization, context bias, segment/word timestamps and streaming without applying OpenAI-only model/format rules.
2. **Preserve rich responses and billing.** Language, scored speaker-attributed segments, token/cache usage and prompt-audio seconds survive IR; SSE terminal usage finalizes billing at the current $0.003/audio minute.
3. **Register the current model and enforce conflicts.** Voxtral Mini Transcribe 2 is routable globally with current route/formats/params/provenance/pricing; source exclusivity, bias limits and the language/timestamp conflict are validated.
4. **Keep EU evidence-bound.** Regional availability is model-specific and Voxtral 2602 has not been evidenced on EU `/models`, so the EU alias stays unregistered.

Files: transcription schema/IR/guards/non-text bridge/surface, native endpoint/tests, resolver assertion, model/catalogue/pricing and lineage cleanup.

### Moonshot/Kimi - text generation

1. **Normalize all aliases to the current credential and host.** `MOONSHOT_API_KEY` wins with the old key as fallback; canonical and turbo aliases share the official Chat endpoint and current catalogue routing metadata.
2. **Preserve Kimi-specific request semantics.** Message partial/name, prediction, K2 thinking preservation, K3 low/high/max effort, family-wide `max_completion_tokens`, video URL conversion, current JSON Schema and K2.5/K2.6 fixed sampling/tool-choice constraints now survive IR correctly.
3. **Verify reasoning, cache and multimodal output handling.** `reasoning_content`, cached-token usage, tools, structured output and SSE normalization are covered across the alias family.

Files: shared key/config/runtime, Moonshot executor/quirks/Chat decode-transform and tests, plus canonical/turbo provider catalogues.

### Moonshot/Kimi - Batch and Files

1. **Add the discovered native Batch capability.** Active Moonshot routing accepts inline requests via JSONL upload or owned batch files for K2.5/K2.6 Chat only, with 12-hour-to-7-day windows, metadata bounds, statuses, counts, output/error files, list cursor and cancel rules.
2. **Validate native JSONL exactly.** Nonempty `.jsonl` files up to 100 MB require unique custom IDs, POST `/v1/chat/completions`, one supported model and valid bodies. Generated rows remove Kimi fixed sampling parameters; immutable uploaded rows reject them. Image/video Chat content remains intact.
3. **Preserve lifecycle and economics.** OpenAI-shaped create/get/list/cancel normalization, polling/recovery, upstream metadata, and owned file content/delete are supported; K2.5/K2.6 Batch pricing uses the official 40% discount.

Gateway Files list remains intentionally unavailable for shared provider keys to prevent cross-tenant enumeration.

Files: Batch capabilities/adapters/model aliases/routes and tests, Files routes/tests, and K2.5/K2.6 pricing.

### Morph - text generation

1. **Preserve documented reasoning and structured output.** IR reasoning now becomes nested `reasoning.effort`; the catalogue's `structured_outputs` alias reaches canonical response format instead of disappearing during preprocessing.
2. **Map Morph tiers and policy.** Standard/default and flex/standby normalize both ways; tools, JSON Schema, logprobs and low/medium/high reasoning are explicitly supported and tested with buffered/SSE usage.
3. **Refresh routes and economics.** Provider endpoint/auth/evidence, duplicate DeepSeek cleanup, Kimi K3 Fast activation, MiniMax M2.7 and GLM standby offers, and current token/cache pricing are corrected.

Files: shared reasoning/preprocess, Morph profile/executor tests, provider/model catalogue and pricing records.

### Morpheus - text generation

1. **Remove false media registrations.** Image generation/editing and audio translation do not exist in the live OpenAPI and no longer resolve. Documented speech and transcription remain for capability-specific audits.
2. **Preserve Morpheus Chat controls.** `n` and `session_id` now survive public Chat through vendor IR to the upstream request; endpoint/auth, tools, sampling, usage and SSE normalization are deterministic tests.
3. **Make the executor routable from evidence.** Added verified provider/model catalogue records and current GLM 5.2 pricing, while leaving dynamic marketplace privacy/region unknown rather than inferred.

Files: resolver/tests, Chat decode/transform, Morpheus executor test, new provider/model catalogue and pricing.

### Morpheus - embeddings

1. **Register the documented native-compatible route.** Morpheus now resolves embeddings to `/api/v1/embeddings` with Bearer auth and string/string-array inputs.
2. **Preserve session routing without leakage.** Public `session_id` is carried in Morpheus-specific IR and emitted only for Morpheus alongside encoding, dimensions and user; vector values, prompt/total usage and provider errors normalize normally.
3. **Add current model and economics.** Canonical BAAI BGE-M3 and the Morpheus `text-embedding-bge-m3` route/pricing are catalogued with 1,024 dimensions, 8,192-token text input and explicit output-attribution caveat.

Files: embedding schema/IR/decode/executor, resolver/tests, Morpheus contract test, organisation/model/provider route/pricing and manifest.

### Morpheus - speech and transcription

1. **Implement the exact speech transport but keep production routing off.** Morpheus `/audio/speech` supports Kokoro string voices, default `af_alloy`, response format/speed/session ID and binary output—not OpenAI voice objects, instructions or SSE. The canonical Kokoro/offer records are added, but remain disabled because no authoritative price or response usage is published.
2. **Remove unsafe transcription advertising.** Although the multipart endpoint documents file or S3 URL, controls, diarization and output modes, it publishes no model identity/list entry, response schema, usage or price. The executor registration is removed rather than inventing a billable route.
3. **Retain future-safe public fields.** S3 URL, output content, diarization and session ID survive normalized transcription schema/IR for later enablement when the upstream contract becomes complete.

Files: audio schemas/IR/non-text bridge/surface, OpenAI speech adapter's Morpheus branch, resolver/tests, Morpheus audio tests, Kokoro organisation/model and provider offer.

### Nebius Token Factory - text generation

1. **Route Responses by live model capability.** Models advertising `responses_api` now use the native Responses shape with correct tools/structured output/reasoning; all others safely remain on Chat. Previously every alias forced Chat.
2. **Preserve documented Chat/Responses controls.** Family profiles cover reasoning, tools, structured output and state; reasoning maps correctly for each protocol. Fast stays the same host with one `-fast` suffix.
3. **Correct regions and hosts.** The US Central data-plane host and current EU/US model allowlists are fixed, including Nemotron Super's move to US Central. All four executor aliases and provider-scoped routing keys remain supported.
4. **Refresh clear catalogue drift.** Provider evidence/flavor metadata, stale aliases, Llama slug and current Nemotron Omni EU/image/Responses entry are corrected against the live first-party model feed.

Files: Nebius configs/shared routing/Responses transform/reasoning/profile, regional context/tests, executor tests and provider/model catalogues/manifest.

### Nebius Token Factory - embeddings

1. **Register only evidenced deployments.** Base and EU North resolve embeddings for Qwen3-Embedding-8B; Fast and US Central remain disabled because the live catalogue has no such flavor/deployment.
2. **Preserve the complete wire.** Integer matrices, dimensions, float/base64, user and exact service tier round-trip through schema/IR/codec to Nebius; response tier and usage are retained.
3. **Do not bill failed validation.** Non-2xx responses such as native 422 details pass through raw instead of becoming empty successful embedding responses with request usage.
4. **Correct the model and pricing.** The route records EU North, 40,960 context, 4,096 dimensions, text-only input and $0.01/M input tokens with first-party evidence.

Files: embedding schema/IR/codec/executor/tests, resolver matrix, provider/model catalogue/pricing and manifest.

### Nebius Token Factory - rerank

1. **Register only the evidenced base route.** Qwen3-Reranker-8B resolves on the base provider; Fast and regional aliases remain disabled because no placement/flavor is published.
2. **Map the narrow native contract.** Exact service tier round-trips; structured gateway documents serialize to strings; unsupported top-N/document/chunk/priority/rank/metadata controls are stripped. Results retain native document text, scores and prompt/total usage.
3. **Preserve errors without charging.** Native 422 detail arrays pass through instead of fabricated empty successful reranks. The model record is corrected from inferred generation/VL benchmarks to text-to-rerank metadata.

Files: rerank schema/IR/codec/executor/tests, resolver matrix and Nebius/Qwen catalogue records.

### Nebius Token Factory - image generation

1. **Keep every alias unregistered.** Nebius explicitly disabled all text-to-image models/UI/API on 2026-04-13, and the live model feed contains no generation model or flavor.
2. **Do not treat residual OpenAPI as availability.** `/v1/images/generations` remains documented with a historical request schema, but has no deployable model, region, Fast flavor, pricing or usage contract. A resolver regression locks base/Fast/EU/US to unsupported.

Files: executor resolver test only; no active model/adapter/pricing was invented.

### Nebius Token Factory - Batch and Files

1. **Block the obsolete OpenAI-style assumption.** Live OpenAPI has Files but no `/v1/batches`; current Batch uses datasets, versions/mappings, `batch_inference` operations, polling/cancel and dataset export—not input/output file IDs.
2. **Record the real architectural boundary.** A planned capability exposes no input mode/endpoint and notes EU-North-only Data Lab processing. Fast/EU/US provider aliases are not advertised, and no discount is invented.

Unblocking requires a dedicated dataset/operation ownership, export, recovery, cancellation, region and pricing adapter; standalone Files cannot produce a usable gateway Batch workflow.

Files: Batch capability record and regression test.

### NVIDIA NIM - text generation

1. **Separate hosted and self-hosted auth.** NVIDIA's hosted integration still requires `NVIDIA_API_KEY`; explicit self-hosted `NVIDIA_BASE_URL` can be unauthenticated and no longer fails or emits an empty Authorization header.
2. **Map model reasoning controls.** GPT-OSS receives normalized low/medium/high `reasoning_effort`; Nemotron Omni receives its documented reasoning token budget. Existing Chat/Responses/Anthropic translation, tools, JSON Schema, SSE reasoning/usage/errors remain intact.
3. **Correct current multimodal evidence.** Provider endpoint/auth/docs and Phi-4 text/image/audio plus Nemotron Omni text/image/audio/video inputs are recorded from first-party references without enabling unpriced routes.

Files: shared NVIDIA config/reasoning, focused config/executor tests, provider/model catalogue.

### Novita - text generation

1. **Declare the current Chat contract for both aliases.** Official parameters, reasoning toggle/content, sampling, tools, JSON output, multimodal input/audio output and Chat-only routing are represented; public Responses/Anthropic translate through IR.
2. **Fix canonical provider behavior.** `novita/` model IDs participate in reasoning controls; provider endpoint/auth/evidence and alias policy are current; deterministic tests cover both aliases and SSE usage.
3. **Remove six falsely wired media capabilities.** Native Novita image/edit/speech/video APIs use model-specific `/v3` async/native endpoints, not OpenAI Images/Audio/Videos. Image generation/edit, speech, transcription, translation and video no longer resolve through incompatible generic adapters.

Files: provider capabilities/profile, resolver/tests, Novita quirks/tests, executor alias tests and provider catalogue.

### Novita - embeddings and rerank

1. **Register both exact compatible routes for both aliases.** Embeddings uses `/openai/v1/embeddings`; rerank uses `/openai/v1/rerank`, with native vector/result/usage normalization and raw error passthrough.
2. **Filter to Novita's published fields.** Unsupported embedding dimensions/user and generic rerank document/chunk/token/priority/rank/user/metadata controls are removed; structured documents serialize deterministically.
3. **Add current models and pricing.** BGE-M3 embeddings and BGE Reranker v2 M3 are active/routable with verified $0.01/M pricing and canonical model metadata. Deprecated Qwen3 Reranker remains disabled.

Files: resolver, shared embedding/rerank executors/tests, Novita provider/model catalogue, canonical reranker model, price cards and manifest.

### OVHcloud - text generation

1. **Use the documented native Responses endpoint.** OVHcloud no longer forces Chat; IR input, tools, structured output, vision, reasoning and streaming usage encode with the correct OpenAI Responses shape.
2. **Record the actual hosted contract.** Official base/token auth, French execution/data location, no retention/no training, payload/rate limits and error semantics are current.
3. **Activate only evidenced priced text routes.** Eight current text models are routable with existing price cards; the embedding model remains disabled pending its own capability audit.

Files: OVHcloud config/shared Responses transform/reasoning/tests, provider/model catalogue.

### OVHcloud - embeddings and moderation

1. **Register the real compatible embedding route.** Qwen3-Embedding and two BGE models use `/v1/embeddings` with exact input/encoding/dimensions/user/vector/usage handling, batch/dimension/context limits, French regions and verified pricing.
2. **Implement moderation on its actual Chat contract.** Qwen3Guard is not `/v1/moderations`; a dedicated adapter submits one deterministic Chat classification per input, parses Safety/Categories/Refusal, flags Unsafe and Controversial conservatively, aggregates usage and preserves native errors/raw output.
3. **Reject malformed assumptions.** Multimodal moderation input and unrecognized guard output fail explicitly. Both current guard models are active with free-beta price cards and corrected moderation-only metadata.

Files: resolver, OVH embedding tests/native moderation executor/tests, provider/model catalogues, canonical BGE/guard records, price cards and manifest.

### OVHcloud - Batch/Files and transcription

1. **Add the full OpenAI-compatible Batch lifecycle.** File or inline JSONL Chat/Responses/embeddings batches support 200 MB/50k rows, 24/48/72h windows (48h default), five concurrent jobs, statuses/list/cancel/results, 15-day files, recovery and 50% reservation/settlement discount behind the existing preview gate.
2. **Add native Whisper transcription.** Both V3 models, current formats, language/prompt/temp/timestamps/diarization/VAD and rich words/segments/diarization responses are supported; authoritative duration reaches per-second billing.
3. **Remove OpenAI-specific false limits.** OVH's 2 GB/3-hour provider limits replace 25 MB schema rejection; unsupported streaming/logprobs/SRT/VTT and invalid combinations fail locally. Runtime ingress may still be lower and needs future object-storage/direct upload for very large files.

Files: Batch capabilities/adapters/reservation/finalization/routes/tests, transcription schema/IR/bridge/native adapter/public surface/tests, resolver, provider/model catalogue/pricing and manifest.

### Parasail - text generation

1. **Correct the production domain.** All requests and model discovery now use authoritative `api.parasail.io/v1`, replacing the invalid `.ai` host; Bearer auth and Chat-only routing are exact tests.
2. **Verify current vLLM behavior without inventing routes.** Sampling, tools, model-dependent structured output, DeepSeek thinking, buffered/SSE usage and billing follow the compatible Chat contract.
3. **Keep catalogue activation evidence-bound.** Authenticated `/models` is authoritative and no credential was available, so stale/nonpublic-slug offers remain non-routable while BYOK execution works.

Files: Parasail config/shared URL tests and executor contract tests.

### Parasail - Batch and Files

1. **Add the distinct-host native lifecycle.** Files/uploads and Batch create/get/list/cancel/results use `api.saas.parasail.io/v1` (or batch override), never the interactive serverless host.
2. **Support exact standard JSONL.** Inline or file-backed Chat/embeddings rows permit 50,000 requests/100 MB, unique custom IDs, POST-only supported URLs, nonstream bodies, multi-model rows and output correlation. Metadata/content/delete/poll/recovery share the correct host.
3. **Record economics and image boundary.** Standard Batch is 50% off with 30-day input retention. Separate 500 MB raw-base64 image batch lacks a complete endpoint/row contract and remains explicitly unexposed rather than being forced into standard JSONL.

Files: Batch capabilities/adapters/routes/Files limits and focused tests.

### Parasail - speech

1. **Block unsafe generic adapter inheritance.** A compatible `/audio/speech` route, one model and ten voices are documented, but request limits/formats/speed/instructions/streaming, binary media, errors, usage and pricing are not.
2. **Do not substitute incompatible assumptions.** OpenAI's voice/format/SSE validator would reject Parasail `sky`, accept unsupported voices and fabricate unpriced character usage. Orpheus uses token completions plus client SNAC decoding and is not the same endpoint.

Provider capability and resolver tests explicitly keep speech off until an exact schema, response container and tariff exist.

Files: Parasail provider capability override and capability/resolver tests.

### Phala - text generation

1. **Replace the retired RedPill host.** Chat requests now target `inference.phala.com/v1` with Bearer auth; no unsupported Responses route is claimed.
2. **Preserve attestation evidence.** Receipt/keyset and related provider identity headers survive the executor alongside OpenAI-compatible content, tools, SSE and usage/billing.
3. **Keep modalities model-scoped.** Image/video/file understanding is Chat input on eligible models, not native media generation. Explicit provider overrides prevent generic image/audio/video output capability inheritance.
4. **Avoid speculative catalogue activation.** Current public pages are broad and evolving but no deterministic unauthenticated model feed exists; BYOK works on the correct host while stale offers remain gated.

Files: Phala config/shared tests, executor test, provider profile/capability test and provider catalogue.

### Perplexity - text generation

1. **Route to the actual Sonar endpoint.** Hosted requests use `/v1/sonar`, not `/v1/chat/completions`; exact URL and current docs are covered.
2. **Map search controls and results without loss.** Public web search options split into Sonar's documented top-level filters while retaining nested context/location. Buffered and streamed Chat/Responses preserve citations, search results, images, related questions, reasoning steps and cost/search/citation/query usage.
3. **Correct capability boundaries and billing.** The text-only profile removes false generic media/OCR registrations; deep-research search-query counts reach the native search billing meter.

Files: Perplexity config/quirk/profile/capability mapping, shared IR/Chat/Responses/stream usage and focused tests.

### Perplexity - embeddings

1. **Register standard embeddings exactly.** `/v1/embeddings` supports the two current PPLX Embed models with text-only input, 512-item maximum, model dimensions and documented base64 quantized encodings.
2. **Preserve provider cost and pricing.** Native usage cost survives normalization; canonical provider/models and verified $0.004/$0.03 per million-token price cards are added.
3. **Reject contextualized embeddings explicitly.** Their nested documents/chunks request and nested response cannot be losslessly represented by the current OpenAI embedding IR, so the separate endpoint remains a documented gap rather than flattened incorrectly.

Files: embedding schema/IR/executor/tests, resolver assertion, provider/canonical model catalogue, price cards and manifest.

### Poolside - text generation

1. **Resolve recurring path drift.** Hosted and self-managed references use `/v1`; default and override tests now expect `inference.poolside.ai/v1/chat/completions` without duplicate prefixes.
2. **Preserve thinking and replay.** IR reasoning enable/none maps to `chat_template_kwargs.enable_thinking`; completed and assistant/tool replay `reasoning_content` survive normalization.
3. **Declare the exact text-only policy.** Token/sampling controls, tools/parallel calls, reasoning and temperature max 2 are represented; public Responses/Messages safely bridge to Chat because no Responses API is published.
4. **Refresh provider evidence and tests.** Auth, route aliases, hosted slugs, reasoning, tools, SSE running/final usage and response bridges are deterministic.

Files: Poolside URL tests, quirk/registry/shared Chat replay, provider profile/tests, executor tests and provider catalogue.

### Relace - text generation

1. **Use the documented model-specific endpoint.** `relace-search` now targets `models.relace.ai/v1/search/chat/completions`, replacing the nonexistent/general API base and wrong namespaced slug.
2. **Advertise only evidenced behavior.** Text/tool calling and temperature/top-p/top-k/repetition are retained; speculative token limits, structured output, stop, seed and max-token claims are removed. Shared preprocessing now retains decoded repetition penalty.
3. **Activate and verify the route.** Endpoint/auth/formats/modalities/tools/evidence and focused URL/request/tool/usage tests are current.

Files: Relace config/tests, executor test, shared preprocessing and provider/model catalogue.

### SambaNova - text generation

1. **Add the missing hosted endpoint and Responses routing.** Cloud now defaults to `api.sambanova.ai/v1` and uses native Responses where requested instead of falsely forcing Chat.
2. **Enforce the documented parameter contract.** The text-only profile/quirk carries top-k/reasoning into Responses, enforces `n` and tool constraints, and drops ignored penalties/logit bias/unsupported parallel tools; SSE, cache/reasoning usage and errors remain normalized.
3. **Activate verified priced routes.** MiniMax M2.7, DeepSeek V3.2 and GPT-OSS 120B slugs/routes/prices plus provider evidence are corrected and routable.

Files: SambaNova config/quirk/profile/tests, executor transport test, provider/model catalogue and pricing.

### Reka - text generation

1. **Use the native authentication contracts.** Chat/model discovery now sends `X-Api-Key`; execution also retains Bearer for the current Research contract sharing the host. Routing remains Chat-only.
2. **Preserve Reka multimodal/tool wire shapes.** Forced tool choice maps `required` to `tool`; video/audio URLs use native scalar forms; image/video/audio inputs, tools, token usage and SSE bridge through IR. The false text-only profile is removed.
3. **Add current provider/model records.** Reka organisation, Flash/Edge/versioned Edge/Research models, multimodal/tool/structured/search facts, routes and discovery metadata are verified and manifest-synced.

Files: Reka config/shared auth/discovery, quirk/profile/tests, executor test, organisation/provider/model catalogues and manifest.

### Scaleway - text generation and embeddings

1. **Enable the published Responses API.** Scaleway now routes native Responses and filters the exact unsupported state/built-in/custom-tool fields instead of forcing Chat. Model-dependent image/audio input, functions and structured output remain supported.
2. **Declare exact provider policy and EU hosting.** Paris host/Bearer auth, protocol-specific exclusions, region/data metadata and deterministic transport/quirk tests are current.
3. **Activate evidenced priced routes and embeddings.** Five existing current model routes are verified/routable, and the OpenAI-shaped embeddings executor is registered. The official inventory is much broader, so bulk catalogue expansion/EOL cleanup remains separate.

Files: Scaleway config/profile/quirk/capability tests, resolver and provider/model catalogue.

### Scaleway - rerank, transcription and Batch

1. **Add evidenced rerank and transcription.** Rerank sends only model/query/string documents/top-N and preserves document/usage results. Whisper transcription uses native multipart JSON/stream controls, exact formats/25 MB limit and €0.003/minute pricing.
2. **Block false media inheritance.** The provider profile now exposes only exact supported capabilities, preventing speech/translation/image/video assumptions.
3. **Record Batch as planned/blocked.** Native Batch requires a same-project S3 URL, service-principal permissions and S3 result objects; it has no compatible Files API. A safe activation needs an owned S3 URL bridge despite the otherwise documented 50k/200 MB/24h/50%-discount lifecycle.

Files: Batch capability/tests, resolver/profile, shared rerank/transcription adapters/tests, Scaleway model catalogue and price cards.

### Sakana AI - text generation

1. **Use native Responses rather than forced Chat.** Sakana now receives real Responses input/tools/text format and multimodal content with correct Bearer routing.
2. **Map model-specific reasoning and usage.** Ultra/v1.1 keep `max`; older Fugu/Cyber normalize to xhigh. Separately billed orchestration and orchestration-cache tokens survive usage and pricing.
3. **Correct capability and route activation.** False text-only policy is removed; verified Ultra and Namazu routes are active. Dynamic-price Fugu and access-gated/contact-sales Cyber stay disabled, and stale Cyber fixed pricing is deleted.

Files: Sakana executor/test, quirks/tests, shared Responses shape/profile, provider/model/pricing catalogue and manifest.

### SiliconFlow - text generation

1. **Force the documented Chat route.** No Responses API exists; thinking enable/budget and reasoning content now round-trip through IR, including assistant replay and `n`.
2. **Handle current operational behavior.** One retry covers documented transient 429/503/504; exact text parameter policy, trace/usage and provider evidence are tested.
3. **Correct media boundaries.** Image generation, speech and transcription remain; absent image edit/translation and incompatible async video are explicitly disabled. Native embeddings/rerank await separate audits.

Files: SiliconFlow config/executor/quirk/profile/shared Chat decode-transform/tests and provider catalogue.

### Sourceful - removed false text integration

No first-party OpenAI-compatible text inference contract, host, credential, models, usage or streaming API exists. Sourceful directs developers to partner Runware for Riverflow visual APIs. The false compatible config/adapter/executor/discovery registration is removed; Riverflow records now describe text/image-to-image product modalities without claiming verified API slugs.

Files: Sourceful config/adapter/resolver/discovery cleanup, negative tests and Riverflow catalogue records.

### StreamLake - text generation

The PAYG OpenAI-compatible gateway, preset versus custom endpoint model IDs, Bearer/API-key auth, SSE and token/cache usage are verified. Provider policy/evidence and an end-to-end test were added; KAT Coder Air/Pro routes and official input/cache/output pricing are active. A Qwen vision/video-understanding route is recorded disabled pending exact slug/pricing. Coding Plan and legacy VOD are separate products.

Files: StreamLake config/profile/executor test, provider/model catalogue, pricing and manifest.

### StepFun - text generation

Step 3.7 Flash alone routes native Responses; other models remain Chat. OpenAI Responses shapes, JSON-schema strict-default false, model-specific controls, reasoning format/effort/content replay, `n`, audio PCM output and retry behavior are corrected. The exact provider policy enables documented image/edit/speech/transcription adjacency while blocking translation/video generation. Provider evidence and focused Chat/Responses tests are current; routes remain conservatively unroutable pending direct pricing/model sync.

Files: StepFun routing/executor/quirks/reasoning/shared transforms/schema/profile/tests and provider catalogue.

### xAI family - capability closure

Native Chat/Responses, image generation and async video remain. Image editing is corrected from OpenAI multipart to xAI JSON image objects; unsupported OpenAI edit controls fail locally. Transcription now uses `/v1/stt` multipart with ordering/keyterms/diarization/duration, 500 MB limit and $0.10/hour `grok-transcribe`; speech honors the 15,000-character xAI limit. Nonexistent audio translation is removed from all aliases. Batch endpoint coverage now includes Chat/Responses/image/video/edit/extension but remains preview-blocked by authenticated 403; Realtime/WebSocket/SIP and video extension remain adjacent dedicated surfaces.

Files: xAI native image/STT/speech schema/bridge/tests, resolver/profile/capabilities, Batch matrix/tests, provider/model/pricing catalogue.

### Together AI - capability closure

Canonical routing now uses `api.together.ai`. Text/embeddings remain, with embeddings narrowed to model plus text input. The nonexistent `/moderations` registration is removed—safety models use Chat. Files upload uses `/v1/files/upload`; Batch handles the wrapped 201 job response and fixed 24h window. Documented native image/audio/video/rerank surfaces remain unregistered because current generic adapters would lose Together controls or target the wrong lifecycle/version.

Files: Together config/resolver/embedding tests, Batch/Files adapters/routes/tests and provider mocks.

### Switchpoint - text generation

The endpoint is corrected to `switchpoint.dev/v1`, Responses is explicitly disabled, and the executor follows client stream mode instead of forcing streaming/stream options. Policy is restricted to the only published contract: Chat messages with model `auto-router` and optional streaming; tools, structured output, reasoning and media are rejected. No deterministic model pricing/catalogue or adjacent API was invented.

Files: Switchpoint config/executor/profile and focused tests.

### Alibaba/Qwen family - capability closure

Text remains and all aliases accept official `DASHSCOPE_API_KEY`. Compatible embeddings are registered across aliases; native async video remains with official-key support throughout lifecycle. False generic OpenAI image/edit and audio speech/transcription/translation registrations are removed because DashScope uses native regional async/WebSocket contracts. Alibaba Cloud gains experimental OpenAI-compatible file-backed Batch for Chat/embeddings with fixed 24h lifecycle. Native multimodal fused embeddings remain unexposed because the current IR cannot represent them losslessly.

Files: provider auth/config, resolver/profile tests, embedding/video executors, Batch capabilities/adapters/routes/tests and provider catalogue.

### TensorX - text generation

The renamed provider now uses `api.tensorx.ai`; canonical `tensorx` and legacy `tensorix` aliases share Chat-only, client-controlled streaming. Exact tools/JSON/reasoning/cache policy and tests replace broad compatibility assumptions. Provider metadata is verified but routes remain disabled until current priced model records exist.

Files: TensorX config/aliases/executor/profile/tests and provider catalogue.

### Thinking Machines / Tinker - text generation

The low-traffic beta compatible service supports Chat/legacy completions using a user-owned `tinker://.../sampler_weights/...` checkpoint—not static base model IDs. The executor forces Chat, follows client streaming and maps documented reasoning effort. Falsely routable Inkling rows are deactivated and provider metadata explicitly records beta/unroutable status.

Files: Tinker executor/profile/tests and provider/model catalogue.

### Google family - capability closure

Native Gemini/Vertex text remains. AI Studio retains embeddings, native image generation, TTS, Lyria music and gains the missing native Veo registration; false standalone moderation, image edit, transcription and translation routes are removed. Vertex retains native Veo but loses generic OpenAI-shaped image/edit/TTS/audio registrations; native Vertex embeddings/media need dedicated executors. Lyria catalogue/pricing moves from text to music. AI Studio Batch is validated with exact inline/Files limits and discount; Vertex regional GCS/BigQuery Batch is planned/blocked pending an owned ADC/storage/job bridge.

Files: resolver/profile/capability/Batch tests, Google provider/model catalogues and Lyria pricing trees.

### Upstage - text generation

The invalid `/v1/solar/chat/completions` path is corrected to the official `/v1/chat/completions`; native Responses stays off and the executor follows client stream mode. Exact max-token/sampling/tool/structured-output/reasoning policy and mapping are tested; existing Solar catalogue/pricing remains current.

Files: Upstage config/executor/profile/reasoning/tests.

### Runway, fal and LTX - video lifecycle

Runway now accepts official secret naming through create/poll/cancel, normalizes output arrays and cancelled states. fal queue cancellation uses its encoded endpoint/request identity and native Key-auth PUT lifecycle, ready behind the globally disabled cancel gate. LTX audio-to-video bills/reserves actual source duration instead of a fixed 20 seconds. Provider verification is refreshed; edit/extend/retake/audio/performance operations remain explicit capability/IR gaps rather than overloaded into generation.

Files: runtime env, Runway/LTX executors/tests, video reconciliation/helpers/routes/tests and provider catalogues.

### Atlas Cloud, ByteDance Seed/BytePlus and Black Forest Labs - media closure

Atlas Cloud retains dedicated text plus native async video; false generic OpenAI image/edit/speech/transcription/translation registrations are removed for both aliases. Seedance create now uses top-level output fields, normalized supported resolution and typed last/reference-image content roles, dropping invalid legacy fields. BytePlus Seedream's native image route and BFL's x-key create/poll/result lifecycle were verified already correct.

Files: resolver/tests and Seedance executor/tests.

### ElevenLabs and Suno - audio/music closure

ElevenLabs retains native TTS/STT/music: current Scribe v1/v2 transcription routes and diarization/events/speaker/timestamp/file/keyterm controls are catalogued; TTS bills authoritative `character-cost` with input-length fallback; music resolves v2 and current endpoints but stays inactive because Phaseo's public music routes are disabled. Suno publishes no first-party developer API—the existing adapter targeted third-party sunoapi.org—so its native registration/capability is removed.

Files: audio schema/native ElevenLabs adapters/catalogue assertions, resolver/capability regression and music provider records.

### Xiaomi - capability closure

Text now uses current Chat plus Responses; native Chat-based TTS remains. False generic image generation/editing, `/audio/transcriptions`, audio translation and video generation registrations are removed. Xiaomi ASR exists through Chat with one base64 audio part and requires a dedicated native adapter/catalogue/pricing; image/video/audio otherwise serve as understanding inputs, not generation endpoints.

Files: Xiaomi config/resolver/profile tests and existing native TTS verification.

### Venice - text generation and E2EE boundary

Standard Venice preserves native extensions, reasoning/reasoning details and model-dependent multimodal input; evidence-matching image generation/TTS/STT remain while generic edit/translation/video are blocked. E2EE is Chat-only and now fails closed instead of sending plaintext: attestation, ECDH/HKDF/AES-GCM headers/message encryption and stream decryption are not implemented, so all E2EE catalogue routes are disabled.

Files: Venice configs/executor/quirks/Chat/Responses decode/profile/tests and E2EE catalogue validation.

### Final text tail - Wafer, W&B and Z.AI

- **Wafer:** forced Chat/client stream mode, native thinking/effort/reasoning replay and ZDR policy; reconciled current K3/DeepSeek routes and verified fast pricing while disabling stale rows.
- **W&B:** forced Chat/client streaming with retry; maps thinking/reasoning and exact tools/structured-output policy. Its live inventory remains a pricing-backed catalogue sync gap.
- **Z.AI:** preserves `tool_stream`, applies alias-shared temperature/reasoning policy and disables all false generic media adapters; native image/video/ASR/OCR/translation lifecycles require dedicated executors.

Files: family configs/executors/quirks/profiles/tests, shared Chat vendor decode and Wafer catalogue/pricing.

### Voyage - capability closure

Voyage publishes embeddings, multimodal/contextual embeddings, rerank and their Batch forms—not Chat/text generation. Both false text executors and fabricated Chat test assumptions are removed; embeddings/rerank remain for both aliases with negative resolver coverage.

Files: resolver/config tests and removed Voyage text wrapper.

### Featherless - text generation

1. **Keep upstream Chat-only.** Explicitly disables native Responses while public Responses/Anthropic continue translating through IR.
2. **Enable documented vision routing.** Removed the false text-only profile and declares only current supported parameters.
3. **Preserve provider sampling/template controls.** Min-p, stop-token ids, stop inclusion, minimum tokens, template kwargs, repetition, thinking toggle/budget, and reasoning content survive IR.
4. **Verify dynamic model behavior.** Official unauthenticated discovery supplies model-specific image/tool/reasoning capabilities; static models were not invented.

Files: Featherless config/profile/quirk/registry, Chat vendor decode, and endpoint/executor tests.

## Newly discovered modalities and capability gaps

- OpenAI moderation accepts text and image input. Audio and video are not documented moderation inputs.
- OpenAI's embeddings API remains text-only; no image, audio, or video embedding modality is documented.
- GPT Image 2 adds no new modality class: generation/editing accept text and image inputs and return image output. The dated `gpt-image-2-2026-04-21` snapshot is covered.
- OpenAI text generation documents text/image input for general models, audio input/output for applicable audio-preview Chat models, and file input. It does not document video as Chat/Responses input; `/videos` is a separate capability.
- OpenAI speech output remains audio-only. Custom voices (`{id}`) are supported; separate voice-consent and voice-creation lifecycle endpoints are outside `audio.speech` and are recorded as an adjacent capability gap.
- OpenAI file translation is audio-to-English-text only and does not stream. Realtime translation is a separate endpoint/capability.
- Speaker-attributed transcription/diarization is now explicitly represented. It is a richer transcription capability rather than a new base modality.
- OpenAI now documents continuous speech-to-speech Realtime translation (source transcript, translated transcript, and translated audio), low-latency live transcription with multilingual hints, and Realtime 2.1 reasoning voice agents with image input. These are recorded gaps rather than implicitly enabled features.
- OpenAI's Video API additionally exposes reusable characters, video editing, extension, remixing, and Batch video creation. These are recorded for separate capability work.
- OpenAI Batch now includes image generation/editing, video output with image-reference input, and multimodal moderation with image input; these were added to capability metadata.
- Azure's current platform also exposes embeddings, image/audio/Realtime/video, Batch, Files/conversations/stored Responses, fine-tuning, evaluations, and hosted tools. These are recorded as separate provider-capability audits; they are not implied by the existing text executor.
- AI21 hosted Jamba remains text input/output. Separate current capabilities include Maestro async agent runs, Foundation Model Batch, File Library, fine-tuning, quantization, and tokenization; they are not silently mapped to text generation.
- Anthropic native content now includes PDFs/Files references, citations, thinking/redacted thinking, code execution, computer use, search/fetch/advisor tools, and server-tool result blocks.
- Bedrock also exposes Converse text/image/document/video understanding, image/video generation, multimodal embeddings, Nova Sonic bidirectional speech, Batch/async S3 inference, Guardrails, caching, and prompt routing. These are separate capability gaps beyond the Mantle text provider.
- AkashML model capabilities are dynamic: current models can accept images and some advertise audio Chat output; separate image generation/edit APIs exist. No speech/transcription or video API was documented.
- Arcee's hosted provider API currently exposes text-only Trinity models. No first-party hosted embeddings, image, audio, or video endpoint was found.
- Ambient model discovery reports text/image/video/audio inputs and text output, but no standalone media-generation endpoint. Hosted Responses tools and Assistants/Threads lifecycle are adjacent surfaces.
- Avian markets vision analysis, web search, and web reader, but publishes no request/response contract for them; they remain contract-blocked. First-party docs say embeddings are not directly offered, and no other media endpoint was found.
- Aion's model REST API remains text-to-text. Its managed email-agent product can use web/code/attachments but is not a public model modality.
- Qianfan additionally documents image generation/editing, multimodal embeddings, rerank, async video/Kling, OCR, Batch, Files, response lifecycle, caching, knowledge search, and agent APIs. These require separate capability audits.
- Cerebras supports vision input on Gemma 4 through Chat. It also documents private-preview Batch/Files and endpoint-management APIs, but no standalone media-generation endpoint.
- BytePlus text generation supports image/video/audio and PDF/file input on applicable models. Separate APIs include images, async video with media references, Batch, context caching, 3D generation, and beta MCP.
- Baseten hosted text models accept model-dependent image/video/audio input. Separate capabilities include beta Anthropic Messages, embeddings/transcription endpoints, arbitrary sync/async predictions, webhooks/WebSockets, and custom deployed chains.
- Chutes also hosts nonuniform dedicated chutes for image/video/audio generation, transcription, embeddings, moderation/classification, and arbitrary APIs. These must be audited per chute; the optional E2EE proxy is not implemented by the ordinary bearer endpoint.
- Clarifai additionally exposes OpenAI-compatible image generation/embeddings and native audio/image/video inference, classification/detection/segmentation, transcription, model deployment/compute, MCP hosting, and cache-aware routing. Exact support is model/deployment-specific.
- Cohere also exposes multimodal embeddings, reranking, compatibility transcription, classification, and native RAG/documents/connectors/citations. Native billed-vs-processed usage is not available through the compatibility response.
- Cohere `embed-v4.0` natively accepts text/images/mixed rendered-page input but no audio/video. The compatibility endpoint remains text-only.
- Cohere rerank is non-streaming text/semi-structured multilingual ranking. V4 supports larger contexts; results contain indices/scores and search-unit billing.
- Cloudflare Workers AI also hosts embeddings, images, classification, speech recognition, translation, and vision models via `/ai/run`; these remain separate capability audits. Model schemas vary, and the public temperature ceiling still blocks documented values above 2 for some models.
- CrofAI's current catalogue marks vision models, establishing image input within text generation, but no separate modality endpoint was discoverable.
- Crusoe self-serve Gemma/Qwen models accept image input, and hosted Nemotron VoiceChat is speech-to-speech. Fine-tuning/Files use a separate Intelligence API.
- Darkbloom beta models add image/video input within text generation; unimplemented endpoints return structured 404.
- DeepInfra separately documents embeddings, rerank, images, video, speech/audio, Anthropic compatibility, Batch/Files, vision/OCR, native inference, and agents.
- DeepSeek V4 remains text-only. Separate documented text protocols include Anthropic-compatible Messages and beta FIM/prefix completion; they remain explicit gaps.
- Fireworks also advertises embeddings, images, vision, audio/Whisper, raw completions, and custom server apps. Raw Chat output can contain images/videos, though those raw forms are not stable public IR fields.
- Fireworks embeddings are text/structured-text; the provider also exposes native rerank. No multimodal embedding endpoint was found.
- Fireworks recommends embeddings with return-logits when native rerank model/parallelism limits are restrictive.
- Friendli supports model-dependent image/video/audio understanding, dedicated image generation/editing, and audio transcription. No standalone video generation, TTS, or audio translation was documented.
- GMI's separate request-queue platform provides image/video/audio generation and editing; it requires dedicated async executors. Per-model Responses remains a discovery-backed gap.
- Groq additionally exposes Whisper transcription/translation, Orpheus speech, Batch/Files, and fine-tuning. Current Qwen supports image input; no video/image-generation API was found.
- Hyperbolic separately exposes images/image-to-image/ControlNet, audio/TTS, vision models, text-to-video, raw completions, fine-tuning, and GPU inference. The Chat reference does not document multimodal/tool/reasoning wire contracts.
- Infermatic additionally documents embeddings, TTS, token counting, raw completions, and a music product. Some models lack Chat templates and require legacy completions.
- Inflection documents only text Chat/config/workspace/status surfaces; no other inference modality was found.
- Inception remains text-only; separate Mercury FIM and Next Edit endpoints require dedicated capabilities.
- Inference.net provides image input; ClipTagger video understanding sends extracted frames as images rather than native video uploads. Async embeddings, Batch/Group/Webhooks, training/deployment are separate surfaces.
- IonRouter additionally documents image generation, asynchronous video generation, and speech synthesis. Video needs a provider-native lifecycle executor; image width/height/sampling extensions and TTS voice-cloning references require dedicated capability audits. No embeddings, rerank, transcription, translation, or image-edit API was documented.
- Liquid publishes open text/tool/structured-output models, vision models, interleaved audio/text models, encoders/embeddings/ColBERT, translation Nanos, and frame-based vision demos. These are deployable model modalities, not evidence of a Liquid-hosted media or video API.
- LongCat documents only the text Chat and Anthropic-compatible Messages surfaces. No image, audio, video, embeddings, rerank, moderation, Batch, Files, or Realtime API was found.
- Meta Muse Spark accepts text/image/video/audio and PDF/file input and produces text, with search, tool search/calling, computer use, structured output, caching, and citations inside text generation. Muse Image and Muse Video are adjacent announced products, but no public Model API generation endpoint or Batch API was evidenced, so neither was invented.
- Mancer is text-only and additionally exposes legacy `/completions` plus public model discovery. No Batch, Video, image, audio, embeddings, rerank, or other modality endpoint was found.
- MARA documents text generation, function calling, and JSON output only. No Batch, Video, image, audio, embedding, rerank, or provider alias was found.
- MiniMax M3 text generation accepts text/image/video input and produces text; audio input is not supported there. The official platform separately exposes Files/token counting, H3 Video V2 and legacy video, image generation/transformation, synchronous/WebSocket/async speech, voice clone/design, music/cover/lyrics. No Batch API appears in the official reference index.
- MiniMax image editing is character-reference image generation; the provider documents no mask/inpainting endpoint. `image-01-live` is a discovered I2I-only model awaiting catalogue/pricing onboarding.
- MiniMax H3 Video V2 accepts text/image/video/audio material and supports edit/reference workflows up to 2K; it remains intentionally unroutable pending a V2 lifecycle/usage adapter. Deprecated Video Agent endpoints were not added, and V1 has no cancellation method.
- MiniMax also exposes interactive WebSocket TTS, million-character async TTS, and voice upload/clone/design/list/delete lifecycles. These are separate async/management capabilities; subtitle metadata is not representable in the binary speech response today.
- MiniMax exposes no standalone transcription or audio-translation API in its exhaustive first-party index; false routes for both aliases were removed.
- MiniMax separately exposes music-cover preprocessing and standalone lyric generation. Music 3.0 free and cover offers are not yet routable; provider streaming is a public-surface gap rather than a task lifecycle.
- Mistral additionally provides multimodal image input, image-generation server tools, OCR/document understanding, embeddings, moderation/classification, offline/realtime transcription, TTS/voice cloning, realtime voice agents, FIM, Conversations, Agents, Workflows, and global Batch. EU explicitly lacks Batch/Files. No video-generation API was found.
- Mistral's EU embeddings transport is supported, but regional model availability is deliberately not inferred from global models; activation requires the EU `/models` evidence.
- Mistral moderation accepts raw text or text conversations; it adds no new modality. Global Batch can submit both moderation endpoints, while EU availability remains unproven.
- Mistral OCR accepts PDF/document and image inputs and returns structured document content/annotations. Global Files and Batch integrate with it; EU OCR remains unavailable pending regional model evidence and lacks regional Files.
- Mistral Batch covers ten endpoint families and 50%-discounted processing globally. EU cannot use Batch/Files. Native job deletion and full million-row streaming settlement remain public/gateway gaps.
- Mistral additionally offers separate realtime transcription; it is not folded into bounded-file transcription. Batch transcription is supported globally through the independently audited Batch surface.
- Moonshot Chat accepts text/image/video and native Files references. It also offers Chat-only file-backed Batch for K2.5/K2.6 and token estimation. No image/video generation, embeddings, audio, transcription or moderation endpoint was found.
- Moonshot Files purposes also cover file extraction, image and video understanding; Batch rows may contain those inputs, but there is no separate video-generation Batch endpoint or native webhook.
- Morph also exposes Compact, WarpGrep, Reflex classifiers with an offline batch mode, Model Router and Fast Apply. It documents no general media generation or OpenAI Batch API; Kimi K3 dynamic system-message tool loading remains a public-schema gap.
- Morpheus live OpenAPI also exposes embeddings, speech and transcription; embeddings and the two audio routes require dedicated audits. Vision is Chat image input, `:web` is a model-suffix feature, and no image generation/edit, audio translation, Video or Batch API exists.
- Morpheus embeddings are currently text-only BGE-M3; marketplace discovery remains authoritative. Upstream permits omitted model, but gateway routing intentionally requires one.
- Morpheus speech is binary Kokoro TTS but lacks publishable pricing/usage; transcription exists as an underspecified endpoint and is therefore not routable. Neither is confused with audio translation.
- Nebius also exposes embeddings, rerank, image generation, Files, fine-tuning and Chat Batch. Some Chat models accept image/video input; no standalone video-generation endpoint is published.
- Nebius embeddings are text/token-array only; no image/object, streaming or separate Batch embedding surface was evidenced.
- Nebius rerank accepts text documents only. No price/context limit is published; `ai_project_id` query selection remains an unmapped provider extension.
- Nebius retired text-to-image entirely; current image-to-text models are Chat vision inputs, not image generation. No image-edit or async image API is live.
- Nebius current Batch is an EU-North Data Lab dataset/operation workflow. Legacy `/v1/batches` pages are stale relative to live OpenAPI; Files alone remain intentionally unexposed through batch-coupled gateway routes.
- NVIDIA's hosted ecosystem includes multimodal understanding, embeddings/rerank, ASR/voice, OCR, image generation/editing and specialist video services. NIM explicitly does not support LLM Batch/admin endpoints, and no generic OpenAI video-generation endpoint exists.
- Novita also offers compatible embeddings/rerank, native image/edit/TTS, unified async video and native Batch/Files. These require separate native audits; the current reference does not document transcription or translation.
- Novita embeddings and rerank are text-only; Qwen3 Reranker was retired in favor of BGE Reranker v2 M3.
- OVHcloud also offers beta OpenAI-compatible Batch, embeddings, Whisper transcription, guard/moderation and Chat vision. No video-generation API/model was found.
- OVHcloud guard streaming remains a raw text-generation behavior; the normalized moderation surface intentionally uses non-streaming one-result-per-input classification.
- OVHcloud Batch supports Chat, Responses and embeddings with half-price processing; transcription adds audio-to-text but no audio output or video generation.
- Parasail Chat supports image and model-dependent video understanding. It also exposes compatible TTS and a separate-host Batch/Files workflow for Chat, embeddings and some image jobs. No video-generation endpoint was found.
- Parasail Batch image generation/editing is a distinct raw-base64 schema awaiting a dedicated translator; multimodal understanding remains ordinary Chat rows, not a video endpoint.
- Parasail's compatible TTS is documented too narrowly for safe billing or binary compatibility; it remains blocked pending request/response/price evidence.
- Phala offers attested private Chat with model-dependent image/video/file input. No native media-generation or Batch API was evidenced; dedicated CVM control-plane APIs are separate.
- Perplexity separately exposes Search, async Sonar, Agent and embeddings APIs. No native Batch or video generation exists. Canonical provider/model/pricing records remain a catalogue onboarding gap distinct from the existing Perplexity Agent record.
- Perplexity standard embeddings are text-only; contextualized embeddings require a future nested-document IR/capability.
- Poolside hosted inference is text-to-text Chat only; no Batch, Video or other modality endpoint appears in the complete current docs index.
- Relace separately exposes native Apply, compatible `/v1/apply`, Compact, code rerank/embeddings, repos and search orchestration. No Batch or media API was found.
- SambaNova Cloud has preview vision models within text generation. Cloud embeddings and Whisper were retired to deployment-specific SambaStack; no native Batch or video-generation API exists.
- Reka has separate Vision image/video management and an asynchronous highlight-Clip video-output lifecycle. Clip transforms supplied videos and does not match generic text-to-video generation; no Batch jobs API exists. PDF Chat input remains a narrow undocumented-wire gap.
- Scaleway also exposes rerank, transcription and native S3-backed Batch (50k/200 MB, 50% discount), plus text/code/vision/audio-input models. No video-generation API exists.
- Scaleway Batch cannot be activated through the current provider-file abstraction because it requires external S3 objects and IAM rather than provider file IDs.
- Sakana text accepts images; Namazu adds files plus built-in web search/code execution. No Batch or Video API was found.
- SiliconFlow also exposes embeddings, rerank, native Messages and async video submit/status; no Batch API exists. Async video requires a dedicated lifecycle adapter.
- Sourceful Riverflow is an image generation/edit product; no first-party public text, Batch or Video API contract was found.
- StreamLake exposes synchronous/streaming text and model-dependent image/video understanding, not Batch jobs or generative video.
- StepFun additionally exposes native images/editing, speech/transcription/realtime, Files/vector stores/search and Messages. No embeddings/rerank/Batch/video-generation/audio-translation API exists.
- xAI has streaming STT/TTS, Realtime sessions/secrets/SIP and video extension. Audio translation does not exist; `grok-4.5` is excluded from Batch.
- Together additionally offers native images, speech/transcription/translation/realtime, async v2 video and rerank; each needs a lossless provider-native adapter before registration.
- Switchpoint publishes no Batch, Video or standalone modality endpoint.
- Alibaba also offers native image/edit, speech/ASR/translation/realtime and multimodal embeddings; these require DashScope-native adapters rather than generic OpenAI media routes.
- TensorX also documents embeddings and TTS/STT; no Batch, video or image-generation API was found.
- Tinker sampling can contain token/image/DMel chunks inside training workflows, but publishes no standalone media, Batch or Video gateway API.
- Google conversational image editing, Vertex embeddings/images/TTS, Gemini embedding Batch, Vertex GCS/BigQuery Batch and Omni Interactions video remain explicit native-adapter gaps.
- Upstage also exposes embeddings and native Document Parse/OCR/extraction/classification/Agents/Files. No Batch or media-generation API exists.
- Runway video-to-video, fal model-specific reference edits, and LTX retake/extend need operation-specific schemas. LTX has no documented cancel endpoint; public cancellation remains globally gated.
- Atlas Cloud exposes no compatible generic audio/image surface. ByteDance/BytePlus media is native ModelArk. BFL is image generation/edit only.
- ElevenLabs also exposes music upload/inpaint/fine-tuning lifecycles; public music remains gated. Suno has no evidenced native developer API.
- Xiaomi has chat-based ASR and multimodal understanding, but no image/edit/translation/video-generation API.
- Standard Venice also exposes native image edit/upscale/background removal, queued music/video, video transcription and embeddings. E2EE is explicitly text-only; no Batch API exists.
- Wafer publishes no public media/Batch API. W&B vision is Chat input only with no standalone modality/Batch. Z.AI has native image/video/ASR/OCR/translation-agent APIs but no Batch or generic speech/translation endpoint.
- Voyage Batch covers embeddings/contextualized embeddings/rerank only; multimodal/contextualized shapes remain separate native capability work.
- Featherless current models expose image input/text output selectively; no official audio, video, or image-output API was found.

## Validation

- `pnpm --filter @phaseo/gateway-api exec vitest run src/core/__tests__/schemas-moderations.test.ts src/executors/openai/moderations/index.test.ts` - 2 files, 5 tests passed.
- OpenAI rerank removal: executor resolver 12/12, provider contract 5/5, provider aliases 23/23; `git diff --check` passed.
- OpenAI embeddings: targeted embeddings 25/25; isolated EU endpoint test passed; API TypeScript typecheck passed. Two unrelated Poolside/Nebius expectations failed in the full shared config suite during concurrent work and are tracked for final validation.
- OpenAI image generation: schema/provider 36/36, bridge/public output 4/4, data validation 9/9 enforced checks, and `git diff --check` passed.
- OpenAI image editing: focused schema/bridge/multipart/provider/streaming 30/30; full API TypeScript typecheck passed at completion.
- OpenAI text generation: 9 focused files, 235 tests passed. A final TypeScript run emitted no diagnostics but remained open after 90 seconds and was interrupted; the consolidated validation pass will rerun it to completion.
- OpenAI audio speech: focused schema/provider/bridge/binary/SSE/usage/EU suite 35/35; full API TypeScript typecheck passed.
- OpenAI audio translations: 4 focused files, 36 tests; full API TypeScript typecheck passed.
- OpenAI audio transcription: focused contract/schema/guard/output 24/24, bridge 5/5, media regression 27/27, API typecheck, data validation (9 enforced checks), and `git diff --check` passed.
- OpenAI Realtime: contract/billing/relay security 23/23, API typecheck, data validation 9/9, and `git diff --check` passed.
- OpenAI video: 9 focused files, 50 tests passed; full API typecheck passed at completion. A later concurrent run exposed only a Batch type error, tracked in the Batch audit.
- OpenAI Batch/Files: 6 focused files, 72 tests; API typecheck and `git diff --check` passed.
- Azure text generation: focused 18/18, Azure plus shared transforms/streaming 99/99, and full API typecheck passed.
- AI21 text generation: 5 focused suites, 85 tests; API typecheck and `git diff --check` passed.
- Anthropic text generation: focused Anthropic/AWS/Bedrock 74/74, Chat/Responses regression 111/111, API typecheck, and `git diff --check` passed.
- Bedrock Mantle text generation: Bedrock/shared contract 89/89 and full API typecheck passed.
- AkashML text generation: 6 suites, 98 tests; API typecheck and `git diff --check` passed.
- Arcee text generation: focused 82/82, API typecheck, shared protocol regression (with one unrelated stale Anthropic expectation), and `git diff --check` passed.
- Ambient text generation: focused route/auth/extensions 3/3, profile/capabilities 7/7, API typecheck, and `git diff --check` passed.
- Avian text generation: combined focused 71/71, final Avian 4/4, API typecheck, data validation 9/9, and `git diff --check` passed.
- Aion text generation: focused 63/63, protocol/policy 66/66, provider mock 117/117, API typecheck, data validation/manifest, and `git diff --check` passed.
- Baidu text generation: executor/quirk/profile 10 tests, route/config 2 tests, API typecheck, metadata parse, and `git diff --check` passed.
- Cerebras text generation: focused 10 tests, profile/capability 7 tests, API typecheck, metadata parse, and `git diff --check` passed.
- BytePlus text generation: transform/protocol 118/118, executor/MCP 19/19, provider mock 117/117, API typecheck, data validation/manifest, and `git diff --check` passed.
- Baseten text generation: relevant 95/95, final focused 11/11, API typecheck, data validation 9/9, and `git diff --check` passed. The public cross-provider temperature ceiling still prevents Baseten's extension range above 2 and is recorded for consolidated design work.
- Chutes text generation: focused IR/quirk 4 tests, URL/auth assertion, API typecheck, metadata parse, and `git diff --check` passed.
- Clarifai text generation: focused protocol/transform 111/111, contract 5/5, provider mock 117/117, API typecheck, and `git diff --check` passed.
- Cohere text generation: focused/profile 7 tests, endpoint assertion, broader profile/capability 7 tests, API typecheck, metadata parse, and `git diff --check` passed.
- Cohere embeddings: focused base64 test, API typecheck, metadata parse, and `git diff --check` passed; no production correction was required.
- Cohere rerank: 2 files, 6 tests; full API typecheck and scoped `git diff --check` passed.
- Cloudflare text generation: final 53/53, expanded relevant 125 assertions, API typecheck, data validation 9/9, and `git diff --check` passed.
- CrofAI text generation: Chat 41/41, provider mock 117/117, API typecheck, data validation 9/9, and `git diff --check` passed.
- Crusoe text generation: 2 files, 4 tests; API typecheck, data validation, and `git diff --check` passed.
- Darkbloom text generation: focused/full quirks 114 tests, API typecheck, and `git diff --check` passed.
- DeepInfra text generation: focused 6/6, profile 9/9, Chat transform 34/34, provider mock 117/117, API typecheck, data validation 9/9, and `git diff --check` passed.
- DeepSeek text generation: quirks/transform 39 tests, route test, profile 3 tests, API typecheck, and scoped `git diff --check` passed.
- Fireworks text generation: focused 6/6, provider mock 117/117, API typecheck, data validation 9/9, and `git diff --check` passed.
- Fireworks embeddings: schema/codec/executor 26/26, API typecheck, and `git diff --check` passed.
- Fireworks rerank: focused executor/codec 6/6, API typecheck, and `git diff --check` passed.
- Friendli text generation: behavior/profile/capabilities 9 tests, URL 3 tests, API typecheck, and scoped `git diff --check` passed.
- GMI text generation: mapping/profile/capability 10 tests, URL/auth 3, retry 1, full API typecheck, and scoped diff passed.
- Groq text generation: focused 4 tests, API typecheck, data validation, and `git diff --check` passed; Groq assertions pass in the shared quirk suite.
- Hyperbolic text generation: focused 2/2, Chat transform 35/35, provider mock 117/117, API typecheck, data validation 9/9, and `git diff --check` passed.
- Infermatic text generation: focused/shared 37/37, provider mock 117/117, API typecheck, and `git diff --check` passed.
- Inflection text generation: Chat 38/38, provider mock 117/117, API typecheck, data validation 9/9, and `git diff --check` passed.
- Inception text generation: request/response/profile 8 tests, targeted URL/auth and cached usage, full API typecheck, and scoped diff passed.
- Inference.net text generation: focused/full quirks 127 tests, API typecheck, and `git diff --check` passed.
- IonRouter text generation: focused routing/system/profile/capability 12 tests, targeted URL/auth and retry tests, full API typecheck, and scoped diff checks passed.
- IonRouter dedicated-provider resolver regression: executor registry 13/13 passed after registering both internal host identities.
- Liquid text generation: focused config/discovery 7 tests, API typecheck, and `git diff --check` passed; the broad config suite's only failures were unrelated concurrent Poolside/Nebius expectations.
- LongCat text generation: shared Chat 37/37, API typecheck, provider-mock 117/117, data validation 9/9, and `git diff --check` passed.
- Meta text generation: focused 97/97, follow-up multimodal 84/84, API typecheck, and data validation 9/9 passed.
- Mancer text generation: 3 focused files 9/9, API typecheck, data validation 9/9, and `git diff --check` passed.
- MARA text generation: focused 4/4, profile integration 7/7, mock overlays 54/54, API typecheck, data validation 9/9, and `git diff --check` passed.
- MiniMax text generation: focused 54/54, broader shared/media 60/60, API typecheck, and data validation passed before a concurrent image-source metadata edit that its owning audit is resolving.
- MiniMax image generation/editing: focused adapter/profile/capability 15/15, API typecheck, data validation 9/9, and `git diff --check` passed; the broad resolver suite had only an unrelated IonRouter dedicated-host assertion.
- MiniMax video: schema/executor/lifecycle 33/33, API typecheck, and `git diff --check` passed; broad resolver/data failures at completion were confined to concurrent IonRouter/image metadata work.
- MiniMax speech: focused schema/bridge/profile/native adapter 16/16, API typecheck, and `git diff --check` passed.
- MiniMax transcription/translation removal: capability/profile 11/11, API typecheck, and `git diff --check` passed.
- MiniMax music: executor 5/5, capability and disabled-route assertions, API typecheck, catalogue validation, and `git diff --check` passed.
- Mistral text generation: 4 focused files 80/80, API typecheck, and data validation 9/9 passed.
- Mistral embeddings: 40 relevant focused tests, EU resolver assertion, API typecheck, and data validation 9/9 passed.
- Mistral moderation: 3 focused files 8/8, API typecheck, data validation 9/9, and attributable `git diff --check` passed.
- Mistral OCR: focused endpoint/bridge/registration 4 tests, API typecheck, catalogue validation, and scoped `git diff --check` passed.
- Mistral Batch/Files: 61 focused tests and API typecheck passed; finalization 36/37 with one unrelated concurrent pricing-fixture drift.
- Mistral transcription: focused 13/13 plus bridge/registry regressions, API typecheck, data validation 9/9, and attributable diff check passed.
- Moonshot text generation: focused protocol/quirk/transform/config 101 tests, API typecheck, and data validation 9/9 passed.
- Moonshot Batch/Files: 73 focused tests and API typecheck passed; catalogue validation was blocked only by concurrent Morpheus provider metadata, with Moonshot pricing clean.
- Morph text generation: contract 4/4, tier assertion, API typecheck, catalogue validation, and scoped `git diff --check` passed.
- Morpheus text generation: targeted 55/55, API typecheck, data validation 9/9, and `git diff --check` passed.
- Morpheus embeddings: 3 focused files 24/24, API typecheck, data validation 9/9, and `git diff --check` passed; pricing validation was blocked only by concurrent Mistral OCR meter taxonomy.
- Morpheus audio: 2 focused files 16/16, API typecheck, data validation 9/9, gateway validation, and `git diff --check` passed.
- Nebius text generation: 12 selected focused assertions, API typecheck, data validation 9/9, and attributable diff check passed.
- Nebius embeddings: 3 focused files with 4 selected assertions, API typecheck, data validation 9/9, manifest sync and scoped diff check passed.
- Nebius rerank: 2 focused files with 3 selected assertions, API typecheck, data validation 9/9, manifest sync and scoped diff check passed.
- Nebius image unsupported regression: selected resolver test, API typecheck and scoped diff check passed.
- Nebius Batch blocked boundary: selected capability test, API typecheck and scoped diff check passed.
- NVIDIA text generation: 3 focused NVIDIA tests plus 37 shared Chat transforms, API typecheck, and data validation 9/9 passed.
- Novita text generation/capability boundaries: focused 35/35; broad config had only unrelated Poolside failure. Shared type/data validation were temporarily blocked by concurrent duplicate IR fields and Qwen link metadata, not Novita changes.
- Novita embeddings/rerank: focused 38/38, API typecheck and manifest sync passed; data validation was blocked only by concurrent OVHcloud policy metadata.
- OVHcloud text generation: focused 2/2, API typecheck, data/gateway validation, and scoped diff check passed; its shared config assertions are green.
- OVHcloud embeddings/moderation: focused 5/5 and registry-combined 17/17, gateway pricing and scoped diff passed; later shared type/data failures were confined to concurrent Perplexity/Parasail work.
- OVHcloud Batch/Files/transcription: focused 34/34 plus route/Files 19/19, API typecheck, data/gateway validation and scoped diff passed; broad finalization had one unrelated OpenAI image-pricing fixture.
- Parasail text generation: 2 focused files with 3 selected tests, API typecheck and scoped diff check passed.
- Parasail Batch/Files: 2 focused files with 3 selected tests, API typecheck and scoped diff check passed.
- Parasail speech boundary: capability/resolver assertions, API typecheck, structural data validation and scoped diff check passed.
- Phala text generation: 2 focused files with 3 selected tests, capability assertion, structural data validation and scoped diff passed; shared typecheck drift was concurrent and later resolved.
- Perplexity text generation: 103 focused plus 12 stream protocol tests, API typecheck and `git diff --check` passed.
- Perplexity embeddings: 29 focused tests, API typecheck, data/pricing validation and diff check passed.
- Poolside text generation: 5 focused files 121/121, API typecheck and `git diff --check` passed; data validation was blocked by concurrent Whisper manifest drift.
- Relace text generation: focused 4/4, API typecheck, gateway validation and diff check passed; structure validation was blocked only by concurrent Reka records.
- SambaNova text generation: focused 5/5, API typecheck, data/pricing validation and diff check passed.
- Reka text generation: 6 focused files 128/128, API typecheck, pricing validation, manifest sync and diff check passed; structure validation was blocked only by concurrent SambaNova policy metadata later resolved.
- Scaleway text/embeddings: focused 3/3, API typecheck, pricing validation and diff check passed; data manifest was blocked only by concurrent Sakana additions.
- Scaleway rerank/transcription/Batch: 27 focused tests, API typecheck, pricing validation and diff check passed.
- Sakana text generation: focused 7/7, API typecheck, gateway validation, manifest sync and diff check passed; structure validation was blocked only by concurrent Scaleway policy enum drift.
- SiliconFlow text generation: 5/5 new tests plus targeted config/profile, API typecheck, pricing validation and diff check passed.
- Sourceful removal: 15/15 tests, API typecheck, manifest check and diff check passed.
- StreamLake text generation: focused contract test, API typecheck, gateway validation, manifest sync and diff check passed.
- StepFun text generation: 8/8 new tests plus targeted config/profile, API typecheck, pricing validation and diff check passed.
- xAI closure: 45 broad focused and 27 final subset tests, API typecheck, pricing validation, catalogue parse and diff check passed.
- Together closure: 56 focused assertions and API typecheck passed.
- Switchpoint text generation: 2/2 focused tests, API typecheck and diff check passed.
- Alibaba/Qwen closure: 45 focused assertions, API typecheck, catalogue/JSON checks and diff check passed.
- TensorX text generation: 4 focused tests, API typecheck, catalogue JSON and diff check passed.
- Thinking Machines text generation: 2/2 tests, API typecheck, catalogue JSON and diff check passed.
- Google closure: exact suites 51/51, API typecheck, pricing validation and diff check passed; manifest regeneration awaited the concurrent xAI canonical-model fix.
- Upstage text generation: 2/2 tests, API typecheck, catalogue JSON and diff check passed.
- Runway/fal/LTX lifecycle: focused 19/19 and API typecheck passed; data validation was blocked only by concurrent xAI model resolution.
- Final Atlas/ByteDance/BFL tests were updated; consolidated validation below supersedes the subtask's missing local test-runtime attempt.
- ElevenLabs/Suno catalogue and focused assertions passed; consolidated validation below supersedes the subtask's missing linked test binaries.
- Xiaomi: resolver assertion 1/1, native TTS 2/2, API typecheck and scoped diff passed.
- Venice closure: 3 focused files 6/6, API typecheck and catalogue JSON passed; a deterministic E2EE catalogue test was added.
- Final text tail: Wafer 4/4, W&B 8/8, Z.AI 3/3; combined 11/11 plus 40 transform regressions and API typecheck passed.
- Voyage closure: resolver 3/3, config 2/2, API typecheck and diff check passed.
- Featherless text generation: focused/full quirks 118 tests, API typecheck, and `git diff --check` passed.

## Consolidated closure and validation

- Reconciled all 112 exact executor registrations against the audited provider-family matrix, including internal host identities and public aliases. No substantively unaudited registered provider family remains; the final tail covered Atlas Cloud, ByteDance Seed, Black Forest Labs, ElevenLabs, Suno, Voyage, and Xiaomi.
- Added the missing canonical `spacex-ai/grok-transcribe` model record, synchronized the catalogue manifest, and corrected the last shared validation drift found during consolidation.
- `pnpm data:sync-manifest`: passed; the generated catalogue manifest is in sync.
- `pnpm validate:data`: passed all 9 enforced checks; 171 grandfathered non-blocking warnings remain.
- `pnpm validate:pricing`: passed across 2,997 pricing files.
- `pnpm validate:gateway`: passed; every active gateway route has a valid price contract.
- `pnpm --filter @phaseo/gateway-api typecheck`: passed.
- Consolidated deterministic regression selection: 18 files and 188 tests passed. This covers executor registration, capability/profile resolution, Batch capability/adapters, audio/video and text schemas, embedding/moderation routing, multimodal reservations, policy filtering, catalogue invariants, Anthropic decoding, and buffered streaming.
- `git diff --check`: passed after consolidation.
- The full unfiltered API Vitest suite was also attempted. It is not green: failures remain in environment-dependent live/provider/AIMock integration suites, OAuth/performance fixtures, broad executor-matrix fixtures, OpenAPI parity, and other integration harnesses that are not hermetic in this worktree. Direct audit-attributable unit regressions exposed by that run were corrected and are included in the 188-test consolidated selection above. The full-suite result is therefore recorded as an explicit remaining validation gap, not represented as a pass.
