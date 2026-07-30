import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4FinishReason,
  LanguageModelV4StreamPart,
} from '@ai-sdk/provider';
import type { PhaseoConfig, PhaseoModelSettings } from './phaseo-settings.js';
import { convertToGatewayChatRequest } from './convert-to-gateway-chat.js';
import { mapGatewayResponse } from './map-gateway-response.js';
import { parseSSEStream } from './utils/parse-sse-stream.js';
import { mapGatewayFinishReason } from './map-gateway-finish-reason.js';
import { mapGatewayUsage } from './map-gateway-usage.js';
import {
  mapPhaseoProviderMetadata,
  mergePhaseoProviderMetadata,
} from './map-phaseo-provider-metadata.js';
import { createPhaseoErrorHandler } from './utils/error-handler.js';
import { headersToRecord } from './utils/headers.js';

/**
 * Phaseo language model implementation for AI SDK 7 / ProviderV4.
 */
export class PhaseoLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4' as const;
  readonly provider = 'phaseo' as const;
  readonly modelId: string;
  readonly supportedUrls = {};
  readonly defaultObjectGenerationMode = 'json' as const;

  private readonly config: PhaseoConfig;
  private readonly settings: PhaseoModelSettings;

  constructor(
    modelId: string,
    config: PhaseoConfig,
    settings: PhaseoModelSettings = {}
  ) {
    this.modelId = modelId;
    this.config = config;
    this.settings = settings;
  }

  async doGenerate(options: LanguageModelV4CallOptions) {
    const gatewayRequest = convertToGatewayChatRequest(
      options.prompt,
      this.modelId,
      this.settings,
      options
    );
    const url = `${this.config.baseURL}/chat/completions`;
    const fetchImpl = this.config.fetch ?? fetch;
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: this.requestHeaders(options.headers),
      body: JSON.stringify({ ...gatewayRequest, stream: false }),
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errorHandler = createPhaseoErrorHandler();
      throw (await errorHandler({ url, requestBodyValues: gatewayRequest, response })).value;
    }

    return mapGatewayResponse(
      await response.json(),
      options,
      gatewayRequest,
      headersToRecord(response.headers)
    );
  }

  async doStream(options: LanguageModelV4CallOptions) {
    const gatewayRequest = convertToGatewayChatRequest(
      options.prompt,
      this.modelId,
      this.settings,
      options
    );
    const requestBody = {
      ...gatewayRequest,
      stream: true,
      stream_options: { include_usage: true },
    };
    const requestBodyJson = JSON.stringify(requestBody);
    const url = `${this.config.baseURL}/chat/completions`;
    const fetchImpl = this.config.fetch ?? fetch;
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: this.requestHeaders(options.headers),
      body: requestBodyJson,
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errorHandler = createPhaseoErrorHandler();
      throw (await errorHandler({ url, requestBodyValues: gatewayRequest, response })).value;
    }

    let finishReason: LanguageModelV4FinishReason = mapGatewayFinishReason(undefined);
    let usage = mapGatewayUsage({});
    const responseHeaders = headersToRecord(response.headers);
    let providerMetadata = mapPhaseoProviderMetadata(undefined, responseHeaders);
    let responseMetadataEmitted = false;
    let textStarted = false;
    let reasoningStarted = false;
    const textPartId = 'text-0';
    const reasoningPartId = 'reasoning-0';
    const toolCalls: Array<{
      id: string;
      toolName: string;
      input: string;
      started: boolean;
    }> = [];

    return {
      stream: parseSSEStream(response).pipeThrough(
        new TransformStream<any, LanguageModelV4StreamPart>({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
          },
          transform(chunk, controller) {
            if (chunk?.error) {
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            providerMetadata = mergePhaseoProviderMetadata(
              providerMetadata,
              mapPhaseoProviderMetadata(chunk, responseHeaders)
            );

            if (
              !responseMetadataEmitted &&
              (typeof chunk?.id === 'string' ||
                typeof chunk?.model === 'string' ||
                typeof chunk?.created === 'number')
            ) {
              responseMetadataEmitted = true;
              controller.enqueue({
                type: 'response-metadata',
                id: typeof chunk.id === 'string' ? chunk.id : undefined,
                modelId: typeof chunk.model === 'string' ? chunk.model : undefined,
                timestamp:
                  typeof chunk.created === 'number'
                    ? new Date(chunk.created * 1000)
                    : undefined,
              });
            }

            if (options.includeRawChunks) {
              controller.enqueue({ type: 'raw', rawValue: chunk });
            }

            const choice = chunk?.choices?.[0];
            if (choice) {
              const delta = choice.delta ?? {};
              const reasoningDelta = readReasoningDelta(delta);
              if (reasoningDelta) {
                if (!reasoningStarted) {
                  reasoningStarted = true;
                  controller.enqueue({ type: 'reasoning-start', id: reasoningPartId });
                }
                controller.enqueue({
                  type: 'reasoning-delta',
                  id: reasoningPartId,
                  delta: reasoningDelta,
                });
              }

              if (typeof delta.content === 'string' && delta.content) {
                if (!textStarted) {
                  textStarted = true;
                  controller.enqueue({ type: 'text-start', id: textPartId });
                }
                controller.enqueue({
                  type: 'text-delta',
                  id: textPartId,
                  delta: delta.content,
                });
              }

              if (Array.isArray(delta.tool_calls)) {
                appendToolCallDeltas(delta.tool_calls, toolCalls, controller);
              }

              if (Array.isArray(delta.annotations)) {
                emitSources(delta.annotations, controller);
              }

              if (choice.finish_reason) {
                finishReason = mapGatewayFinishReason(choice.finish_reason);
              }
            }

            if (chunk?.usage) usage = mapGatewayUsage(chunk.usage);
          },
          flush(controller) {
            if (reasoningStarted) {
              controller.enqueue({ type: 'reasoning-end', id: reasoningPartId });
            }
            if (textStarted) {
              controller.enqueue({ type: 'text-end', id: textPartId });
            }

            for (const toolCall of toolCalls) {
              if (!toolCall) continue;
              if (toolCall.started) {
                controller.enqueue({ type: 'tool-input-end', id: toolCall.id });
              }
              controller.enqueue({
                type: 'tool-call',
                toolCallId: toolCall.id,
                toolName: toolCall.toolName,
                input: toolCall.input,
                providerExecuted: false,
              });
            }

            controller.enqueue({
              type: 'finish',
              finishReason,
              usage,
              providerMetadata,
            });
          },
        })
      ),
      response: { headers: responseHeaders },
      request: { body: requestBodyJson },
    };
  }

  private requestHeaders(
    callHeaders?: Record<string, string | undefined>
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        ...this.config.headers,
        ...callHeaders,
      }).filter((entry): entry is [string, string] => entry[1] !== undefined)
    );
  }
}

