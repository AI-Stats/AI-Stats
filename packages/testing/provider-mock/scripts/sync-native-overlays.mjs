import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const object = (properties = {}, required = []) => ({ type: "object", properties, ...(required.length ? { required } : {}), additionalProperties: true });
const string = { type: "string" };
const chat = object({ model: string, messages: { type: "array", items: object({ role: string, content: {} }, ["role", "content"]) }, stream: { type: "boolean" }, tools: { type: "array", items: object() } }, ["model", "messages"]);
const anthropicMessages = object({ model: string, max_tokens: { type: "integer" }, messages: { type: "array", items: object() }, stream: { type: "boolean" }, tools: { type: "array", items: object() } }, ["model", "max_tokens", "messages"]);
const responses = object({ model: string, input: {}, stream: { type: "boolean" }, tools: { type: "array", items: object() }, text: object() }, ["model", "input"]);
const operation = (operationId, schema, description, capability) => ({ operationId, ...(capability ? { "x-phaseo-capability": capability } : {}), description, requestBody: { required: true, content: { "application/json": { schema } } }, responses: { "200": { description: "Deterministic mock success", content: { "application/json": { schema: object() } } }, "400": { description: "Provider validation error" }, "429": { description: "Provider rate limit" }, "500": { description: "Provider failure" } } });

const bedrockMantlePaths = {
  "/v1/chat/completions": { post: operation("amazon_bedrock_mantle_chat", chat, "Amazon Bedrock Mantle OpenAI-compatible Chat Completions.", "text.generate") },
  "/v1/responses": { post: operation("amazon_bedrock_mantle_responses", responses, "Amazon Bedrock Mantle OpenAI-compatible Responses API.", "text.generate") },
  "/anthropic/v1/messages": { post: operation("amazon_bedrock_mantle_anthropic_messages", anthropicMessages, "Amazon Bedrock Mantle Anthropic-native Messages API.", "text.generate") },
};

