import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogueGamesEnabled } from "./featureFlag";

describe("catalogue games feature gate", () => {
  afterEach(() => vi.restoreAllMocks());

  it("checks the Statsig preview gate with the staging tier", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ value: true }), { status: 200 })
    );

    await expect(
      catalogueGamesEnabled({ ENV: "preview", STATSIG_SERVER_KEY: "secret" })
    ).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.statsig.com/v1/check_gate",
      expect.objectContaining({
        body: expect.stringContaining('"tier":"staging"'),
      })
    );
  });

  it("fails closed outside local development when Statsig is unavailable", async () => {
    await expect(catalogueGamesEnabled({ ENV: "production" })).resolves.toBe(false);
    await expect(catalogueGamesEnabled({ ENV: "staging" })).resolves.toBe(false);
  });

  it("keeps local development usable without a Statsig secret", async () => {
    await expect(catalogueGamesEnabled({ ENV: "development" })).resolves.toBe(true);
  });
});