function readReasoningDelta(delta: any): string | undefined {
  if (typeof delta.reasoning_content === 'string') return delta.reasoning_content;
  if (typeof delta.reasoning === 'string') return delta.reasoning;
  if (!Array.isArray(delta.reasoning_details)) return undefined;

  const text = delta.reasoning_details
    .map((detail: any) =>
      typeof detail?.text === 'string'
        ? detail.text
        : typeof detail?.delta === 'string'
          ? detail.delta
          : ''
    )
    .join('');
  return text || undefined;
}

function appendToolCallDeltas(
  deltas: any[],
  toolCalls: Array<{ id: string; toolName: string; input: string; started: boolean }>,
  controller: TransformStreamDefaultController<LanguageModelV4StreamPart>
): void {
  for (const delta of deltas) {
    const index = delta.index ?? 0;
    const id = delta.id ?? toolCalls[index]?.id ?? `tool-${index}`;
    const toolName = delta.function?.name ?? toolCalls[index]?.toolName ?? '';

    if (!toolCalls[index]) {
      toolCalls[index] = { id, toolName, input: '', started: false };
    } else {
      toolCalls[index].id = id;
      if (toolName) toolCalls[index].toolName = toolName;
    }

    if (!toolCalls[index].started) {
      toolCalls[index].started = true;
      controller.enqueue({
        type: 'tool-input-start',
        id: toolCalls[index].id,
        toolName: toolCalls[index].toolName,
        providerExecuted: false,
      });
    }

    if (typeof delta.function?.arguments === 'string' && delta.function.arguments) {
      toolCalls[index].input += delta.function.arguments;
      controller.enqueue({
        type: 'tool-input-delta',
        id: toolCalls[index].id,
        delta: delta.function.arguments,
      });
    }
  }
}

function emitSources(
  annotations: any[],
  controller: TransformStreamDefaultController<LanguageModelV4StreamPart>
): void {
  annotations.forEach((annotation, index) => {
    const citation = annotation?.url_citation ?? annotation;
    if (typeof citation?.url !== 'string') return;
    controller.enqueue({
      type: 'source',
      sourceType: 'url',
      id: String(citation.id ?? citation.url ?? `source-${index}`),
      url: citation.url,
      title: typeof citation.title === 'string' ? citation.title : undefined,
    });
  });
}
