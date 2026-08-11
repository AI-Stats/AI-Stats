import { beginOAuthAttempt } from "./oauthPending";

describe("OAuth pending state", () => {
	it("accepts the first provider and blocks duplicate attempts", () => {
		const first = beginOAuthAttempt(null, "google");
		expect(first).toEqual({ accepted: true, pendingProvider: "google" });

		expect(beginOAuthAttempt(first.pendingProvider, "github")).toEqual({
			accepted: false,
			pendingProvider: "google",
		});
	});

	it("allows a new attempt after pending state is cleared", () => {
		expect(beginOAuthAttempt(null, "gitlab")).toEqual({
			accepted: true,
			pendingProvider: "gitlab",
		});
	});
});
