import type {
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4GenerateResult,
} from '@ai-sdk/provider';
import { mapGatewayFinishReason } from './map-gateway-finish-reason.js';
import { mapGatewayUsage } from './map-gateway-usage.js';
import { mapPhaseoProviderMetadata } from './map-phaseo-provider-metadata.js';

/**
 * Maps a Phaseo/OpenAI-compatible Chat Completions response to ProviderV4.
 */
export function mapGatewayResponse(
  response: any,
  _options: LanguageModelV4CallOptions,
  gatewayRequest: any,
  responseHeaders?: Record<string, string>
): LanguageModelV4GenerateResult {
  const choice = response.choices?.[0];
  if (!choice) throw new Error('No choices in gateway response');

  const message = choice.message ?? {};
  const content: LanguageModelV4Content[] = [];

  appendReasoning(content, message);
  appendMessageContent(content, message.content);
  appendSources(content, message.annotations ?? response.annotations);

  if (Array.isArray(message.tool_calls)) {
    for (const toolCall of message.tool_calls) {
      content.push({
        type: 'tool-call',
        toolCallId: toolCall.id,
        toolName: toolCall.function?.name ?? '',
        input: toolCall.function?.arguments ?? '',
        providerExecuted: false,
      });
    }
  }

  return {
    content,
    finishReason: mapGatewayFinishReason(choice.finish_reason),
    usage: mapGatewayUsage(response.usage ?? {}),
    providerMetadata: mapPhaseoProviderMetadata(response, responseHeaders),
    request: { body: gatewayRequest },
    response: {
      id: response.id,
      timestamp:
        typeof response.created === 'number'
          ? new Date(response.created * 1000)
          : undefined,
      modelId: response.model,
      headers: responseHeaders,
      body: response,
    },
    warnings: [],
  };
}

function appendReasoning(content: LanguageModelV4Content[], message: any): void {
  const directReasoning =
    typeof message.reasoning_content === 'string'
      ? message.reasoning_content
      : typeof message.reasoning === 'string'
        ? message.reasoning
        : undefined;

  if (directReasoning) {
    content.push({ type: 'reasoning', text: directReasoning });
    return;
  }

  if (!Array.isArray(message.reasoning_details)) return;

  for (const detail of message.reasoning_details) {
    const detailType = String(detail?.type ?? '');
    const text =
      typeof detail?.text === 'string'
        ? detail.text
        : typeof detail?.content === 'string'
          ? detail.content
          : undefined;

    if (text && (detailType.includes('text') || detailType === 'reasoning')) {
      content.push({ type: 'reasoning', text });
    }
  }
}

function appendMessageContent(
  content: LanguageModelV4Content[],
  messageContent: unknown
): void {
  if (typeof messageContent === 'string') {
    if (messageContent) content.push({ type: 'text', text: messageContent });
    return;
  }
  if (!Array.isArray(messageContent)) return;

  for (const part of messageContent) {
    switch (part?.type) {
      case 'text':
      case 'output_text':
        if (typeof part.text === 'string' && part.text) {
          content.push({ type: 'text', text: part.text });
        }
        break;
      case 'reasoning':
        if (typeof part.text === 'string') {
          content.push({ type: 'reasoning', text: part.text });
        }
        break;
      case 'file':
      case 'output_file': {
        const file = mapFilePart(part, 'file');
        if (file) content.push(file);
        break;
      }
      case 'reasoning-file': {
        const file = mapFilePart(part, 'reasoning-file');
        if (file) content.push(file);
        break;
      }
    }
  }
}

function mapFilePart(
  part: any,
  type: 'file' | 'reasoning-file'
): Extract<LanguageModelV4Content, { type: 'file' | 'reasoning-file' }> | undefined {
  const mediaType = part.mediaType ?? part.media_type ?? part.mime_type;
  if (typeof mediaType !== 'string') return undefined;

  const url = part.url ?? part.file_url;
  if (typeof url === 'string') {
    return {
      type,
      mediaType,
      data: { type: 'url', url: new URL(url) },
    };
  }

  const data = part.data ?? part.file_data;
  if (typeof data === 'string' || data instanceof Uint8Array) {
    return {
      type,
      mediaType,
      data: { type: 'data', data },
    };
  }
  return undefined;
}

function appendSources(content: LanguageModelV4Content[], annotations: unknown): void {
  if (!Array.isArray(annotations)) return;

  annotations.forEach((annotation, index) => {
    const citation = annotation?.url_citation ?? annotation;
    if (
      (annotation?.type === 'url_citation' || citation?.url) &&
      typeof citation?.url === 'string'
    ) {
      content.push({
        type: 'source',
        sourceType: 'url',
        id: String(citation.id ?? citation.url ?? `source-${index}`),
        url: citation.url,
        title: typeof citation.title === 'string' ? citation.title : undefined,
      });
    }
  });
}
