export class BodyLimitExceededError extends Error {
	constructor(message = "body_limit_exceeded") {
		super(message);
		this.name = "BodyLimitExceededError";
	}
}

export async function readStreamBytesWithLimit(
	stream: ReadableStream<Uint8Array> | null,
	maxBytes: number,
	errorMessage = "body_limit_exceeded",
): Promise<Uint8Array> {
	if (!stream) return new Uint8Array();
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value?.byteLength) continue;
			totalBytes += value.byteLength;
			if (totalBytes > maxBytes) {
				await reader.cancel(errorMessage).catch(() => undefined);
				throw new BodyLimitExceededError(errorMessage);
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const output = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return output;
}

export async function readStreamTextWithLimit(
	stream: ReadableStream<Uint8Array> | null,
	maxBytes: number,
	errorMessage = "body_limit_exceeded",
): Promise<string> {
	return new TextDecoder().decode(await readStreamBytesWithLimit(stream, maxBytes, errorMessage));
}

export async function readResponsePreview(response: Response, maxBytes: number): Promise<string> {
	if (!response.body || maxBytes <= 0) return "";
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let remaining = maxBytes;
	let preview = "";
	try {
		while (remaining > 0) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value?.byteLength) continue;
			const accepted = value.byteLength > remaining ? value.slice(0, remaining) : value;
			preview += decoder.decode(accepted, { stream: accepted.byteLength === value.byteLength });
			remaining -= accepted.byteLength;
			if (accepted.byteLength < value.byteLength || remaining === 0) {
				await reader.cancel("response_preview_complete").catch(() => undefined);
				break;
			}
		}
		preview += decoder.decode();
		return preview;
	} finally {
		reader.releaseLock();
	}
}

export function limitReadableStream(
	stream: ReadableStream<Uint8Array> | null,
	maxBytes: number,
	errorMessage = "response_body_too_large",
): ReadableStream<Uint8Array> | null {
	if (!stream) return null;
	const reader = stream.getReader();
	let totalBytes = 0;
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const { done, value } = await reader.read();
				if (done) {
					controller.close();
					reader.releaseLock();
					return;
				}
				if (!value?.byteLength) return;
				totalBytes += value.byteLength;
				if (totalBytes > maxBytes) {
					await reader.cancel(errorMessage).catch(() => undefined);
					controller.error(new BodyLimitExceededError(errorMessage));
					reader.releaseLock();
					return;
				}
				controller.enqueue(value);
			} catch (error) {
				controller.error(error);
				try { reader.releaseLock(); } catch { /* already released */ }
			}
		},
		async cancel(reason) {
			await reader.cancel(reason).catch(() => undefined);
			try { reader.releaseLock(); } catch { /* already released */ }
		},
	});
}
