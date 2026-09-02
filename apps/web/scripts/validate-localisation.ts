import { assertValidCatalogs } from "../src/i18n/validation";
import { appleAppStoreLocales } from "../src/i18n/apple-locales";
import {
	catalogLocales,
	getLocaleDefinition,
} from "../src/i18n/routing";

assertValidCatalogs();
const appleCatalogCount = catalogLocales.filter(
	(locale) => getLocaleDefinition(locale).role !== "pseudo",
).length;
process.stdout.write(
	`Localisation catalogs valid: ${catalogLocales.join(", ")}\n` +
		`Apple App Store matrix coverage: ${appleCatalogCount}/${appleAppStoreLocales.length} locales\n`,
);
