/* eslint-disable no-console -- migration CLI emits an operator-readable report */
import { Pool } from "pg";

function config() {
	const value = process.env.PLANETSCALE_MIGRATION_DATABASE_URL?.trim();
	if (!value) throw new Error("PLANETSCALE_MIGRATION_DATABASE_URL is required");
	const url = new URL(value);
	url.searchParams.delete("sslmode");
	url.searchParams.delete("sslrootcert");
	url.searchParams.delete("sslnegotiation");
	return {
		allowExitOnIdle: true,
		connectionString: url.toString(),
		connectionTimeoutMillis: 10_000,
		max: 1,
		ssl: { rejectUnauthorized: true },
	};
}

async function main() {
	const pool = new Pool(config());
	try {
		const [states, status] = await Promise.all([
			pool.query<{ state: string; relations: number }>(`
				select case srsubstate
					when 'i' then 'queued'
					when 'd' then 'copying'
					when 's' then 'catching_up'
					when 'r' then 'ready'
					else srsubstate::text
				end as state, count(*)::int as relations
				from pg_subscription_rel
				group by srsubstate
				order by srsubstate
			`),
			pool.query<{
				enabled: boolean;
				subname: string;
				received_lsn: string | null;
				latest_end_lsn: string | null;
				last_msg_receipt_time: Date | null;
			}>(`
				select subscription.subname, subscription.subenabled as enabled,
					status.received_lsn::text, status.latest_end_lsn::text, status.last_msg_receipt_time
				from pg_subscription subscription
				left join pg_stat_subscription status on status.subid = subscription.oid
				where subscription.subname = 'phaseo_from_supabase'
				order by status.pid nulls last
			`),
		]);
		const ready = states.rows.length === 1 && states.rows[0]?.state === "ready"
			&& status.rows.length === 1 && status.rows[0]?.enabled === true;
		console.log(JSON.stringify({ ready, states: states.rows, workers: status.rows }, null, 2));
		if (!ready) process.exitCode = 2;
	} finally {
		await pool.end();
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
