import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteResendContact } from "./resendContacts";

const removeContact = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
	Resend: class MockResend {
		contacts = { remove: removeContact };
	},
}));

describe("Resend contact cleanup", () => {
	beforeEach(() => {
		removeContact.mockReset();
		removeContact.mockResolvedValue({ data: { deleted: true }, error: null });
	});

	it("deletes the normalized contact before account removal", async () => {
		await deleteResendContact({ ENV: "production", RESEND_API_KEY: "re_test" }, " User@Example.com ");
		expect(removeContact).toHaveBeenCalledWith({ email: "user@example.com" });
	});

	it("treats an already absent contact as deleted", async () => {
		removeContact.mockResolvedValue({
			data: null,
			error: { name: "not_found", message: "Contact not found", statusCode: 404 },
		});
		await expect(deleteResendContact(
			{ ENV: "production", RESEND_API_KEY: "re_test" },
			"user@example.com",
		)).resolves.toBeUndefined();
	});

	it("does not acknowledge production cleanup without a configured key", async () => {
		await expect(deleteResendContact(
			{ ENV: "production" },
			"user@example.com",
		)).rejects.toThrow("missing_resend_api_key");
	});
});
