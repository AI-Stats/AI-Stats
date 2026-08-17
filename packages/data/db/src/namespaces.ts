import { pgSchema } from "drizzle-orm/pg-core";

export const authSchema = pgSchema("auth");
export const appSchema = pgSchema("app");
export const billingSchema = pgSchema("billing");
export const catalogSchema = pgSchema("catalog");
export const gatewaySchema = pgSchema("gateway");
export const observabilitySchema = pgSchema("observability");
export const contentSchema = pgSchema("content");
export const internalSchema = pgSchema("internal");

export const databaseSchemas = {
	auth: authSchema,
	app: appSchema,
	billing: billingSchema,
	catalog: catalogSchema,
	gateway: gatewaySchema,
	observability: observabilitySchema,
	content: contentSchema,
	internal: internalSchema,
} as const;
