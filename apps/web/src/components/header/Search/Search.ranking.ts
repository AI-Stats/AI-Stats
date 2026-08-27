type RankedSearchCategory = {
	score: number;
};

export function compareSearchCategories(
	left: RankedSearchCategory,
	right: RankedSearchCategory,
): number {
	return right.score - left.score;
}
