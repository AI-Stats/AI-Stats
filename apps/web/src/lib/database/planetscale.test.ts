import { planetScaleConnectionConfig } from "./planetscaleConfig";

describe("planetScaleConnectionConfig", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
		process.env.PLANETSCALE_DATABASE_URL =
			"postgresql://user:password@example.pg.psdb.cloud:5432/postgres?sslmode=verify-full&sslrootcert=system&sslnegotiation=direct";
	});

	afterAll(() => {
		process.env = originalEnv;
	});

	it("uses PgBouncer and Node TLS verification by default", () => {
		const config = planetScaleConnectionConfig();
		const url = new URL(config.connectionString!);

		expect(url.port).toBe("6432");
		expect(url.searchParams.has("sslmode")).toBe(false);
		expect(url.searchParams.has("sslrootcert")).toBe(false);
		expect(url.searchParams.has("sslnegotiation")).toBe(false);
		expect(config.ssl).toEqual({ rejectUnauthorized: true });
		expect(config.max).toBe(1);
		expect(config.idleTimeoutMillis).toBe(5_000);
		expect(config.allowExitOnIdle).toBe(true);
	});

	it("supports direct connections and bounded pool overrides", () => {
		process.env.PLANETSCALE_USE_PGBOUNCER = "false";
		process.env.PLANETSCALE_POOL_MAX = "3";

		const config = planetScaleConnectionConfig();
		const url = new URL(config.connectionString!);

		expect(url.port).toBe("5432");
		expect(config.max).toBe(3);
	});

	it("fails closed when the explicit PlanetScale URL is absent", () => {
		delete process.env.PLANETSCALE_DATABASE_URL;
		expect(() => planetScaleConnectionConfig()).toThrow(
			"PLANETSCALE_DATABASE_URL is required",
		);
	});
});
