import { describe, expect, it } from "vitest";
import { usdToNanos } from "./notifications";
import { notificationTargetPreview, validateNotificationTarget } from "./notification-target";

describe("notification management validation", () => {
	it("normalizes email destinations and redacts their preview", () => {
		const target = validateNotificationTarget("email", "Ops@Example.com");
		expect(target).toBe('["ops@example.com"]');
		expect(notificationTargetPreview("email", target)).toBe("op•••@example.com");
	});

	it("rejects private webhook destinations", () => {
		expect(() => validateNotificationTarget("custom_webhook", "https://127.0.0.1/hook")).toThrow("private network");
	});

	it("converts two-decimal thresholds to nanos", () => {
		expect(usdToNanos("12.34")).toBe(12_340_000_000);
		expect(usdToNanos("12.345")).toBeNull();
	});
});
