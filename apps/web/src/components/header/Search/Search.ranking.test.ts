import { compareSearchCategories } from "./Search.ranking";

describe("compareSearchCategories", () => {
	it("ranks an exact organisation match above model keyword matches", () => {
		const categories = [
			{ name: "models", score: 400 },
			{ name: "organisations", score: 1000 },
		].sort(compareSearchCategories);

		expect(categories.map(({ name }) => name)).toEqual([
			"organisations",
			"models",
		]);
	});

	it("preserves category order when relevance scores are equal", () => {
		const categories = [
			{ name: "apiProviders", score: 800 },
			{ name: "models", score: 800 },
		].sort(compareSearchCategories);

		expect(categories.map(({ name }) => name)).toEqual([
			"apiProviders",
			"models",
		]);
	});

	it("applies relevance equally to every category", () => {
		const categories = [
			{ name: "workspaces", score: 1000 },
			{ name: "models", score: 400 },
		].sort(compareSearchCategories);

		expect(categories.map(({ name }) => name)).toEqual([
			"workspaces",
			"models",
		]);
	});
});
