import "server-only";

import { Pool } from "pg";

import { betterAuthConnectionConfig, planetScaleConnectionConfig } from "./planetscaleConfig";

export { planetScaleConnectionConfig } from "./planetscaleConfig";

type DatabaseGlobal = typeof globalThis & {
	phaseoPlanetScalePool?: Pool;
	phaseoBetterAuthPool?: Pool;
};

export function getPlanetScalePool(): Pool {
	const databaseGlobal = globalThis as DatabaseGlobal;
	if (!databaseGlobal.phaseoPlanetScalePool) {
		databaseGlobal.phaseoPlanetScalePool = new Pool(planetScaleConnectionConfig());
	}
	return databaseGlobal.phaseoPlanetScalePool;
}

export function getBetterAuthPool(): Pool {
	const databaseGlobal = globalThis as DatabaseGlobal;
	if (!databaseGlobal.phaseoBetterAuthPool) {
		databaseGlobal.phaseoBetterAuthPool = new Pool(betterAuthConnectionConfig());
	}
	return databaseGlobal.phaseoBetterAuthPool;
}
