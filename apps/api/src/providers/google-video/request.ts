import type { IRVideoGenerationRequest } from "@core/ir";
import { resolveVideoOutputCount, resolveVideoSize } from "@core/video-request-options";
import { toGoogleVideoDurationSeconds } from "./shared";

export class InvalidGoogleVideoRequestError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InvalidGoogleVideoRequestError";
	}
}

export type NormalizedGoogleVeoRequest = {
	seconds: number;
	resolution: "720p" | "1080p" | "4k";
	aspectRatio: "16:9" | "9:16";
	outputCount: number;
	firstFrame?: unknown;
	lastFrame?: unknown;
	sourceVideo?: unknown;
	referenceImages: Array<{ image: unknown; referenceType: string }>;
	inputImageCount: number;
};

function sourceValue(reference: NonNullable<IRVideoGenerationRequest["inputReferences"]>[number]): unknown {
	if (!reference) return undefined;
	return reference.url ?? reference.raw ?? (reference.data
		? `data:${reference.mimeType ?? "application/octet-stream"};base64,${reference.data}`
		: undefined);
}

function defined(values: unknown[]): unknown[] {
	return values.filter((value) => value !== undefined && value !== null && value !== "");
}

export function normalizeGoogleVeoRequest(
	ir: IRVideoGenerationRequest,
	model: string,
): NormalizedGoogleVeoRequest {
	const normalizedModel = model.toLowerCase();
	const isVeo31 = normalizedModel.includes("veo-3.1");
	if (!isVeo31) {
		throw new InvalidGoogleVideoRequestError(`Unsupported Google video model: ${model}. Use a Veo 3.1 model.`);
	}
	if (ir.inputReferences?.some((reference) => reference.type === "audio" || reference.type === "mask")) {
		throw new InvalidGoogleVideoRequestError("Veo 3.1 accepts image and Veo-generated video inputs only.");
	}
	if (ir.generateAudio === false) {
		throw new InvalidGoogleVideoRequestError("Veo 3.1 always generates audio; generate_audio cannot be false.");
	}
	const requestedCount = resolveVideoOutputCount({ sampleCount: ir.sampleCount, numberOfVideos: ir.numberOfVideos });
	if (requestedCount !== 1) {
		throw new InvalidGoogleVideoRequestError("Veo 3.1 generates exactly one video per request.");
	}

	const firstFrameReferences = ir.inputReferences?.filter(
		(reference) => reference.type === "image" && (reference.role === "first_frame" || reference.role == null),
	) ?? [];
	const lastFrameReferences = ir.inputReferences?.filter(
		(reference) => reference.type === "image" && reference.role === "last_frame",
	) ?? [];
	const assetReferences = ir.inputReferences?.filter(
		(reference) => reference.type === "image" && reference.role === "reference",
	) ?? [];
	const videoReferences = ir.inputReferences?.filter((reference) => reference.type === "video") ?? [];
	const firstFrames = defined([
		ir.inputImage,
		ir.input?.image,
		ir.inputReference,
		...firstFrameReferences.map(sourceValue),
	]);
	const lastFrames = defined([
		ir.lastFrame,
		ir.input?.lastFrame,
		...lastFrameReferences.map(sourceValue),
	]);
	const sourceVideos = defined([
		ir.inputVideo,
		ir.input?.video,
		...videoReferences.map(sourceValue),
	]);
	if (firstFrames.length > 1 || lastFrames.length > 1 || sourceVideos.length > 1) {
		throw new InvalidGoogleVideoRequestError("Veo 3.1 accepts at most one first frame, last frame, and source video.");
	}
	const legacyReferences = [...(ir.referenceImages ?? []), ...(ir.input?.referenceImages ?? [])].map((entry) => ({
		image: entry.image ?? entry.url ?? entry.uri ?? entry,
		referenceType: String(entry.referenceType ?? entry.reference_type ?? "asset"),
	}));
	const referenceImages = [
		...legacyReferences,
		...assetReferences.map((reference) => ({
			image: sourceValue(reference),
			referenceType: reference.referenceType ?? "asset",
		})),
	].filter((reference) => reference.image != null);
	if (referenceImages.length > 3) {
		throw new InvalidGoogleVideoRequestError("Veo 3.1 accepts at most three reference images.");
	}
	if (sourceVideos.length > 0 && (firstFrames.length > 0 || lastFrames.length > 0 || referenceImages.length > 0)) {
		throw new InvalidGoogleVideoRequestError("Veo video extension cannot be combined with image conditioning.");
	}
	if (referenceImages.length > 0 && (firstFrames.length > 0 || lastFrames.length > 0)) {
		throw new InvalidGoogleVideoRequestError("Veo reference-image generation cannot be combined with first or last frames.");
	}
	if (lastFrames.length > 0 && firstFrames.length === 0) {
		throw new InvalidGoogleVideoRequestError("Veo last-frame interpolation requires a first-frame image.");
	}

	const resolution = (resolveVideoSize({ size: ir.size, resolution: ir.resolution }) ?? "720p").toLowerCase();
	if (resolution !== "720p" && resolution !== "1080p" && resolution !== "4k") {
		throw new InvalidGoogleVideoRequestError("Veo 3.1 resolution must be 720p, 1080p, or 4k.");
	}
	const isLite = normalizedModel.includes("lite");
	if (isLite && resolution === "4k") {
		throw new InvalidGoogleVideoRequestError("Veo 3.1 Lite does not support 4k output.");
	}
	if (isLite && (sourceVideos.length > 0 || referenceImages.length > 0)) {
		throw new InvalidGoogleVideoRequestError("Veo 3.1 Lite does not support video extension or reference images.");
	}
	const seconds = toGoogleVideoDurationSeconds(ir) ?? 8;
	if (seconds !== 4 && seconds !== 6 && seconds !== 8) {
		throw new InvalidGoogleVideoRequestError("Veo 3.1 duration must be 4, 6, or 8 seconds.");
	}
	if ((resolution !== "720p" || sourceVideos.length > 0 || referenceImages.length > 0) && seconds !== 8) {
		throw new InvalidGoogleVideoRequestError("Veo 3.1 requires an 8-second duration for 1080p, 4k, extension, and reference-image requests.");
	}
	if (sourceVideos.length > 0 && resolution !== "720p") {
		throw new InvalidGoogleVideoRequestError("Veo video extension only supports 720p output.");
	}
	const aspectRatio = ir.aspectRatio ?? ir.ratio ?? "16:9";
	if (aspectRatio !== "16:9" && aspectRatio !== "9:16") {
		throw new InvalidGoogleVideoRequestError("Veo 3.1 aspect ratio must be 16:9 or 9:16.");
	}

	return {
		seconds,
		resolution,
		aspectRatio,
		outputCount: 1,
		...(firstFrames[0] != null ? { firstFrame: firstFrames[0] } : {}),
		...(lastFrames[0] != null ? { lastFrame: lastFrames[0] } : {}),
		...(sourceVideos[0] != null ? { sourceVideo: sourceVideos[0] } : {}),
		referenceImages,
		inputImageCount: firstFrames.length + lastFrames.length + referenceImages.length,
	};
}
