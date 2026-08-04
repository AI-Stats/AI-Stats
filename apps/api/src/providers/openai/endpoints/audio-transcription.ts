// Purpose: Provider adapter module.
// Why: Encapsulates provider-specific configuration and endpoint mapping.
// How: Exposes provider-specific helpers for routing and execution.

import type { AdapterResult, ProviderExecuteArgs } from "../../types";
import { AudioTranscriptionSchema, type AudioTranscriptionRequest } from "@core/schemas";
import { buildAdapterPayload } from "../../utils";
import { openAICompatHeaders, openAICompatUrl, resolveOpenAICompatKey } from "../../openai-compatible/config";
import { upstreamTestHeaders } from "@providers/shared/testing";
import { estimateOpenAiSpeechToTextUsage, mergeSpeechToTextUsage } from "./audio-transcription-usage";

function normalizeModelName(model?: string | null): string {
    if (!model) return "";
    const value = model.trim();
    if (!value) return "";
    const parts = value.split("/");
    return parts[parts.length - 1] || value;
}

function defaultTranscriptionResponseFormat(model?: string | null): string {
    const normalized = normalizeModelName(model).toLowerCase();
    if (normalized === "whisper-1") return "verbose_json";
    if (normalized.includes("transcribe")) return "json";
    return "verbose_json";
}

function invalidParameterResponse(param: string, message: string): Response {
    return new Response(
        JSON.stringify({ error: { type: "invalid_request_error", message, param } }),
        { status: 400, headers: { "Content-Type": "application/json" } },
    );
}

function emptyBill() {
    return {
        cost_cents: 0,
        currency: "USD" as const,
        usage: undefined as any,
        upstream_id: null,
        finish_reason: null,
    };
}

async function parseAudioTextPayload(response: Response): Promise<Record<string, any> | undefined> {
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
        return await response.clone().json().catch(() => undefined);
    }
    const text = await response.clone().text().catch(() => "");
    if (!text) return undefined;
    return { text };
}

function normalizeAudioTextUsage(payload: Record<string, any> | undefined): Record<string, any> | undefined {
    const usage = payload?.usage;
    if (!usage || typeof usage !== "object") return undefined;
    return usage as Record<string, any>;
}

