import { getModels } from "./api";

jest.mock("expo-constants", () => ({
  expoConfig: { extra: { phaseoOrigin: "https://phaseo.test" } }
}));

describe("getModels", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { model_id: "openai/gpt-5.6-sol", name: "GPT 5.6 Sol", organisation_name: "OpenAI" },
          { model_id: "anthropic/claude", name: "Claude", organisation: { name: "Anthropic" } }
        ]
      })
    });
  });

  it.each(["openai/gpt-5.6-sol", "OpenAI", "gpt 5.6"])(
    "searches model IDs, creators, and names for %s",
    async query => {
      await expect(getModels(query)).resolves.toEqual([
        expect.objectContaining({ id: "openai/gpt-5.6-sol" })
      ]);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=2000"),
        expect.any(Object)
      );
    }
  );
});
