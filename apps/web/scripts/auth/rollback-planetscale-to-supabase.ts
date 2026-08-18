/* eslint-disable no-console -- this is an operator-only migration CLI */
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const SOURCE_SCHEMAS = ["app", "billing", "catalog", "content", "gateway", "internal", "observability"] as const;
const EXPECTED_SOURCE = "phaseo/phaseo/main";
const EXPECTED_TARGET = "xansbgjaduxypzsmjwct";
const BATCH_SIZE = 250;

type QueryClient = postgres.Sql | postgres.TransactionSql;
type DatabaseRow = Record<string, unknown>;

type Column = {
	dataType: string;
	name: string;
	position: number;
	udtName: string;
};

type Table = {
	columns: Column[];
	keyColumns: string[];
	name: string;
	partitioned: boolean;
	sourceSchema: string;
};

type TablePlan = Table & {
	changed: number;
	deleted: number;
	sourceCount: number;
	targetCount: number;
};

type TableRow = {
	column_name: string;
	data_type: string;
	is_partitioned: boolean;
	ordinal_position: number;
	table_name: string;
	table_schema: string;
	udt_name: string;
};

type KeyRow = {
	columns: string[];
	is_primary: boolean;
	table_name: string;
	table_schema: string;
};

type DigestRow = {
	count: string;
	digest: string;
};

type HashRow = DatabaseRow & { row_hash: string };

