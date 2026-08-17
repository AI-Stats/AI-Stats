/* eslint-disable no-console -- cutover CLI emits an operator-readable plan */
import { Pool, type PoolConfig } from "pg";

type Sequence = {
	increment_by: string;
	last_value: string | null;
	schema_name: string;
	sequence_name: string;
};

function required(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required`);
	return value;
}

function config(connectionString: string, rejectUnauthorized: boolean): PoolConfig {
	const url = new URL(connectionString);
	url.searchParams.delete("sslmode");
	url.searchParams.delete("sslrootcert");
	url.searchParams.delete("sslnegotiation");
	return { allowExitOnIdle: true, connectionString: url.toString(), max: 1, ssl: { rejectUnauthorized } };
}

function qualified(schema: string, sequence: string): string {
	return `"${schema.replaceAll('"', '""')}"."${sequence.replaceAll('"', '""')}"`;
}

async function main() {
	const buffer = BigInt(process.env.PLANETSCALE_SEQUENCE_BUFFER ?? "10000");
	if (buffer < BigInt(1)) throw new Error("PLANETSCALE_SEQUENCE_BUFFER must be positive");
	const apply = process.argv.includes("--apply");
	const source = new Pool(config(required("SUPABASE_MIGRATION_DATABASE_URL"), false));
	const target = new Pool(config(required("PLANETSCALE_MIGRATION_DATABASE_URL"), true));
	try {
		const sourceSequences = await source.query<Sequence>(`
			select schemaname as schema_name, sequencename as sequence_name,
				last_value::text, increment_by::text
			from pg_catalog.pg_sequences
			where schemaname = 'public'
			order by schemaname, sequencename
		`);
		const client = await target.connect();
		try {
			await client.query("begin");
			const planned = [];
			for (const sequence of sourceSequences.rows) {
				if (sequence.last_value === null) continue;
				const targetValue = BigInt(sequence.last_value) + buffer;
				const name = qualified(sequence.schema_name, sequence.sequence_name);
				await client.query("select setval($1::regclass, $2::bigint, true)", [name, targetValue.toString()]);
				planned.push({ sequence: `${sequence.schema_name}.${sequence.sequence_name}`, source: sequence.last_value, target: targetValue.toString() });
			}
			if (apply) await client.query("commit");
			else await client.query("rollback");
			console.log(JSON.stringify({ applied: apply, buffer: buffer.toString(), sequences: planned }, null, 2));
		} catch (error) {
			await client.query("rollback");
			throw error;
		} finally {
			client.release();
		}
	} finally {
		await Promise.all([source.end(), target.end()]);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