const definitions = [
  {
    id: "amazon-bedrock",
    name: "Amazon Bedrock Mantle endpoint",
    docs: "https://docs.aws.amazon.com/bedrock/latest/userguide/apis.html",
    references: [
      "https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-mantle.html",
      "https://docs.aws.amazon.com/bedrock/latest/userguide/inference-chat-completions-mantle.html",
      "https://docs.aws.amazon.com/bedrock/latest/userguide/inference-messages-api.html",
      "https://docs.aws.amazon.com/bedrock/latest/userguide/models-api-compatibility.html",
    ],
    paths: bedrockMantlePaths,
  },
  { id: "anthropic-aws", name: "Anthropic on AWS", docs: "https://docs.anthropic.com/en/api/claude-on-amazon-bedrock", paths: { "/v1/messages": { post: operation("anthropic_aws_messages", object({ model: string, max_tokens: { type: "integer" }, messages: { type: "array", items: object() }, tools: { type: "array", items: object() } }, ["model", "max_tokens", "messages"]), "Anthropic Messages payload with AWS inference geography routing.") } } },
  { id: "anthropic-aws-us", name: "Anthropic on AWS US", docs: "https://docs.anthropic.com/en/api/claude-on-amazon-bedrock", paths: { "/v1/messages": { post: operation("anthropic_aws_us_messages", object({ model: string, max_tokens: { type: "integer" }, messages: { type: "array", items: object() }, tools: { type: "array", items: object() } }, ["model", "max_tokens", "messages"]), "Anthropic Messages payload pinned to AWS US inference geography.") } } },
  { id: "azure", name: "Azure OpenAI", docs: "https://learn.microsoft.com/en-us/azure/ai-foundry/openai/reference", paths: { "/openai/deployments/{deployment}/chat/completions": { post: operation("azure_chat", chat, "Azure deployment-scoped Chat Completions.") }, "/openai/deployments/{deployment}/embeddings": { post: operation("azure_embeddings", object({ input: {}, model: string }, ["input"]), "Azure deployment-scoped embeddings.") }, "/openai/v1/responses": { post: operation("azure_responses", object({ model: string, input: {} }, ["model", "input"]), "Azure OpenAI v1 Responses.") } } },
  { id: "baidu", name: "Baidu Qianfan", docs: "https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Fm2vrveyu", unsupported: "Catalog provider has no provider-local Phaseo transport configuration.", paths: {} },
  { id: "black-forest-labs", name: "Black Forest Labs", docs: "https://docs.bfl.ai/api-reference/tasks/generate-or-edit-an-image", paths: { "/v1/{model}": { post: operation("bfl_submit_image", object({ prompt: string, width: { type: "integer" }, height: { type: "integer" }, seed: { type: "integer" }, input_image: string }, ["prompt"]), "Submit asynchronous image generation or edit.") }, "/v1/get_result": { get: { operationId: "bfl_get_result", responses: { "200": { description: "Generation status" } } } } } },
  { id: "canopy-wave", name: "Canopy Wave", docs: "https://docs.canopywave.io/", unsupported: "Provider is explicitly marked not-ready by Phaseo executor coverage.", paths: {} },
  { id: "digitalocean", name: "DigitalOcean Gradient AI", docs: "https://docs.digitalocean.com/products/inference/", unsupported: "Catalog provider status is NotReady and no Phaseo executor is registered.", paths: {} },
  { id: "google-vertex", name: "Google Vertex AI", docs: "https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference", paths: { "/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:streamGenerateContent": { post: operation("vertex_gemini_stream", object({ contents: { type: "array", items: object() }, tools: { type: "array", items: object() } }, ["contents"]), "Gemini streaming generation on Vertex.") }, "/v1/projects/{project}/locations/{location}/publishers/anthropic/models/{model}:rawPredict": { post: operation("vertex_anthropic_raw_predict", object({ anthropic_version: string, messages: { type: "array", items: object() }, max_tokens: { type: "integer" } }, ["anthropic_version", "messages", "max_tokens"]), "Anthropic Messages on Vertex.") }, "/v1/projects/{project}/locations/{location}/endpoints/openapi/chat/completions": { post: operation("vertex_openapi_chat", chat, "Vertex OpenAI-compatible endpoint.") }, "/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:predictLongRunning": { post: operation("vertex_video_generate", object({ instances: { type: "array", items: object() }, parameters: object() }, ["instances"]), "Vertex Veo asynchronous video generation.") } } },
  { id: "google-vertex-eu", name: "Google Vertex AI EU", docs: "https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations", paths: { "/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:streamGenerateContent": { post: operation("vertex_eu_gemini_stream", object({ contents: { type: "array", items: object() } }, ["contents"]), "EU-location Vertex Gemini generation.") }, "/v1/projects/{project}/locations/{location}/publishers/anthropic/models/{model}:rawPredict": { post: operation("vertex_eu_anthropic_raw_predict", object({ anthropic_version: string, messages: { type: "array", items: object() }, max_tokens: { type: "integer" } }, ["anthropic_version", "messages", "max_tokens"]), "EU-location Anthropic on Vertex.") } } },
  { id: "ltx", name: "LTX", docs: "https://docs.ltx.io/api-documentation/api-reference/async-video-generation", paths: { "/v2/text-to-video": { post: operation("ltx_text_to_video", object({ model: string, prompt: string, duration: { type: ["integer", "null"] }, resolution: string, fps: { type: "integer" } }, ["model", "prompt"]), "Submit asynchronous LTX text-to-video generation.", "video.generate") }, "/v2/image-to-video": { post: operation("ltx_image_to_video", object({ model: string, prompt: string, image_uri: string, duration: { type: ["integer", "null"] }, resolution: string, fps: { type: "integer" } }, ["model", "prompt", "image_uri"]), "Submit asynchronous LTX image-to-video generation.", "video.generate") }, "/v2/audio-to-video": { post: operation("ltx_audio_to_video", object({ model: string, prompt: string, audio_uri: string, image_uri: string }, ["model", "prompt", "audio_uri"]), "Submit asynchronous LTX audio-to-video generation.", "video.generate") } } },
  { id: "runway", name: "Runway", docs: "https://docs.dev.runwayml.com/api/", paths: { "/v1/text_to_video": { post: operation("runway_text_to_video", object({ model: string, promptText: string, duration: { type: "integer" }, ratio: string, seed: { type: "integer" }, promptImage: string }, ["model", "promptText"]), "Submit asynchronous Runway text-to-video generation.") } } },
  { id: "suno", name: "Suno", docs: "https://docs.sunoapi.org/suno-api/generate-music", paths: { "/api/v1/generate": { post: operation("suno_generate_music", object({ prompt: string, customMode: { type: "boolean" }, instrumental: { type: "boolean" }, model: string, title: string, style: string, negativeTags: string }, ["customMode", "instrumental", "model"]), "Submit asynchronous music generation.") } } },
  { id: "voyage", name: "Voyage AI", docs: "https://docs.voyageai.com/reference/embeddings-api", paths: { "/v1/embeddings": { post: operation("voyage_embeddings", object({ input: {}, model: string, input_type: string, truncation: { type: "boolean" }, output_dimension: { type: "integer" }, output_dtype: string }, ["input", "model"]), "Voyage text and multimodal embeddings.") }, "/v1/rerank": { post: operation("voyage_rerank", object({ query: string, documents: { type: "array", items: {} }, model: string, top_k: { type: "integer" }, truncation: { type: "boolean" } }, ["query", "documents", "model"]), "Voyage reranking.") } } },
];

