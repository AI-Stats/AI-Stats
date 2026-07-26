import type { RawEvent } from "@/lib/fetchers/models/timelineTypes";

type ModelLinkLike = {
	url?: string | null;
	platform?: string | null;
	kind?: string | null;
};

type LicenseModel = {
	license_url?: string | null;
	model_links?: ModelLinkLike[] | null;
};

export type LineageModelLink = {
	modelId: string;
	modelName: string;
};

function normalizeLinkKind(link: ModelLinkLike) {
	return (link.kind ?? link.platform ?? "")
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, "_");
}

export function isLicenseModelLink(link: ModelLinkLike) {
	const kind = normalizeLinkKind(link);
	return kind === "license" || kind === "licence" || kind === "license_text" || kind === "licence_text";
}

export function getGenericModelLinks<T extends ModelLinkLike>(links: T[]) {
	return links.filter((link) => !isLicenseModelLink(link));
}

export function getModelLicenseUrl(model: LicenseModel) {
	const directUrl = model.license_url?.trim();
	if (directUrl) return directUrl;

	const licenseLink = model.model_links?.find(
		(link) => isLicenseModelLink(link) && Boolean(link.url?.trim()),
	);
	return licenseLink?.url?.trim() || null;
}

export function getModelLineageLinks(
	events: RawEvent[] | null | undefined,
	previousModelId?: string | null,
): { previous: LineageModelLink | null; next: LineageModelLink | null } {
	const previousEvent = events?.find(
		(event) => event.eventType === "PreviousModel" && event.modelId,
	);
	const previousId = previousEvent?.modelId ?? previousModelId?.trim() ?? "";
	const previous = previousId
		? {
				modelId: previousId,
				modelName: previousEvent?.modelName?.trim() || previousId,
			}
		: null;

	const nextEvent = events
		?.filter((event) => event.eventType === "FutureModel" && event.modelId)
		.toSorted((left, right) => left.date.localeCompare(right.date))[0];
	const next = nextEvent?.modelId
		? {
				modelId: nextEvent.modelId,
				modelName: nextEvent.modelName?.trim() || nextEvent.modelId,
			}
		: null;

	return { previous, next };
}