function requiredEnvironment(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required`);
	return value;
}

function argument(name: string): string | undefined {
	const prefix = `--${name}=`;
	return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function quoteIdentifier(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}

function qualified(schema: string, table: string): string {
	return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

function connectionString(name: string, expectedHostSuffix: string): string {
	const url = new URL(requiredEnvironment(name));
	if (!url.hostname.endsWith(expectedHostSuffix)) {
		throw new Error(`${name} does not point to an expected ${expectedHostSuffix} host`);
	}
	url.searchParams.delete("sslmode");
	url.searchParams.delete("sslrootcert");
	url.searchParams.delete("sslnegotiation");
	return url.toString();
}

function database(url: string, rejectUnauthorized: boolean): postgres.Sql {
	return postgres(url, {
		idle_timeout: 10,
		max: 1,
		prepare: false,
		ssl: { rejectUnauthorized },
	});
}

function assertApplyApproval(): void {
	if (!process.argv.includes("--apply")) return;
	if (argument("confirm-source") !== EXPECTED_SOURCE) {
		throw new Error(`Apply requires --confirm-source=${EXPECTED_SOURCE}`);
	}
	if (argument("confirm-target") !== EXPECTED_TARGET) {
		throw new Error(`Apply requires --confirm-target=${EXPECTED_TARGET}`);
	}
	if (!process.argv.includes("--freeze-confirmed")) {
		throw new Error("Apply requires --freeze-confirmed after all production writers and jobs are stopped");
	}
	if (!process.argv.includes("--reconcile-deletes")) {
		throw new Error("Apply requires --reconcile-deletes so Supabase exactly matches the frozen PlanetScale source");
	}
}

async function loadTableRows(sql: QueryClient, schemas: readonly string[]): Promise<TableRow[]> {
	return sql.unsafe<TableRow[]>(`
		select c.table_schema, c.table_name, c.column_name, c.data_type, c.udt_name,
			c.ordinal_position,
			(coalesce(pc.relkind = 'p', false)) as is_partitioned
		from information_schema.columns c
		join pg_catalog.pg_namespace pn on pn.nspname = c.table_schema
		join pg_catalog.pg_class pc on pc.relnamespace = pn.oid and pc.relname = c.table_name
		where c.table_schema = any($1::text[])
			and pc.relkind in ('r', 'p')
		order by c.table_schema, c.table_name, c.ordinal_position
	`, [schemas]);
}

async function loadKeyRows(sql: QueryClient, schemas: readonly string[]): Promise<KeyRow[]> {
	return sql.unsafe<KeyRow[]>(`
		select n.nspname as table_schema, c.relname as table_name,
			i.indisprimary as is_primary,
			array_agg(a.attname order by k.ordinality)::text[] as columns
		from pg_catalog.pg_index i
		join pg_catalog.pg_class c on c.oid = i.indrelid
		join pg_catalog.pg_namespace n on n.oid = c.relnamespace
		cross join lateral unnest(i.indkey) with ordinality k(attnum, ordinality)
		join pg_catalog.pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
		where n.nspname = any($1::text[])
			and i.indisunique
			and i.indpred is null
			and i.indexprs is null
		group by n.nspname, c.relname, i.indexrelid, i.indisprimary
		order by n.nspname, c.relname, i.indisprimary desc, cardinality(array_agg(a.attname))
	`, [schemas]);
}

function groupTables(rows: TableRow[], keys: KeyRow[]): Map<string, Table> {
	const keyByTable = new Map<string, string[]>();
	for (const key of keys) {
		const id = `${key.table_schema}.${key.table_name}`;
		if (!keyByTable.has(id) || key.is_primary) keyByTable.set(id, key.columns);
	}

	const tables = new Map<string, Table>();
	for (const row of rows) {
		const id = `${row.table_schema}.${row.table_name}`;
		const existing = tables.get(id) ?? {
			columns: [],
			keyColumns: keyByTable.get(id) ?? [],
			name: row.table_name,
			partitioned: row.is_partitioned,
			sourceSchema: row.table_schema,
		};
		existing.columns.push({ dataType: row.data_type, name: row.column_name, position: row.ordinal_position, udtName: row.udt_name });
		tables.set(id, existing);
	}
	return tables;
}

function discoverSharedTables(sourceTables: Map<string, Table>, targetTables: Map<string, Table>): Table[] {
	const targetByName = new Map([...targetTables.values()].map((table) => [table.name, table]));
	const shared: Table[] = [];
	for (const source of sourceTables.values()) {
		const target = targetByName.get(source.name);
		if (!target || source.partitioned) continue;
		if (source.keyColumns.length === 0) throw new Error(`${source.sourceSchema}.${source.name} has no safe unique key`);
		const sourceSignature = source.columns.map(({ name, dataType, udtName }) => `${name}:${dataType}:${udtName}`).join("|");
		const targetSignature = target.columns.map(({ name, dataType, udtName }) => `${name}:${dataType}:${udtName}`).join("|");
		if (sourceSignature !== targetSignature) throw new Error(`Schema drift blocks ${source.sourceSchema}.${source.name}`);
		shared.push(source);
	}
	return shared.sort((left, right) => `${left.sourceSchema}.${left.name}`.localeCompare(`${right.sourceSchema}.${right.name}`));
}

function keyOrder(table: Table): string {
	return table.keyColumns.map((column) => `t.${quoteIdentifier(column)}`).join(", ");
}

function keyProjection(table: Table): string {
	return table.keyColumns.map((column) => `t.${quoteIdentifier(column)}`).join(", ");
}

function keyValue(row: DatabaseRow, table: Table): string {
	return JSON.stringify(table.keyColumns.map((column) => row[column]));
}

async function digest(sql: QueryClient, schema: string, table: Table): Promise<DigestRow> {
	const rows = await sql.unsafe<DigestRow[]>(`
		select count(*)::text as count,
			md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by ${keyOrder(table)}), '')) as digest
		from ${qualified(schema, table.name)} t
	`);
	const result = rows[0];
	if (!result) throw new Error(`Could not digest ${schema}.${table.name}`);
	return result;
}

async function rowHashes(sql: QueryClient, schema: string, table: Table): Promise<HashRow[]> {
	return sql.unsafe<HashRow[]>(`
		select ${keyProjection(table)}, md5(row_to_json(t)::text) as row_hash
		from ${qualified(schema, table.name)} t
		order by ${keyOrder(table)}
	`);
}

async function planTable(source: QueryClient, target: QueryClient, table: Table): Promise<TablePlan> {
	const [sourceDigest, targetDigest] = await Promise.all([
		digest(source, table.sourceSchema, table),
		digest(target, "public", table),
	]);
	if (sourceDigest.count === targetDigest.count && sourceDigest.digest === targetDigest.digest) {
		return { ...table, changed: 0, deleted: 0, sourceCount: Number(sourceDigest.count), targetCount: Number(targetDigest.count) };
	}

	const [sourceHashes, targetHashes] = await Promise.all([
		rowHashes(source, table.sourceSchema, table),
		rowHashes(target, "public", table),
	]);
	const sourceByKey = new Map(sourceHashes.map((row) => [keyValue(row, table), row.row_hash]));
	const targetByKey = new Map(targetHashes.map((row) => [keyValue(row, table), row.row_hash]));
	let changed = 0;
	let deleted = 0;
	for (const [key, hash] of sourceByKey) if (targetByKey.get(key) !== hash) changed += 1;
	for (const key of targetByKey.keys()) if (!sourceByKey.has(key)) deleted += 1;
	return { ...table, changed, deleted, sourceCount: sourceHashes.length, targetCount: targetHashes.length };
}

async function loadForeignKeys(sql: QueryClient, tableNames: string[]): Promise<Array<{ child: string; parent: string }>> {
	return sql.unsafe<Array<{ child: string; parent: string }>>(`
		select child.relname as child, parent.relname as parent
		from pg_catalog.pg_constraint fk
		join pg_catalog.pg_class child on child.oid = fk.conrelid
		join pg_catalog.pg_namespace child_ns on child_ns.oid = child.relnamespace
		join pg_catalog.pg_class parent on parent.oid = fk.confrelid
		join pg_catalog.pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
		where fk.contype = 'f'
			and child_ns.nspname = 'public'
			and parent_ns.nspname = 'public'
			and child.relname = any($1::text[])
			and parent.relname = any($1::text[])
	`, [tableNames]);
}

function dependencyOrder(plans: TablePlan[], foreignKeys: Array<{ child: string; parent: string }>): TablePlan[] {
	const byName = new Map(plans.map((plan) => [plan.name, plan]));
	const dependencies = new Map(plans.map((plan) => [plan.name, new Set<string>()]));
	for (const { child, parent } of foreignKeys) {
		if (child === parent) continue;
		// Supabase has a deliberate non-deferrable users/workspaces cycle. Users
		// are inserted with a null default_workspace_id, then completed after
		// workspaces exist.
		if (child === "users" && parent === "workspaces") continue;
		if (byName.has(parent)) dependencies.get(child)?.add(parent);
	}
	const ordered: TablePlan[] = [];
	while (ordered.length < plans.length) {
		const ready = [...dependencies].find(([, parents]) => [...parents].every((parent) => ordered.some((item) => item.name === parent)));
		if (!ready) throw new Error(`Unresolved foreign-key cycle: ${[...dependencies.keys()].join(", ")}`);
		const [name] = ready;
		ordered.push(byName.get(name)!);
		dependencies.delete(name);
	}
	return ordered;
}

async function sourceRows(sql: QueryClient, table: Table): Promise<DatabaseRow[]> {
	return sql.unsafe<DatabaseRow[]>(`select * from ${qualified(table.sourceSchema, table.name)} order by ${keyOrder(table)}`);
}

function placeholders(rowCount: number, columnCount: number): string {
	let position = 0;
	return Array.from({ length: rowCount }, () => `(${Array.from({ length: columnCount }, () => `$${++position}`).join(", ")})`).join(", ");
}

async function upsertRows(sql: QueryClient, table: Table, rows: DatabaseRow[]): Promise<void> {
	if (rows.length === 0) return;
	const columns = table.columns.map(({ name }) => name);
	const mutable = columns.filter((column) => !table.keyColumns.includes(column));
	for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
		const batch = rows.slice(offset, offset + BATCH_SIZE);
		const values = batch.flatMap((row) => columns.map((column) => row[column]));
		const conflict = table.keyColumns.map(quoteIdentifier).join(", ");
		const update = mutable.length > 0
			? `do update set ${mutable.map((column) => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`).join(", ")}`
			: "do nothing";
		await sql.unsafe(
			`insert into ${qualified("public", table.name)} (${columns.map(quoteIdentifier).join(", ")}) values ${placeholders(batch.length, columns.length)} on conflict (${conflict}) ${update}`,
			values as never[],
		);
	}
}

