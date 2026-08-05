import { canNotifyRelease, releaseStatuses } from "./releaseStatus";

describe("release categorisation", () => {
  it("keeps all product states distinct", () => expect(new Set(releaseStatuses).size).toBe(6));
  it("does not notify rumours by default", () => expect(canNotifyRelease("rumoured")).toBe(false));
  it("allows explicit rumour tracking", () => expect(canNotifyRelease("rumoured", true)).toBe(true));
});
