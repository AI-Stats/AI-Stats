import { getChatRequestErrorPresentation } from "./chatRequestErrorPresentation";

function error(status: number | null, errorCode: string | null = null) {
	return {
		status,
		errorCode,
		message: "Gateway detail",
		description: null,
		details: [],
	};
}

describe("getChatRequestErrorPresentation", () => {
	it.each([
		[402, "payment", "Please add credits to use this model"],
		[401, "authentication", "Please sign in again"],
		[400, "validation", "This request needs a change"],
		[403, "forbidden", "This request isn't allowed"],
		[404, "model-unavailable", "This model isn't available"],
		[408, "timeout", "The request timed out"],
		[409, "conflict", "The request couldn't be completed"],
		[429, "rate-limit", "This model is busy right now"],
		[503, "service", "The model is temporarily unavailable"],
	] as const)("maps HTTP %i to %s", (status, kind, title) => {
		const presentation = getChatRequestErrorPresentation(error(status));

		expect(presentation).toMatchObject({ kind, title });
	});

	it("recognizes streamed errors without an HTTP status", () => {
		expect(
			getChatRequestErrorPresentation(error(null, "RESOURCE_EXHAUSTED")),
		).toMatchObject({ kind: "rate-limit", canRetry: true });
		expect(
			getChatRequestErrorPresentation(error(null, "model_not_found")),
		).toMatchObject({ kind: "model-unavailable", canChooseModel: true });
	});

	it("does not present missing model pricing as a low balance", () => {
		expect(
			getChatRequestErrorPresentation(error(402, "pricing_not_configured")),
		).toMatchObject({
			kind: "model-unavailable",
			canChooseModel: true,
		});
	});

	it("keeps provider detail for validation errors", () => {
		const presentation = getChatRequestErrorPresentation({
			...error(422),
			description: "Temperature must be below 1.",
		});

		expect(presentation.description).toBe("Temperature must be below 1.");
	});
});
