import englishSettingsMessages from "../../messages/en-GB/settings.json";
import germanSettingsMessages from "../../messages/de-DE/settings.json";
import type { PublicLocale } from "./routing";

export type SourceSettingsMessages = typeof englishSettingsMessages;
export type SettingsMessages = SourceSettingsMessages;
export type SettingsSidebarItemKey = keyof SourceSettingsMessages["sidebar"]["items"];
export type SettingsSidebarHeadingKey = keyof SourceSettingsMessages["sidebar"]["headings"];

const settingsCatalogs: Partial<Record<PublicLocale, SettingsMessages>> = {
	"en-GB": englishSettingsMessages,
	"de-DE": germanSettingsMessages,
};

export function getSettingsMessages(locale: PublicLocale): SettingsMessages {
	return settingsCatalogs[locale] ?? englishSettingsMessages;
}

export function getSettingsSidebarItemLabel(
	locale: PublicLocale,
	key: SettingsSidebarItemKey,
): string {
	return getSettingsMessages(locale).sidebar.items[key];
}

export function getSettingsSidebarHeading(
	locale: PublicLocale,
	key: SettingsSidebarHeadingKey,
): string {
	return getSettingsMessages(locale).sidebar.headings[key];
}
