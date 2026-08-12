import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PriceCard } from "@pipeline/pricing/types";
import { computeVideoPricedUsage } from "./video-pricing";

function makeCard(rules: Array<Record<string, unknown>>): PriceCard {
	return {
		provider: "minimax",
		model: "minimax/hailuo-2.3",
		endpoint: "video.generate",
		effective_from: null,
		effective_to: null,
		currency: "USD",
		version: null,
		rules: rules as any,
	};
}

function loadLtxCard(model: string): PriceCard {
	const pricingPath = path.resolve(
		process.cwd(),
		`../../packages/data/catalog/src/data/pricing/ltx/${model}/video.generate/pricing.json`,
	);
	return JSON.parse(fs.readFileSync(pricingPath, "utf8")) as PriceCard;
}

function makeSeedanceCard(): PriceCard {
	return {
		provider: "byteplus",
		model: "bytedance/seedance-2.5",
		endpoint: "video.generate",
		effective_from: null,
		effective_to: null,
		currency: "USD",
		version: null,
		rules: [
			{
				pricing_plan: "standard",
				meter: "total_tokens",
				unit: "token",
				unit_size: 1_000_000,
				price_per_unit: "10.7",
				currency: "USD",
				match: [{ path: "input_video_seconds", op: "eq", value: 0 }],
				priority: 100,
			},
			{
				pricing_plan: "standard",
				meter: "total_tokens",
				unit: "token",
				unit_size: 1_000_000,
				price_per_unit: "6.4",
				currency: "USD",
				match: [{ path: "input_video_seconds", op: "gt", value: 0 }],
				priority: 100,
			},
		] as any,
	};
}