export async function exec(args: ProviderExecuteArgs): Promise<AdapterResult> {
    const keyInfo = await resolveOpenAICompatKey(args);
    const adapterPayload = buildAdapterPayload(AudioTranscriptionSchema, args.body, []).adapterPayload as AudioTranscriptionRequest;
    const body: AudioTranscriptionRequest = {
        ...adapterPayload,
        model: args.providerModelSlug || adapterPayload.model,
    };

    const modelName = normalizeModelName(body.model).toLowerCase();
    const responseFormat = body.response_format ?? defaultTranscriptionResponseFormat(body.model);
    const isGptTranscribe = modelName.includes("transcribe") && modelName !== "whisper-1";
    const isDiarize = modelName.includes("transcribe-diarize");
    const supportedGptFormats = isDiarize
        ? new Set(["json", "text", "diarized_json"])
        : new Set(["json"]);
    if (isGptTranscribe && !supportedGptFormats.has(responseFormat)) {
        return {
            kind: "completed",
            upstream: invalidParameterResponse(
                "response_format",
                isDiarize
                    ? `${modelName} supports response_format="json", "text", or "diarized_json".`
                    : `${modelName} only supports response_format="json".`,
            ),
            bill: emptyBill(),
            keySource: keyInfo.source,
            byokKeyId: keyInfo.byokId,
        };
    }
    if (isGptTranscribe && (body.timestamp_granularities?.length ?? 0) > 0) {
        return {
            kind: "completed",
            upstream: invalidParameterResponse(
                "timestamp_granularities",
                `${modelName} does not support timestamp_granularities; use whisper-1 with verbose_json.`,
            ),
            bill: emptyBill(),
            keySource: keyInfo.source,
            byokKeyId: keyInfo.byokId,
        };
    }
    if (isDiarize && body.prompt) {
        return {
            kind: "completed",
            upstream: invalidParameterResponse("prompt", `${modelName} does not support prompt.`),
            bill: emptyBill(),
            keySource: keyInfo.source,
            byokKeyId: keyInfo.byokId,
        };
    }
    if (isDiarize && (body.include?.length ?? 0) > 0) {
        return {
            kind: "completed",
            upstream: invalidParameterResponse("include", `${modelName} does not support include.`),
            bill: emptyBill(),
            keySource: keyInfo.source,
            byokKeyId: keyInfo.byokId,
        };
    }
    if (isGptTranscribe && !isDiarize) {
        const unsupported = body.include?.find((entry) => entry !== "logprobs");
        if (unsupported) {
            return {
                kind: "completed",
                upstream: invalidParameterResponse("include", `${modelName} only supports include=["logprobs"].`),
                bill: emptyBill(),
                keySource: keyInfo.source,
                byokKeyId: keyInfo.byokId,
            };
        }
    }
    if (modelName === "whisper-1") {
        const supportedFormats = new Set(["json", "text", "srt", "verbose_json", "vtt"]);
        if (!supportedFormats.has(responseFormat)) {
            return {
                kind: "completed",
                upstream: invalidParameterResponse(
                    "response_format",
                    `whisper-1 does not support response_format="${responseFormat}".`,
                ),
                bill: emptyBill(),
                keySource: keyInfo.source,
                byokKeyId: keyInfo.byokId,
            };
        }
        if ((body.include?.length ?? 0) > 0) {
            return {
                kind: "completed",
                upstream: invalidParameterResponse(
                    "include",
                    "whisper-1 does not support include; log probabilities require a GPT transcription model.",
                ),
                bill: emptyBill(),
                keySource: keyInfo.source,
                byokKeyId: keyInfo.byokId,
            };
        }
        if ((body.timestamp_granularities?.length ?? 0) > 0 && responseFormat !== "verbose_json") {
            return {
                kind: "completed",
                upstream: invalidParameterResponse(
                    "timestamp_granularities",
                    "whisper-1 timestamp_granularities require response_format=\"verbose_json\".",
                ),
                bill: emptyBill(),
                keySource: keyInfo.source,
                byokKeyId: keyInfo.byokId,
            };
        }
    }

    const form = new FormData();
    form.append("model", body.model);
    const filename = typeof File !== "undefined" && body.file instanceof File && body.file.name
        ? body.file.name
        : "audio";
    form.append("file", body.file, filename);
    if (body.language) form.append("language", body.language);
    if (body.prompt) form.append("prompt", body.prompt);
    if (typeof body.temperature === "number") form.append("temperature", String(body.temperature));
    form.append("response_format", responseFormat);
    if (Array.isArray(body.timestamp_granularities)) {
        for (const entry of body.timestamp_granularities) {
            if (entry === "word" || entry === "segment") {
                form.append("timestamp_granularities[]", entry);
            }
        }
    }
    if (Array.isArray(body.include)) {
        for (const entry of body.include) {
            if (typeof entry === "string" && entry.trim().length > 0) {
                form.append("include[]", entry);
            }
        }
    }
    if (body.chunking_strategy !== undefined) {
        form.append(
            "chunking_strategy",
            typeof body.chunking_strategy === "string"
                ? body.chunking_strategy
                : JSON.stringify(body.chunking_strategy),
        );
    }
    for (const name of body.known_speaker_names ?? []) {
        form.append("known_speaker_names[]", name);
    }
    for (const reference of body.known_speaker_references ?? []) {
        form.append("known_speaker_references[]", reference);
    }

    const headers = openAICompatHeaders(args.providerId, keyInfo.key, upstreamTestHeaders(args.meta));
    delete (headers as any)["Content-Type"];

    const res = await (args.upstreamTiming?.fetch ?? fetch)(openAICompatUrl(args.providerId, "/audio/transcriptions"), {
        method: "POST",
        headers,
        body: form,
    });

    const normalized = await parseAudioTextPayload(res);
    let usage = normalizeAudioTextUsage(normalized);
    if (res.ok) {
        const estimated = await estimateOpenAiSpeechToTextUsage({
            file: body.file,
            prompt: body.prompt,
            text: typeof normalized?.text === "string" ? normalized.text : undefined,
        });
        usage = mergeSpeechToTextUsage(usage, estimated);
        if (normalized && typeof normalized === "object") {
            normalized.usage = usage;
        }
    }

    const bill = {
        cost_cents: 0,
        currency: "USD" as const,
        usage: usage as any,
        upstream_id: res.headers.get("x-request-id"),
        finish_reason: null,
    };

    return {
        kind: "completed",
        upstream: res,
        bill,
        normalized,
        keySource: keyInfo.source,
        byokKeyId: keyInfo.byokId,
    };
}

