import { resolveSecureOrigin } from "./origins";

describe("resolveSecureOrigin", () => {
  it("normalizes secure origins", () => {
    expect(resolveSecureOrigin("https://preview.phaseo.app/path", "https://phaseo.app"))
      .toBe("https://preview.phaseo.app");
  });

  it("rejects insecure remote origins", () => {
    expect(() => resolveSecureOrigin("http://example.com", "https://phaseo.app"))
      .toThrow("Insecure mobile origin");
  });
});