describe("video-pricing", () => {
	it("prices LTX requests from the canonical catalogue card", () => {
		const card = loadLtxCard("ltx-2-5-pro");
		const textVideo = computeVideoPricedUsage({
			seconds: 10,
			card,
			model: "ltx-2-5-pro",
			requestOptions: { resolution: "1920x1080" },
		});
		const audioVideo = computeVideoPricedUsage({
			seconds: 10,
			card,
			model: "ltx-2-5-pro",
			requestOptions: { mode: "audio-to-video", resolution: "1920x1080", input_audio_seconds: 10 },
		});

		expect((textVideo as any)?.pricing?.total_usd_str).toBe("1.7");
		expect((audioVideo as any)?.pricing?.total_usd_str).toBe("1.7");
	});

	it("prices audio-driven generation by input audio duration only", () => {
		const card = makeCard([
			{ pricing_plan: "standard", meter: "output_video_seconds", unit: "second", unit_size: 1, price_per_unit: "0.17", currency: "USD", match: [], priority: 100 },
			{ pricing_plan: "standard", meter: "input_audio_seconds", unit: "second", unit_size: 1, price_per_unit: "0.17", currency: "USD", match: [{ path: "mode", op: "eq", value: "audio-to-video" }], priority: 110 },
		]);
		const priced = computeVideoPricedUsage({ seconds: 10, card, model: "ltx-2-5-pro", requestOptions: { mode: "audio-to-video", input_audio_seconds: 10 } });
		expect((priced as any)?.pricing?.total_usd_str).toBe("1.7");
		expect((priced as any)?.input_audio_seconds).toBe(10);
		expect((priced as any)?.output_video_seconds).toBeUndefined();
	});

	it("uses output_video_seconds meter when available", () => {
		const card = makeCard([
			{
				pricing_plan: "standard",
				meter: "output_video_seconds",
				unit: "seconds",
				unit_size: 6,
				price_per_unit: "0.28",
				currency: "USD",
				match: [
					{ path: "video_params.resolution", op: "eq", value: "768P" },
					{ path: "video_params.seconds", op: "eq", value: 6 },
				],
				priority: 100,
			},
		]);

		const priced = computeVideoPricedUsage({
			seconds: 6,
			card,
			model: "minimax/hailuo-2.3",
			requestOptions: {
				video_params: {
					resolution: "768P",
				},
			},
		});

		expect((priced as any)?.pricing?.total_usd_str).toBe("0.28");
	});

	it("prices normalized image and source-video inputs alongside output duration", () => {
		const card = makeCard([
			{
				pricing_plan: "standard",
				meter: "input_image",
				unit: "image",
				unit_size: 1,
				price_per_unit: "0.01",
				currency: "USD",
				match: [],
				priority: 100,
			},
			{
				pricing_plan: "standard",
				meter: "input_video_seconds",
				unit: "second",
				unit_size: 1,
				price_per_unit: "0.02",
				currency: "USD",
				match: [],
				priority: 100,
			},
			{
				pricing_plan: "standard",
				meter: "output_video_seconds",
				unit: "second",
				unit_size: 1,
				price_per_unit: "0.08",
				currency: "USD",
				match: [],
				priority: 100,
			},
		]);

		const priced = computeVideoPricedUsage({
			seconds: 5,
			card,
			model: "example/video",
			requestOptions: {
				input_image_count: 2,
				input_video_count: 1,
				input_video_seconds: 4,
			},
		});

		expect((priced as any)?.pricing?.total_usd_str).toBe("0.5");
	});

	it("falls back to legacy output_video meter when seconds meter is absent", () => {
		const card = makeCard([
			{
				pricing_plan: "standard",
				meter: "output_video",
				unit: "video",
				unit_size: 1,
				price_per_unit: "0.56",
				currency: "USD",
				match: [
					{ path: "video_params.resolution", op: "eq", value: "768P" },
					{ path: "video_params.seconds", op: "eq", value: 10 },
				],
				priority: 100,
			},
		]);

		const priced = computeVideoPricedUsage({
			seconds: 10,
			card,
			model: "minimax/hailuo-2.3",
			requestOptions: {
				video_params: {
					resolution: "768p",
				},
			},
		});

		expect((priced as any)?.pricing?.total_usd_str).toBe("0.56");
	});

	it("prices Seedance 2.5 without video input from resolution, ratio, duration, and frame rate", () => {
		const priced = computeVideoPricedUsage({
			seconds: 5,
			card: makeSeedanceCard(),
			model: "dreamina-seedance-2-5-260628",
			requestOptions: {
				resolution: "720p",
				aspect_ratio: "16:9",
				input_video_seconds: 0,
				frame_rate: 24,
			},
		});

		expect((priced as any)?.pricing?.total_usd_str).toBe("1.1556");
	});

	it("applies the Seedance 2.5 minimum token floor when video input is present", () => {
		const priced = computeVideoPricedUsage({
			seconds: 5,
			card: makeSeedanceCard(),
			model: "dreamina-seedance-2-5-260628",
			requestOptions: {
				resolution: "720p",
				aspect_ratio: "16:9",
				input_video_count: 1,
				input_video_seconds: 2,
				frame_rate: 24,
			},
		});

		expect((priced as any)?.pricing?.total_usd_str).toBe("1.24416");
	});

	it("uses Seedance 2.5 provider dimensions for ultrawide 480p output", () => {
		const priced = computeVideoPricedUsage({
			seconds: 5,
			card: makeSeedanceCard(),
			model: "bytedance/seedance-2.5",
			requestOptions: {
				resolution: "480p",
				aspect_ratio: "21:9",
				input_video_count: 1,
				input_video_seconds: 2,
				frame_rate: 24,
			},
		});

		expect((priced as any)?.pricing?.total_usd_str).toBe("0.5785344");
	});

	it("covers every documented Seedance 2.5 resolution and aspect-ratio dimension", () => {
		const dimensions = {
			"480p": {
				"16:9": [854, 480],
				"9:16": [480, 854],
				"4:3": [752, 560],
				"3:4": [560, 752],
				"1:1": [640, 640],
				"21:9": [992, 432],
			},
			"720p": {
				"16:9": [1280, 720],
				"9:16": [720, 1280],
				"4:3": [1112, 834],
				"3:4": [834, 1112],
				"1:1": [960, 960],
				"21:9": [1470, 630],
			},
		} as const;

		for (const [resolution, ratios] of Object.entries(dimensions)) {
			for (const [aspectRatio, [width, height]] of Object.entries(ratios)) {
				const priced = computeVideoPricedUsage({
					seconds: 4,
					card: makeSeedanceCard(),
					model: "dreamina-seedance-2-5-260628",
					requestOptions: {
						resolution,
						aspect_ratio: aspectRatio,
						input_video_seconds: 0,
						frame_rate: 24,
					},
				});
				const expectedTokens = Math.round((4 * width * height * 24) / 1024);
				const expectedCost = (expectedTokens * 10.7) / 1_000_000;
				expect(Number((priced as any)?.pricing?.total_usd_str)).toBeCloseTo(expectedCost, 8);
			}
		}
	});

	it("extends the Seedance 2.5 minimum token formula through 30-second outputs", () => {
		const priced = computeVideoPricedUsage({
			seconds: 30,
			card: makeSeedanceCard(),
			model: "bytedance/seedance-2.5",
			requestOptions: {
				resolution: "720p",
				aspect_ratio: "1:1",
				input_video_count: 1,
				input_video_seconds: 2,
				frame_rate: 24,
			},
		});

		expect((priced as any)?.pricing?.total_usd_str).toBe("6.912");
	});

	it("settles adaptive Seedance 2.5 jobs from authoritative provider token usage", () => {
		const priced = computeVideoPricedUsage({
			seconds: 30,
			card: makeSeedanceCard(),
			model: "dreamina-seedance-2-5-260628",
			requestOptions: {
				resolution: "720p",
				aspect_ratio: "adaptive",
				input_video_count: 1,
				input_video_seconds: 12,
				total_tokens: 123_456,
			},
		});

		expect((priced as any)?.pricing?.total_usd_str).toBe("0.7901184");
	});
});
