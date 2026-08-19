import {
	CHAT_ROOM_BY_ID,
	CHAT_ROOMS,
	capabilityIdToRoomId,
	filterModelsForRoom,
	roomIdsFromCapabilities,
} from "@/lib/chat/rooms";
import minimaxRoutes from "../../../../../packages/data/catalog/src/data/api_providers/minimax/models.json";
import sunoRoutes from "../../../../../packages/data/catalog/src/data/api_providers/suno/models.json";

describe("chat room capability mapping", () => {
	it("keeps video visible and Fusion at the bottom of the room picker", () => {
		expect(CHAT_ROOMS.some((room) => room.id === "video")).toBe(true);
		expect(CHAT_ROOMS.at(-1)?.id).toBe("fusion");
		for (const room of CHAT_ROOMS) {
			expect(CHAT_ROOM_BY_ID[room.id]).toBe(room);
		}
	});

	it("maps moderation and embeddings capabilities explicitly", () => {
		expect(capabilityIdToRoomId("moderations.create")).toBe("moderation");
		expect(capabilityIdToRoomId("text.moderate")).toBe("moderation");
		expect(capabilityIdToRoomId("text.embed")).toBe("embeddings");
		expect(capabilityIdToRoomId("audio.realtime")).toBe("realtime");
		expect(capabilityIdToRoomId("realtime")).toBe("realtime");
	});

	it("does not map capabilities reserved for future rooms", () => {
		expect(capabilityIdToRoomId("ocr")).toBeNull();
		expect(capabilityIdToRoomId("rerank")).toBeNull();
		expect(capabilityIdToRoomId("text.rerank")).toBeNull();
		expect(capabilityIdToRoomId("image.edit")).toBeNull();
	});

	it("returns all distinct room ids from capabilities", () => {
		expect(
			roomIdsFromCapabilities([
				"text.generate",
				"images.generations",
				"moderation",
				"text.generate",
			]),
		).toEqual(["text", "image", "moderation"]);
	});

	it("filters models by room support", () => {
		const models = [
			{
				modelId: "openai/gpt-5",
				capabilities: ["text.generate"],
			},
			{
				modelId: "openai/gpt-image-1",
				capabilities: ["images.generations"],
			},
			{
				modelId: "openai/omni-embed",
				capabilities: ["text.embed"],
			},
			{
				modelId: "openai/gpt-realtime-2",
				capabilities: ["audio.realtime"],
			},
		];
		expect(filterModelsForRoom(models, "text")).toHaveLength(1);
		expect(filterModelsForRoom(models, "image")).toHaveLength(1);
		expect(filterModelsForRoom(models, "embeddings")).toHaveLength(1);
		expect(filterModelsForRoom(models, "realtime")).toHaveLength(1);
	});

	it("does not guess a room when a model declares an unsupported capability", () => {
		const models = [
			{ modelId: "mistral/ocr-4.1", capabilities: ["ocr"] },
			{ modelId: "deepseek/deepseek-ocr", capabilities: ["ocr"] },
			{ modelId: "qwen/qwen3-reranker-8b", capabilities: ["rerank"] },
			{ modelId: "qwen/qwen3-embedding-8b", capabilities: ["text.rerank"] },
		];

		expect(filterModelsForRoom(models, "text")).toEqual([]);
	});

	it("falls back to model id inference only when capabilities are absent", () => {
		const models = [
			{ modelId: "openai/gpt-5" },
			{ modelId: "openai/gpt-image-1", capabilities: [] },
		];

		expect(filterModelsForRoom(models, "text")).toEqual([models[0]]);
		expect(filterModelsForRoom(models, "image")).toEqual([models[1]]);
	});

	it("keeps the routable MiniMax Music 2.6 selectors eligible for the Music room", () => {
		const routes = minimaxRoutes.filter((route) =>
			["minimax/music-2.6", "minimax/music-2.6-free"].includes(route.api_model_id),
		);
		expect(routes).toHaveLength(2);
		for (const route of routes) {
			expect(route.is_active_gateway).toBe(true);
			expect(route.routing_status).toBe("active");
			expect(route.capabilities).toEqual(expect.arrayContaining([
				expect.objectContaining({ capability_id: "music.generate", status: "active" }),
			]));
			expect(filterModelsForRoom([
				{ modelId: route.api_model_id, capabilities: ["music.generate"] },
			], "music")).toHaveLength(1);
		}
	});

	it("keeps unavailable music providers out of the available catalogue", () => {
		const sunoMusicRoutes = sunoRoutes.filter((route) =>
			route.capabilities.some(
				(capability) => capability.capability_id === "music.generate",
			),
		);
		expect(sunoMusicRoutes.length).toBeGreaterThan(1);
		for (const route of sunoMusicRoutes) {
			expect(route.is_active_gateway).toBe(false);
			expect(route.routable).toBe(false);
			expect(route.capabilities).toEqual(expect.arrayContaining([
				expect.objectContaining({
					capability_id: "music.generate",
					status: "coming_soon",
				}),
			]));
		}
	});
});
