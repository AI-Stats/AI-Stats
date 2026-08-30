import type {
  SpeechModelV2,
  SpeechModelV2CallOptions,
  TranscriptionModelV2,
  TranscriptionModelV2CallOptions,
} from '@ai-sdk/provider';

export type PhaseoAudioConfig = {
  apiKey: string;
  baseURL: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
};

export class PhaseoTranscriptionModel implements TranscriptionModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly provider = 'phaseo' as const;

  constructor(
    readonly modelId: string,
    private readonly config: PhaseoAudioConfig
  ) {}

  async doGenerate(options: TranscriptionModelV2CallOptions) {
    const formData = new FormData();
    const audio =
      typeof options.audio === 'string'
        ? Buffer.from(options.audio, 'base64')
        : options.audio;
    const audioBuffer = Uint8Array.from(audio).buffer as ArrayBuffer;
    formData.append('file', new Blob([audioBuffer], { type: options.mediaType }), 'audio');
    formData.append('model', this.modelId);
    for (const providerConfig of Object.values(options.providerOptions ?? {})) {
      for (const [key, value] of Object.entries(providerConfig)) {
        if (value != null) formData.append(key, String(value));
      }
    }

    const url = `${this.config.baseURL}/audio/transcriptions`;
    const response = await (this.config.fetch ?? fetch)(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...this.config.headers,
        ...options.headers,
      },
      body: formData,
      signal: options.abortSignal,
    });
    if (!response.ok) {
      throw new Error(`Phaseo transcription request failed with ${response.status}.`);
    }

    const data = (await response.json()) as {
      text?: string;
      language?: string;
      duration?: number;
      segments?: Array<{ text?: string; start?: number; end?: number }>;
    };
    return {
      text: data.text ?? '',
      segments: (data.segments ?? []).map(segment => ({
        text: segment.text ?? '',
        startSecond: segment.start ?? 0,
        endSecond: segment.end ?? 0,
      })),
      language: data.language,
      durationInSeconds: data.duration,
      warnings: [],
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: Object.fromEntries(response.headers.entries()),
        body: data,
      },
    };
  }
}

export class PhaseoSpeechModel implements SpeechModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly provider = 'phaseo' as const;

  constructor(
    readonly modelId: string,
    private readonly config: PhaseoAudioConfig
  ) {}

  async doGenerate(options: SpeechModelV2CallOptions) {
    const payload: Record<string, unknown> = {
      model: this.modelId,
      input: options.text,
      ...(options.voice && { voice: options.voice }),
      ...(options.outputFormat && { response_format: options.outputFormat }),
      ...(options.instructions && { instructions: options.instructions }),
      ...(options.speed != null && { speed: options.speed }),
    };
    for (const providerConfig of Object.values(options.providerOptions ?? {})) {
      Object.assign(payload, providerConfig);
    }

    const url = `${this.config.baseURL}/audio/speech`;
    const response = await (this.config.fetch ?? fetch)(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...this.config.headers,
        ...options.headers,
      },
      body: JSON.stringify(payload),
      signal: options.abortSignal,
    });
    if (!response.ok) {
      throw new Error(`Phaseo speech request failed with ${response.status}.`);
    }

    return {
      audio: new Uint8Array(await response.arrayBuffer()),
      warnings: [],
      request: { body: JSON.stringify(payload) },
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: Object.fromEntries(response.headers.entries()),
      },
    };
  }
}
