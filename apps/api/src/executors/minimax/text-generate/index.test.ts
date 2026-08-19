import { describe, expect, it } from "vitest";
import { minimaxErrorHttpStatus, readMinimaxBodyError } from "./index";

describe("MiniMax text errors", () => {
	it("recognizes MiniMax errors carried in an HTTP 200 body", () => {
		expect(readMinimaxBodyError({
			base_resp: { status_code: 1002, status_msg: "rate limit" },
		})).toEqual({ code: 1002, message: "rate limit" });
		expect(readMinimaxBodyError({
			base_resp: { status_code: 0, status_msg: "success" },
		})).toBeNull();
	});

	it("maps documented provider errors to meaningful HTTP classes", () => {
		expect(minimaxErrorHttpStatus(1002)).toBe(429);
		expect(minimaxErrorHttpStatus(1004)).toBe(401);
		expect(minimaxErrorHttpStatus(1008)).toBe(402);
		expect(minimaxErrorHttpStatus(1039)).toBe(400);
		expect(minimaxErrorHttpStatus(1000)).toBe(502);
	});
});
