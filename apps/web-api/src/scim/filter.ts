import { ScimProtocolError } from "./errors";

export type ScimFilterCondition = {
	attribute: string;
	operator: "eq";
	value: string;
};
export type ScimFilter = { conditions: ScimFilterCondition[] };

const CONDITION_PATTERN = /([A-Za-z][A-Za-z0-9._:-]*)\s+(eq)\s+"((?:[^"\\]|\\.)*)"/iy;

export function parseScimFilter(input: string | undefined): ScimFilter | null {
	if (!input?.trim()) return null;
	if (input.length > 1_024) throw new ScimProtocolError(400, "The filter is too long.", "invalidFilter");
	const source = input.trim(); const conditions: ScimFilterCondition[] = []; let offset = 0;
	while (offset < source.length) {
		CONDITION_PATTERN.lastIndex = offset; const match = CONDITION_PATTERN.exec(source);
		if (!match) throw new ScimProtocolError(400, "The filter syntax or operator is not supported.", "invalidFilter");
		let value: string;
		try { value = JSON.parse(`"${match[3]}"`) as string; }
		catch { throw new ScimProtocolError(400, "The filter contains an invalid string value.", "invalidFilter"); }
		conditions.push({ attribute: match[1], operator: "eq", value });
		if (conditions.length > 5) throw new ScimProtocolError(400, "The filter has too many conditions.", "tooMany");
		offset = CONDITION_PATTERN.lastIndex;
		if (offset === source.length) break;
		const separator = /^\s+and\s+/i.exec(source.slice(offset));
		if (!separator) throw new ScimProtocolError(400, "Only the and logical operator is supported.", "invalidFilter");
		offset += separator[0].length;
	}
	return { conditions };
}

export function parsePagination(query: { startIndex?: string; count?: string }, maxResults = 100) {
	const startIndex = query.startIndex === undefined ? 1 : Number(query.startIndex);
	const requestedCount = query.count === undefined ? maxResults : Number(query.count);
	if (!Number.isSafeInteger(startIndex) || startIndex < 1) throw new ScimProtocolError(400, "startIndex must be a positive integer.", "invalidValue");
	if (!Number.isSafeInteger(requestedCount) || requestedCount < 0) throw new ScimProtocolError(400, "count must be a non-negative integer.", "invalidValue");
	return { startIndex, count: Math.min(requestedCount, maxResults) };
}
