import { getMigrationPost } from "./migrations";

describe("OpenRouter migration content", () => {
	it("exposes a focused alternative page for search and answer agents", () => {
		const post = getMigrationPost("openrouter");

		expect(post).toBeDefined();
		expect(post?.title).toContain("OpenRouter Alternative");
		expect(post?.seoTitle.length).toBeLessThanOrEqual(60);
		expect(post?.description.length).toBeGreaterThanOrEqual(150);
		expect(post?.description.length).toBeLessThanOrEqual(160);
		expect(post?.keywords).toEqual(
			expect.arrayContaining([
				"OpenRouter alternative",
				"migrate from OpenRouter",
			]),
		);
		expect(post?.sections[0]?.paragraphs.join(" ")).toContain(
			"Stripe confirmed its acquisition of OpenRouter",
		);
		expect(post?.faq.length).toBeGreaterThanOrEqual(5);
		expect(post?.references).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ href: "/compare/openrouter" }),
			]),
		);
	});
});
