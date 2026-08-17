import "server-only";

import { Pool } from "pg";

import { planetScaleConnectionConfig } from "./planetscaleConfig";

export { planetScaleConnectionConfig } from "./planetscaleConfig";

type DatabaseGlobal = typeof globalThis & {
	phaseoPlanetScalePool?: Pool;
};

export function getPlanetScalePool(): Pool {
	const databaseGlobal = globalThis as DatabaseGlobal;
	if (!databaseGlobal.phaseoPlanetScalePool) {
		databaseGlobal.phaseoPlanetScalePool = new Pool(planetScaleConnectionConfig());
	}
	return databaseGlobal.phaseoPlanetScalePool;
}
