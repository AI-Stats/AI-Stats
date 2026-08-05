import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { Env } from "@/env";
import { publicGamesRouter } from "./games";

const app = new Hono<{ Bindings: Env }>();
app.route("/games", publicGamesRouter);

describe("catalogue games preview boundary", () => {
  it("stays unavailable in production unless explicitly enabled", async () => {
    const response = await app.request(
      "https://phaseo.app/games/modele/today",
      {},
      {
        ENV: "production",
      }
    );
    expect(response.status).toBe(404);
  });

  it("rejects unknown game keys before accessing the catalogue", async () => {
    const response = await app.request(
      "https://phaseo.app/games/not-a-game/today",
      {},
      {
        ENV: "development",
      }
    );
    expect(response.status).toBe(404);
  });

  it("requires authentication before evaluating a reveal", async () => {
    const response = await app.request(
      "https://phaseo.app/games/timeline/check",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId: "puzzle-1", action: "reveal" }),
      },
      {
        ENV: "development",
      }
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });
});