async function upsertRowsForDependencyOrder(sql: QueryClient, table: Table, rows: DatabaseRow[]): Promise<void> {
	if (table.name !== "users") return upsertRows(sql, table, rows);
	await upsertRows(sql, table, rows.map((row) => ({ ...row, default_workspace_id: null })));
}

async function deleteRows(sql: QueryClient, table: Table, rows: HashRow[]): Promise<void> {
	for (const row of rows) {
		const where = table.keyColumns.map((column, index) => `${quoteIdentifier(column)} is not distinct from $${index + 1}`).join(" and ");
		await sql.unsafe(`delete from ${qualified("public", table.name)} where ${where}`, table.keyColumns.map((column) => row[column]) as never[]);
	}
}

async function changedSourceRows(source: QueryClient, target: QueryClient, plan: TablePlan): Promise<DatabaseRow[]> {
	if (plan.changed === 0 && plan.deleted === 0) return [];
	const [rows, targetHashes] = await Promise.all([
		sourceRows(source, plan),
		rowHashes(target, "public", plan),
	]);
	const sourceByKey = new Map(rows.map((row) => [keyValue(row, plan), row]));
	const sourceHashes = await rowHashes(source, plan.sourceSchema, plan);
	const targetByKey = new Map(targetHashes.map((row) => [keyValue(row, plan), row.row_hash]));
	const changedKeys = new Set(sourceHashes.filter((row) => targetByKey.get(keyValue(row, plan)) !== row.row_hash).map((row) => keyValue(row, plan)));
	return [...sourceByKey].filter(([key]) => changedKeys.has(key)).map(([, row]) => row);
}

