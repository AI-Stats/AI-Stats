import englishUsAuthOverrides from "../../messages/en-US/auth.overrides.json";
import { englishAuthMessages } from "./default-messages";
import { mergeMessages } from "./message-overlays";

describe("mergeMessages", () => {
	it("applies a sparse regional overlay without mutating its fallback", () => {
		const messages = mergeMessages(englishAuthMessages, englishUsAuthOverrides);

		expect(messages.Auth.signIn.passkeyCancelled).toBe(
			"Passkey sign-in canceled.",
		);
		expect(messages.Auth.error.ssoNotConfigured).toContain("organization");
		expect(messages.Auth.signIn.heading).toBe(
			englishAuthMessages.Auth.signIn.heading,
		);
		expect(englishAuthMessages.Auth.signIn.passkeyCancelled).toBe(
			"Passkey sign-in cancelled.",
		);
	});
});
