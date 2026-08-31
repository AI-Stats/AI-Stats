# Provider parameter support audit

Last reviewed: 2026-08-30

## Scope

This audit covers every API provider in the Phaseo catalog with at least one
`text.generate` capability. The inventory contains 123 providers and 5,047
provider/model records, of which 63 providers and 1,119 provider/model records
are currently active.

Parameter evidence is keyed by provider, provider model/deployment, endpoint,
and canonical Phaseo parameter. An endpoint schema is not treated as proof that
every model served through that endpoint implements every field.

## Evidence levels

- **Model declaration**: official provider metadata or documentation explicitly
  declares support for the individual model.
- **Model-family declaration**: official documentation identifies the affected
  model family and any exceptions.
- **Endpoint declaration**: an official request schema or parameter list exposes
  the field, but model-level support may still vary.
- **Compatibility claim**: the provider only claims OpenAI/Anthropic
  compatibility. This does not establish parameter support.
- **Unknown**: no sufficiently explicit first-party declaration was found.

## Confirmed source findings

| Provider | Evidence | Finding | Official source |
| --- | --- | --- | --- |
| Abacus | Endpoint declaration | RouteLLM publishes separate Chat, Responses, and Messages references. Chat works across its text catalog, but proxied models retain upstream differences, so the endpoint list is not a per-model guarantee. | [RouteLLM APIs](https://abacus.ai/help/developer-platform/route-llm), [Chat parameters](https://abacus.ai/help/developer-platform/route-llm/chat-completions) |
| AI21 | Endpoint declaration | Jamba Chat exposes token limits, temperature, `top_p`, stop, `n`, and tools, with documented constraints between `n`, temperature, streaming, and tools. | [Jamba API](https://docs.ai21.com/reference/jamba-1-6-api-ref) |
| Aion Labs | Model-family declaration | Chat supports `temperature`, `max_tokens`, `stop`, `tools`, `reasoning_split`, and `metadata`. `reasoning_effort` is limited to Aion 2.0, 3.0, and 3.0 Mini. Responses supports `temperature`, `max_tokens`, `reasoning_split`, and `metadata`, with the same reasoning-family restriction. | [API reference](https://api.aionlabs.ai/docs/api-reference/) |
| Alibaba Cloud Model Studio | Model-family declaration | OpenAI-compatible parameters and thinking/structured-output interactions vary by Qwen/third-party model. Some thinking-only variants reject `enable_thinking: false`; JSON mode can be incompatible with enabled thinking. | [OpenAI compatibility](https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope), [error reference](https://www.alibabacloud.com/help/en/model-studio/error-code) |
| Amazon Bedrock | Endpoint plus model-family declarations | Converse exposes `max_tokens`, `stop`, `temperature`, `top_p`, `tools`, `tool_choice`, structured output, metadata, and service tier as common fields. Additional inference fields are model-specific and must be taken from the Bedrock model parameter pages. | [Converse](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html), [model parameters](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters.html) |
| Anthropic | Model-family declaration | Messages exposes `max_tokens`, `stop`, `tools`, `tool_choice`, reasoning, metadata, service tier, and legacy sampling controls. Models after Opus 4.6 reject non-default `temperature`, `top_p`, and `top_k`; newer reasoning behavior is model-specific. | [Messages API](https://platform.claude.com/docs/en/api/messages/create), [thinking compatibility](https://platform.claude.com/docs/en/about-claude/models/extended-thinking-models) |
| Arcee AI | Endpoint declaration | Chat documents token limits, temperature, `top_p`, `n`, stop, penalties, `logit_bias`, seed, tools, structured output, logprobs, and reasoning effort. | [Chat completion](https://docs.arcee.ai/api-reference/chat-completion) |
| AtlasCloud | Endpoint declaration | Chat documents token limits, temperature, `top_p`, `top_k`, repetition penalty, and thinking. Model support still varies. | [Chat completion](https://www.atlascloud.ai/docs/createChatCompletion) |
| Azure AI Model Inference | Endpoint plus explicit model variance | The common API exposes token limits, temperature, `top_p`, stop, seed, tools/tool choice, and structured output. Microsoft explicitly documents that models subscribe to different subsets and return `parameter_not_supported` for unsupported fields. | [Model Inference REST API](https://learn.microsoft.com/en-us/rest/api/aifoundry/modelinference/) |
| Baidu Qianfan | Endpoint declaration | Chat exposes temperature, `top_p`, penalties, stop, tools, and reasoning/search controls. Defaults and availability vary by model. | [Chat completion](https://intl.cloud.baidu.com/en/doc/qianfan/s/3m7of64lb-intl-en), [Responses-style API](https://cloud.baidu.com/doc/qianfan-api/s/vmhejnuy8) |
| Baseten | Endpoint declaration | The published LLM OpenAPI schema exposes `documents`, sampling controls, penalties, `logit_bias`, `logprobs`, token limits, tools, structured output, and seed. Per-model implementation still needs verification. | [LLM OpenAPI specification](https://docs.baseten.co/reference/inference-api/llm-openapi-spec.json) |
| BytePlus ModelArk | Model-family declaration | Chat exposes sampling controls, penalties, token limits, reasoning effort, structured output, tools, logprobs, and parallel tool calls, with explicit restrictions for deep-reasoning and pre-Seed-1.6 models. | [Chat API](https://docs.byteplus.com/en/docs/Byteplus_LAS/Chat_API) |
| Canopy Wave | Compatibility claim plus feature examples | Official docs demonstrate structured outputs and tools but do not publish a complete model-by-model parameter matrix. Remaining parameters require probes. | [OpenAI compatibility](https://canopywave.com/docs/get-started/openai-compatible) |
| Cerebras | Model declaration available | The public models endpoint returns per-model `supported_parameters` and explicit flags for tool choice, parallel tools, response format, and reasoning. This should be ingested directly before any live probes. | [Public models](https://inference-docs.cerebras.ai/api-reference/models/public-models), [chat API](https://inference-docs.cerebras.ai/api-reference/chat-completions) |
| Cohere | Endpoint declaration with explicit negatives | Compatibility Chat supports `reasoning_effort`, `response_format`, tools, `temperature`, `max_tokens`, `stop`, seed, `top_p`, and frequency/presence penalties. It explicitly rejects metadata, `logit_bias`, `top_logprobs`, `n`, modalities, service tier, and parallel tool calls. | [Compatibility API](https://docs.cohere.com/docs/compatibility-api) |
| DeepSeek | Model-family declaration | Chat exposes thinking/reasoning, token limits, structured output, stop, temperature, `top_p`, tools, and logprobs. In thinking mode, sampling and penalty fields are accepted but have no effect; frequency/presence penalties are deprecated. Responses currently has a narrower model and tool surface. | [Chat API](https://api-docs.deepseek.com/api/create-chat-completion/), [thinking mode](https://api-docs.deepseek.com/guides/thinking_mode/), [Responses API](https://api-docs.deepseek.com/guides/responses_api/) |
| DigitalOcean | Endpoint declaration | Serverless Chat exposes penalties, logprobs, token limits, `n`, reasoning effort, seed, stop, temperature, tools/tool choice, and `top_p`. The model catalog remains the source for per-model capability differences. | [Serverless Inference API](https://docs.digitalocean.com/products/inference/reference/api/serverless-inference/), [Chat guide](https://docs.digitalocean.com/products/inference/how-to/use-chat-completions-api/) |
| DeepInfra | Endpoint declaration | The published OpenAPI schema exposes penalties, token limits, `min_p`, `top_k`, logprobs, prompt cache key, reasoning, structured output, seed, service tier, stop, sampling controls, and tools. Per-model implementation still needs verification. | [OpenAPI specification](https://api.deepinfra.com/openapi.json) |
| Fireworks | Endpoint declaration | The published schema separately defines Chat, Responses, and Messages parameter surfaces, including sampling, penalties, tools, structured output, reasoning, logprobs, service tier, and advanced decoding controls. Model-level support remains separate. | [OpenAPI specification](https://docs.fireworks.ai/merged.openapi.yaml) |
| Friendli | Endpoint declaration | The published schema separately defines Chat, Responses, and Messages surfaces including sampling, penalties, tools, structured output, reasoning, logprobs, service tier, and XTC controls. Model-level support remains separate. | [OpenAPI repository](https://github.com/friendliai/friendli-openapi) |
| Google AI Studio | Endpoint plus model-family declarations | GenerateContent exposes token limits, stop, temperature, `top_p`, `top_k`, penalties, seed, logprobs, response schema/JSON, modalities, tools, and thinking config. Google explicitly states that not all fields are configurable for every model. | [GenerateContent](https://ai.google.dev/api/generate-content), [Gemini model guide](https://ai.google.dev/gemini-api/docs/models) |
| Google Vertex AI | Endpoint plus model-family declarations | Vertex GenerationConfig exposes the corresponding Gemini generation controls, structured output, seed, tools, and thinking features. Model documentation must supply the per-model subset. | [GenerationConfig](https://cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1beta1/GenerationConfig), [model reference](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference) |
| Groq | Endpoint and model-family declarations | Chat explicitly marks frequency/presence penalties, `logit_bias`, `logprobs`, and `top_logprobs` unsupported across current models. Reasoning effort and structured output are restricted to documented model families. | [API reference](https://console.groq.com/docs/api-reference), [models](https://console.groq.com/docs/models) |
| GMI Cloud | Endpoint declaration | Chat exposes tools, token limits, temperature, `top_p`, `top_k`, `ignore_eos`, stop, and structured output; the reference explicitly says availability varies by model. | [LLM API reference](https://docs.gmicloud.ai/inference-engine/api-reference/llm-api-reference) |
| Hugging Face Inference Providers | Endpoint declaration with routing caveat | The task schema exposes sampling controls, seed, stop, advanced decoding, constraints, and tools. Hugging Face explicitly notes that the selected downstream inference provider has its own capabilities, so this is not model/provider proof. | [Chat completion](https://huggingface.co/docs/inference-providers/tasks/chat-completion), [function calling](https://huggingface.co/docs/inference-providers/main/guides/function-calling) |
| Inception | Model declaration | Mercury 2 documents temperature, token limits, reasoning effort, tools, and structured output. Mercury Edit uses separate FIM/edit endpoints and should not inherit the Chat surface. | [models and endpoints](https://docs.inceptionlabs.ai/get-started/models), [tool use](https://docs.inceptionlabs.ai/capabilities/tool-use), [structured outputs](https://docs.inceptionlabs.ai/capabilities/structured-outputs) |
| Inflection | Endpoint declaration | The official downloadable schema exposes sampling controls, penalties, logit bias/logprobs, token limits, structured output, seed, stop, tools, `top_k`, `min_p`, repetition penalty, and other vLLM controls. Per-model implementation needs verification. | [API reference](https://developers.inflection.ai/api/docs) |
| io.net | Endpoint declaration | Chat exposes penalties, logit bias/logprobs, token limits, `n`, structured output, seed, stop, temperature, tools, `top_k`, `min_p`, repetition penalty, `ignore_eos`, and minimum tokens. The reference says model support varies. | [Chat completion](https://io.net/docs/reference/ai-models/create-chat-completion) |
| IonRouter | Endpoint declaration | The public reference only establishes token limits, temperature, and `top_p`; it does not establish tools or the wider OpenAI surface. | [API documentation](https://ionrouter.io/docs) |
| LongCat | Model declaration | LongCat 2.0 Chat documents `max_tokens`, temperature, `top_p`, and thinking. | [Chat API](https://longcat.chat/platform/docs/api/chat.html) |
| Mistral | Endpoint declaration | The published schema exposes token limits, temperature, `top_p`, stop, penalties, tools, structured output, seed, reasoning effort, metadata, and prompt cache key. Per-model feature pages still determine the subset. | [OpenAPI specification](https://docs.mistral.ai/openapi.yaml) |
| Moonshot/Kimi | Model-family declaration | Kimi Chat exposes token limits, structured output, stop, tools, prompt cache key, and thinking. K2.5/K2.6 impose fixed sampling/penalty values and family-specific thinking rules. | [Chat API](https://platform.kimi.ai/docs/api/chat), [model parameter reference](https://platform.kimi.ai/docs/api/models-overview) |
| MiniMax | Model-family declaration | Chat exposes token limits, temperature, `top_p`, tools, and tool choice. Structured output is limited to documented model families such as MiniMax-Text-01, and defaults vary by model. | [Text API](https://platform.minimax.io/docs/api-reference/text-post) |
| Morph | Model declaration | Morph models use specialized, incompatible surfaces: compaction takes compression controls, WarpGrep takes temperature/token limits and rejects caller-supplied tools, while apply models largely take messages only. | [Compaction](https://docs.morphllm.com/sdk/components/compact), [WarpGrep](https://docs.morphllm.com/api-reference/endpoint/warpgrep) |
| Morpheus | Endpoint declaration | Chat documents temperature, `top_p`, `n`, stop, token limits, frequency/presence penalties, tools, and tool choice. The single catalog model still needs behavioral validation. | [Chat completions](https://apidocs.mor.org/api-reference/chat/completions) |
| Nebius Token Factory | Endpoint declaration | Chat exposes token limits, sampling, tools, `n`, stop, penalties, logit bias/logprobs, structured output, and service tier. Extended vLLM fields and implementation vary by model. | [Chat completion](https://docs.tokenfactory.nebius.com/api-reference/inference/create-chat-completion) |
| NVIDIA NIM | Endpoint plus model pages | The common Chat endpoint exposes temperature, `top_p`, token limits, seed, and other OpenAI-style fields, while individual NIM model pages document different restrictions and recommended combinations. | [LLM APIs](https://docs.api.nvidia.com/nim/reference/llm-apis), [Chat reference](https://docs.api.nvidia.com/nim/reference/create_chat_completion_v1_chat_completions_post) |
| NovitaAI | Endpoint declaration | Chat exposes token limits, `n`, seed, penalties, stop, temperature, `top_p`, `top_k`, `min_p`, logit bias/logprobs, tools, structured output, and reasoning controls. Availability varies by model and modality. | [Chat completion](https://novita.ai/docs/api-reference/model-apis-llm-create-chat-completion) |
| OpenAI | Endpoint plus model declarations | The official schema defines distinct Chat and Responses surfaces. Model pages and API errors determine restrictions for reasoning models, tools, sampling controls, verbosity, service tiers, and structured output. | [OpenAPI specification](https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml), [model documentation](https://developers.openai.com/api/docs/models) |
| OpenRouter | Model declaration available | For OpenRouter itself only, its public Models API exposes model-level `supported_parameters`. No OpenRouter data is used as evidence for any other provider. | [Models API guide](https://openrouter.ai/docs/guides/overview/models) |
| Poolside | Model-family declaration | Poolside publishes a request schema and examples for optional fields, tools, and reasoning, while explicitly documenting that behavior differs by the underlying model/provider route. | [OpenAI API examples](https://docs.poolside.ai/api/openai-api-examples) |
| Reka | Endpoint declaration | Chat documents penalties, token limits, seed, stop, temperature, tool choice/tools, `top_k`, and `top_p`. | [Chat API](https://docs.reka.ai/chat/api-reference/create) |
| Relace | Model declaration | The apply models use a specialized request rather than a generic generation surface; generic OpenAI parameters must not be inferred. | [Instant Apply](https://docs.relace.ai/api-reference/instant-apply/apply) |
| Sail Research | Endpoint declaration with explicit matrix | Its support page separately lists Chat and Responses fields, including token limits, sampling, cache key, structured output, reasoning effort, tools, parallel tools, and metadata. | [Parameter support](https://docs.sailresearch.com/support) |
| Sakana AI | Model declaration | Sakana publishes per-model field tables. Fugu accepts several sampling/penalty fields but ignores them, while Namazu exposes effective sampling, tools, structured output, and endpoint-specific fields. | [model parameter tables](https://console.sakana.ai/models) |
| SambaNova | Endpoint declaration with explicit negatives | Chat exposes token limits, sampling, stop, structured output, reasoning effort, tools, logprobs, `n`, logit bias, and seed. Frequency/presence penalties are accepted but unimplemented; parallel tool calls are unsupported. | [Chat completion](https://docs.sambanova.ai/docs/api-reference/chat-completions/create-chat-based-completion) |
| Scaleway | Endpoint declaration with explicit negatives | Chat supports temperature, `top_p`, token limits, presence penalty, structured output, logprobs, stop, seed, and tools. It explicitly rejects frequency penalty, `n`, `top_logprobs`, `logit_bias`, and user. | [Chat API](https://www.scaleway.com/en/docs/generative-apis/api-cli/using-chat-api/), [API reference](https://www.scaleway.com/en/developers/api/generative-apis) |
| SiliconFlow | Endpoint declaration | The published schema exposes Chat sampling controls, token limits, `min_p`, tools, structured output, and thinking controls; its Messages surface exposes the Anthropic-style subset. Per-model support still needs verification. | [OpenAPI specification](https://docs.siliconflow.com/cn/api-reference/openapi.yaml) |
| Together | Endpoint declaration | The published schema exposes sampling controls, penalties, logit bias/logprobs, token limits, tools, structured output, seed, and reasoning. Per-model support still needs verification. | [OpenAPI specification](https://docs.together.ai/openapi.yaml) |
| Upstage | Model declaration (partial) | Current Solar examples establish Chat and model-family reasoning effort. The accessible official reference did not expose a complete field table, so the remaining surface stays unknown. | [Chat example](https://console.upstage.ai/api-keys?api=chat), [reasoning example](https://console.upstage.ai/api-keys?api=chat-reasoning) |
| Venice | Endpoint declaration | The published schema defines separate Chat and Responses surfaces with sampling, penalties, token limits, tools, structured output, reasoning, logprobs, cache controls, and verbosity. Per-model support still needs verification. | [OpenAPI specification](https://docs.venice.ai/swagger.yaml) |
| Weights & Biases Inference | Endpoint declaration | Chat exposes penalties, logit bias/logprobs, token limits, `n`, structured output, seed, stop, sampling, tools, reasoning effort, parallel tools, `top_k`, `min_p`, repetition penalty, and other vLLM fields. Per-model support remains separate. | [Chat completion](https://docs.wandb.ai/api-reference/chat-completions/create-chat-completion-1) |
| xAI / SpaceXAI | Model-family declaration | Chat and Responses expose broad OpenAI-style controls, tools, logprobs, tiers, cache fields, and reasoning. Current reasoning models reject stop and frequency/presence penalties; reasoning-effort values vary by Grok generation. | [Chat API](https://docs.x.ai/developers/rest-api-reference/inference/chat), [reasoning](https://docs.x.ai/developers/model-capabilities/text/reasoning) |
| Z.ai | Endpoint declaration | The published schema exposes token limits, temperature, `top_p`, stop, tools, structured output, and reasoning controls. Model-family restrictions still need verification. | [OpenAPI specification](https://docs.z.ai/openapi.json) |

## Rules discovered during review

- A parameter appearing in OpenAPI is endpoint evidence, not model evidence.
- An OpenAI-compatible claim without a parameter table remains unknown.
- Fixed/default-only values are recorded as constrained support rather than full support.
- Mutually exclusive parameters are recorded as compatibility constraints, not as unsupported.
- Regional aliases inherit evidence only when they use the same provider API and deployment surface.

## Complete provider coverage ledger

Every catalog provider with a `text.generate` record appears exactly once
below. The grouping describes the best first-party evidence found; it does not
promote endpoint declarations into model declarations.

### Model or model-family evidence (26)

`aion-labs`, `alibaba-cloud`, `amazon-bedrock`, `anthropic`, `anthropic-aws`,
`anthropic-aws-us`, `anthropic-us`, `byteplus`, `cerebras`, `deepseek`,
`google-ai-studio`, `google-vertex`, `google-vertex-eu`, `groq`, `inception`,
`longcat`, `moonshotai`, `moonshotai-turbo`, `morph`, `openai`, `openai-eu`,
`openrouter`, `relace`, `sakana`, `spacex-ai`, `xiaomi`.

Regional variants are separate catalog providers but share evidence only where
the catalog points at the same first-party API surface. OpenRouter's model
metadata is used only for `openrouter` itself.

### Explicit first-party endpoint schema or parameter table (34)

`abacus`, `ai21`, `arcee-ai`, `atlascloud`, `azure`, `baidu`, `baseten`,
`cohere`, `deepinfra`, `digitalocean`, `fireworks`, `friendli`, `gmicloud`,
`huggingface`, `inflection`, `io-net`, `minimax`, `minimax-lightning`,
`mistral`, `mistral-eu`, `morpheus`, `nebius-token-factory`, `novita`,
`nvidia`, `reka`, `sail-research`, `sambanova`, `scaleway`, `siliconflow`,
`together`, `venice`, `venice-e2ee`, `weights-and-biases`, `z-ai`.

These 34 providers need per-model refinement before their endpoint fields can
be written into the catalog as supported parameters.

### Compatibility claim or partial examples only (13)

`akashml`, `ambient`, `avian`, `canopy-wave`, `cloudflare`, `crofai`,
`ionrouter`, `ovhcloud`, `poolside`, `streamlake`, `upstage`, `vercel`,
`wafer`.

The source pass found an official compatibility statement or examples, but no
complete, reliable model-level declaration. These providers require either a
provider-supplied schema/metadata endpoint or live probes.

### No reliable first-party parameter declaration found (50)

`anyapi`, `berget`, `chutes`, `cloudferro-sherlock`, `crossmodel`, `crusoe`,
`databricks`, `decart`, `evroc`, `fastrouter`, `github-models`, `hpc-ai`,
`hyperbolic`, `inceptron`, `inference`, `infermatic`, `ionstream`, `jiekou`,
`kilo`, `lilac`, `lmstudio`, `mancer`, `mara`, `meganova`, `merge-gateway`,
`meta`, `mixlayer`, `modal`, `modelrun`, `modelscope`, `nano-gpt`,
`neuralwatt`, `nex-agi`, `ofox`, `openinference`, `orcarouter`, `parasail`,
`perplexity-agent`, `phala`, `pioneer`, `qiniu-ai`, `requesty`, `stackit`,
`stepfun`, `submodel`, `tencent-cloud`, `tensorix`, `thinking-machines`,
`vultr`, `zenmux`.

All 50 currently have zero active Phaseo text deployments. They remain in the
audit because the requested scope includes inactive and historical providers,
but they should not consume probe budget until they become routable.

## Probe-cost calculation

The gateway currently recognises 65 canonical text-generation parameters.
At an assumed flat cost of $0.001 per request:

| Scope | Provider/model records | Parameter probes | Probe cost | With one baseline request per record |
| --- | ---: | ---: | ---: | ---: |
| Entire catalog | 5,047 | 328,055 | **$328.06** | **$333.10** |
| Active gateway records only | 1,119 | 72,735 | **$72.74** | **$73.85** |

The formula is `records × 65 × $0.001`; the baseline column adds one known-good
request for every provider/model record. It excludes retries, rate-limit
recovery, tool execution, and providers that bill a minimum output length, so
it is a lower bound rather than a spending cap.

`max_tokens: 1` reduces token charges but does not make a request free, and it
is not a safe universal probe: some reasoning models require a higher output
budget, some providers enforce a minimum, and tool/structured-output probes
may need enough tokens to demonstrate behavior.

## Recommended execution order

1. Ingest machine-readable model declarations first, starting with Cerebras and
   OpenRouter-for-OpenRouter. This costs nothing and gives true model evidence.
2. Materialize endpoint schemas as `declared_at_endpoint`, not `supported`, for
   the 34 providers with explicit first-party schemas.
3. Apply documented model-family constraints and accepted-but-ignored states.
4. Probe only active provider/model/parameter cells still unknown. Run a
   known-good baseline first and classify errors as unsupported, invalid value,
   authentication, capacity, or inconclusive.
5. Use the smallest semantically valid request per parameter. Do not force
   `max_tokens: 1` onto reasoning, tools, or structured-output tests.
6. Re-run only when a provider's model list or documentation changes, and store
   source URL, checked timestamp, request fingerprint, response class, and API
   version with every result.

The first paid pass should therefore target the 13 partial providers and the
remaining unknown cells among the 34 endpoint-schema providers, restricted to
the 1,119 active records. The 50 inactive-only providers can stay unprobed.