async function deletedTargetRows(source: QueryClient, target: QueryClient, plan: TablePlan): Promise<HashRow[]> {
	const [sourceHashes, targetHashes] = await Promise.all([
		rowHashes(source, plan.sourceSchema, plan),
		rowHashes(target, "public", plan),
	]);
	const sourceKeys = new Set(sourceHashes.map((row) => keyValue(row, plan)));
	return targetHashes.filter((row) => !sourceKeys.has(keyValue(row, plan)));
}

async function missingAuthUsers(source: QueryClient, target: QueryClient): Promise<Array<{
	appMetadata: Record<string, unknown>;
	email: string;
	emailVerified: boolean;
	hasPasskey: boolean;
	hasTwoFactor: boolean;
	id: string;
	name: string;
	providers: string[];
	userMetadata: Record<string, unknown>;
}>> {
	const sourceUsers = await source.unsafe<Array<DatabaseRow & { id: string }>>(`
		select u.id, u.email, u.name, u."emailVerified" as "emailVerified",
			u."appMetadata" as "appMetadata", u."userMetadata" as "userMetadata",
			exists (select 1 from auth.passkey p where p."userId" = u.id) as "hasPasskey",
			exists (select 1 from auth."twoFactor" f where f."userId" = u.id) as "hasTwoFactor",
			coalesce(array_agg(distinct a."providerId") filter (where a."providerId" is not null), '{}')::text[] as providers
		from auth."user" u left join auth.account a on a."userId" = u.id group by u.id
	`);
	const targetUsers = await target.unsafe<Array<{ id: string }>>(`select id::text from auth.users`);
	const targetIds = new Set(targetUsers.map(({ id }) => id));
	return sourceUsers.filter(({ id }) => !targetIds.has(id)) as Awaited<ReturnType<typeof missingAuthUsers>>;
}

