import type { FamilyCard } from "@/lib/fetchers/families/types";

function getCreatedAtTimestamp(family: FamilyCard) {
	if (!family.created_at) return 0;
	const timestamp = new Date(family.created_at).getTime();
	return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function sortFamiliesByRecentAddition(families: FamilyCard[]) {
	return families.toSorted((left, right) => {
		const timestampDifference =
			getCreatedAtTimestamp(right) - getCreatedAtTimestamp(left);
		if (timestampDifference !== 0) return timestampDifference;
		return left.family_name.localeCompare(right.family_name);
	});
}
