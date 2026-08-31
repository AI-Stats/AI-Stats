import type { AuthMessages } from "./default-messages";

export type MessageOverlay<T> = T extends string
	? string
	: T extends Record<string, unknown>
		? { [Key in keyof T]?: MessageOverlay<T[Key]> }
		: never;

export type AuthMessageOverlay = MessageOverlay<AuthMessages>;

function isMessageObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function mergeMessages(
	base: AuthMessages,
	overlay: AuthMessageOverlay,
): AuthMessages {
	return mergeCatalogMessages(base, overlay);
}

/** Merge a locale overlay without mutating the source catalog. */
export function mergeCatalogMessages<T>(base: T, overlay: unknown): T {
	function mergeValue(baseValue: unknown, overlayValue: unknown): unknown {
		if (typeof overlayValue === "string") return overlayValue;
		if (!isMessageObject(baseValue) || !isMessageObject(overlayValue)) {
			return baseValue;
		}

		return Object.fromEntries(
			Object.entries(baseValue).map(([key, value]) => [
				key,
				mergeValue(value, overlayValue[key]),
			]),
		);
	}

	return mergeValue(base, overlay) as T;
}