async function createMissingAuthUsers(users: Awaited<ReturnType<typeof missingAuthUsers>>): Promise<void> {
	if (users.length === 0) return;
	for (const user of users) {
		if (user.providers.some((provider) => provider === "credential")) throw new Error(`Missing password user ${user.id} requires a separate reviewed migration`);
		if (user.hasPasskey || user.hasTwoFactor) throw new Error(`Missing user ${user.id} has credentials that require re-enrollment review`);
		if (user.providers.some((provider) => !["github", "google", "gitlab"].includes(provider))) throw new Error(`Missing user ${user.id} has an unsupported provider`);
	}
	const client = createClient(requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"), requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"), {
		auth: { autoRefreshToken: false, persistSession: false },
	});
	for (const user of users) {
		const safeAppMetadata = { ...(user.appMetadata ?? {}) };
		delete safeAppMetadata.provider;
		delete safeAppMetadata.providers;
		const { error } = await client.auth.admin.createUser({
			app_metadata: safeAppMetadata,
			email: user.email,
			email_confirm: user.emailVerified,
			id: user.id,
			user_metadata: { ...(user.userMetadata ?? {}), name: user.name },
		});
		if (error) throw new Error(`Could not create Supabase Auth user ${user.id}: ${error.message}`);
	}
}

async function main(): Promise<void> {
	assertApplyApproval();
	const apply = process.argv.includes("--apply");
	const source = database(connectionString("PLANETSCALE_MIGRATION_DATABASE_URL", ".pg.psdb.cloud"), true);
	// Supabase's shared pooler uses encrypted sslmode=require semantics. PlanetScale always verifies its certificate.
	const target = database(connectionString("SUPABASE_MIGRATION_DATABASE_URL", ".supabase.com"), false);
	try {
		const [sourceRowsMeta, sourceKeys, targetRowsMeta, targetKeys] = await Promise.all([
			loadTableRows(source, SOURCE_SCHEMAS),
			loadKeyRows(source, SOURCE_SCHEMAS),
			loadTableRows(target, ["public"]),
			loadKeyRows(target, ["public"]),
		]);
		const tables = discoverSharedTables(groupTables(sourceRowsMeta, sourceKeys), groupTables(targetRowsMeta, targetKeys));
		const authUsers = await missingAuthUsers(source, target);
		const plans: TablePlan[] = [];
		for (const table of tables) plans.push(await planTable(source, target, table));
		const changed = plans.filter((plan) => plan.changed > 0 || plan.deleted > 0);
		const report = {
			apply,
			auth: { missingUsers: authUsers.length, sessionsMigrated: false },
			changedTables: changed.map(({ sourceSchema, name, sourceCount, targetCount, changed: changedRows, deleted }) => ({ source: `${sourceSchema}.${name}`, target: `public.${name}`, sourceCount, targetCount, upserts: changedRows, deletes: deleted })),
			sharedTables: tables.length,
			totals: {
				deletes: changed.reduce((sum, table) => sum + table.deleted, 0),
				upserts: changed.reduce((sum, table) => sum + table.changed, 0),
			},
		};
		console.log(JSON.stringify(report, null, 2));
		if (!apply) return;

		await createMissingAuthUsers(authUsers);
		const foreignKeys = await loadForeignKeys(target, tables.map(({ name }) => name));
		const ordered = dependencyOrder(changed, foreignKeys);
		await target.begin("isolation level serializable", async (transaction) => {
			for (const plan of ordered) {
				await upsertRowsForDependencyOrder(transaction, plan, await changedSourceRows(source, transaction, plan));
			}
			const users = ordered.find((plan) => plan.name === "users");
			if (users) await upsertRows(transaction, users, await changedSourceRows(source, transaction, users));
			const deletedByTable = new Map<string, HashRow[]>();
			for (const plan of ordered) deletedByTable.set(plan.name, await deletedTargetRows(source, transaction, plan));
			for (const row of deletedByTable.get("users") ?? []) {
				await transaction.unsafe(`update public.users set default_workspace_id = null where user_id is not distinct from $1`, [row.user_id] as never[]);
			}
			for (const plan of [...ordered].reverse()) {
				await deleteRows(transaction, plan, deletedByTable.get(plan.name) ?? []);
			}
			for (const plan of ordered) {
				const verification = await planTable(source, transaction, plan);
				if (verification.changed !== 0 || verification.deleted !== 0) throw new Error(`Verification failed for public.${plan.name}`);
			}
		});
		console.log("PlanetScale to Supabase reconciliation committed and verified.");
	} finally {
		await Promise.all([source.end(), target.end()]);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