const requestedDefinitionIds = new Set(process.argv.slice(2));
const selectedDefinitions = requestedDefinitionIds.size > 0
  ? definitions.filter((definition) => requestedDefinitionIds.has(definition.id))
  : definitions;
if (requestedDefinitionIds.size > 0 && selectedDefinitions.length !== requestedDefinitionIds.size) {
  const found = new Set(selectedDefinitions.map((definition) => definition.id));
  const missing = [...requestedDefinitionIds].filter((providerId) => !found.has(providerId));
  throw new Error(`Unknown native overlay target(s): ${missing.join(", ")}`);
}

for (const definition of selectedDefinitions) {
  const operations = [];
  for (const [route, item] of Object.entries(definition.paths)) for (const method of ["get", "post"]) if (item[method]) operations.push({ capability: item[method]["x-phaseo-capability"] ?? item[method].operationId, method, path: route, operationId: item[method].operationId });
  const document = { openapi: "3.1.0", info: { title: `${definition.name} Phaseo contract`, version: "1.0.0" }, paths: definition.paths };
  const output = `${JSON.stringify(document, null, 2)}\n`;
  const overlays = [
    ...(definition.unsupported ? [definition.unsupported] : []),
    ...((definition.references ?? []).map((url) => `Additional official reference: ${url}`)),
  ];
  const manifest = { providerId: definition.id, displayName: definition.name, source: { kind: "official-docs", url: definition.docs }, operations, ...(overlays.length ? { overlays } : {}) };
  const provenance = { sourceUrl: definition.docs, referenceUrls: definition.references, reconstruction: "phaseo-executor-and-official-reference", unsupportedReason: definition.unsupported, bundleSha256: createHash("sha256").update(output).digest("hex") };
  const dir = path.join(root, "contracts", definition.id); await mkdir(dir, { recursive: true });
  await Promise.all([writeFile(path.join(dir, "openapi.json"), output), writeFile(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`), writeFile(path.join(dir, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`)]);
  console.log(`${definition.name}: ${operations.length} operations${definition.unsupported ? ` (${definition.unsupported})` : ""}`);
}
