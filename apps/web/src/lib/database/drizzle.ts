import "server-only";

import { createNodeDatabaseForSchema } from "@phaseo/db/node-core";
import * as billingSchema from "@phaseo/db/billing-schema";
import * as accountSchema from "@phaseo/db/account-schema";
import * as presetSchema from "@phaseo/db/preset-schema";
import * as oauthSchema from "@phaseo/db/oauth-schema";

import { getPlanetScalePool } from "./planetscale";

const schema = { ...accountSchema, ...billingSchema, ...oauthSchema, ...presetSchema };

let database: ReturnType<typeof createNodeDatabaseForSchema<typeof schema>> | undefined;

export function getDatabase() {
	database ??= createNodeDatabaseForSchema(getPlanetScalePool(), schema);
	return database;
}
