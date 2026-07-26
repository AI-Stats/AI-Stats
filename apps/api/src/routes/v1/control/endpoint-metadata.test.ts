import { describe, expect, it } from "vitest";
import { getEndpointMetadata, listEndpointMetadata } from "./endpoint-metadata";

describe("endpoint metadata", () => {
    it.each([
        ["chat/completions", "chat.completions", "/v1/chat/completions", "text"],
        ["image.generate", "images.generations", "/v1/images/generations", "images"],
        ["video.generate", "video.generation", "/v1/videos", "video"],
        ["audio.transcriptions", "audio.transcription", "/v1/audio/transcriptions", "audio"],
    ])("maps %s to its public endpoint", (alias, id, publicPath, collection) => {
        expect(getEndpointMetadata(alias)).toMatchObject({
            id,
            public_path: publicPath,
            collection,
        });
    });

    it("returns defensive copies", () => {
        const first = listEndpointMetadata();
        first[0].aliases.push("mutated");
        expect(listEndpointMetadata()[0].aliases).not.toContain("mutated");
    });
});
