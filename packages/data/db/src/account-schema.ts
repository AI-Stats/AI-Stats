import { appSchema, authSchema } from "./namespaces";
import { boolean, text, timestamp, uuid, pgTable } from "drizzle-orm/pg-core";

export const authUsers = authSchema.table("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean().notNull(),
	image: text(),
});

export const users = appSchema.table("users", {
	userId: uuid("user_id").primaryKey().notNull(),
	displayName: text("display_name"),
	defaultWorkspaceId: uuid("default_workspace_id"),
	onboardingCompletedAt: timestamp("onboarding_completed_at", {
		withTimezone: true,
		mode: "string",
	}),
	declaredCountryCode: text("declared_country_code"),
	countryDeclaredAt: timestamp("country_declared_at", {
		withTimezone: true,
		mode: "string",
	}),
});
