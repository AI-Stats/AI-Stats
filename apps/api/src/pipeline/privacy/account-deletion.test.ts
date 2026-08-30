import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
	authUser: null as { id: string } | null,
	claimedJobs: [] as any[],
	updates: [] as any[],
	bindings: {} as Record<string, unknown>,
	kv: null as any,
}));

vi.mock("@/runtime/env", () => ({
	getBindings: () => runtime.bindings,
	getCache: () => runtime.kv,
	getSupabaseAdmin: () => ({
		auth: { admin: { getUserById: vi.fn(async () => ({ data: { user: runtime.authUser }, error: null })) } },
		rpc: vi.fn(async () => ({ data: runtime.claimedJobs, error: null })),
		from: () => ({
			update: (payload: unknown) => ({
				eq: vi.fn(async () => {
					runtime.updates.push(payload);
					return { error: null };
				}),
			}),
		}),
	}),
}));

import { purgeKvAccountData, purgeR2Prefix, runAccountDeletionPurgeJob } from "./account-deletion";

function r2Bucket(initial: Record<string, string[]>) {
	const objects = new Map(Object.entries(initial));
	return {
		list: vi.fn(async ({ prefix, limit }: { prefix: string; limit: number }) => {
			const keys = (objects.get(prefix) ?? []).slice(0, limit);
			return {
				objects: keys.map((key) => ({ key })),
				truncated: (objects.get(prefix) ?? []).length > keys.length,
			};
		}),
		delete: vi.fn(async (keys: string[]) => {
			for (const [prefix, values] of objects) {
				objects.set(prefix, values.filter((key) => !keys.includes(key)));
			}
		}),
	} as unknown as R2Bucket;
}

function kvNamespace(initial: string[]) {
	const keys = new Set(initial);
	return {
		list: vi.fn(async () => ({
			keys: [...keys].map((name) => ({ name })),
			list_complete: true,
			cacheStatus: null,
		})),
		delete: vi.fn(async (key: string) => { keys.delete(key); }),
	} as unknown as KVNamespace;
}

describe("account deletion purge", () => {
	beforeEach(() => {
		runtime.authUser = null;
		runtime.claimedJobs = [];
		runtime.updates = [];
		runtime.bindings = {};
		runtime.kv = kvNamespace([]);
	});

	it("deletes every object under an R2 prefix", async () => {
		const bucket = r2Bucket({ "workspaces/ws_1/": ["workspaces/ws_1/a", "workspaces/ws_1/b"] });

		await expect(purgeR2Prefix(bucket, "workspaces/ws_1/")).resolves.toEqual({
			complete: true,
			deleted: 2,
		});
		expect(bucket.delete).toHaveBeenCalledWith(["workspaces/ws_1/a", "workspaces/ws_1/b"]);
	});

	it("deletes only KV keys tied to the deleted workspaces and API keys", async () => {
		const cache = kvNamespace([
			"gateway:credit:ws_1",
			"gateway:key:kid_1:v3",
			"gateway:static:v3:ws_other:model",
		]);

		await expect(purgeKvAccountData({
			cache,
			workspaceIds: ["ws_1"],
			keyIds: [],
			keyKids: ["kid_1"],
		})).resolves.toEqual({ complete: true, deleted: 2 });
		expect(cache.delete).toHaveBeenCalledTimes(2);
		expect(cache.delete).not.toHaveBeenCalledWith("gateway:static:v3:ws_other:model");
	});

	it("scrubs deletion identifiers after database, R2, and KV deletion complete", async () => {
		const ioBucket = r2Bucket({ "workspaces/ws_1/": ["workspaces/ws_1/log.json"] });
		const contributionBucket = r2Bucket({ "contributions/ws_1/": ["contributions/ws_1/item.json"] });
		runtime.bindings = {
			GATEWAY_IO_LOGS_BUCKET: ioBucket,
			DATA_CONTRIBUTIONS_BUCKET: contributionBucket,
		};
		runtime.kv = kvNamespace(["gateway:credit:ws_1"]);
		runtime.claimedJobs = [{
			id: "job_1",
			user_id: "user_1",
			workspace_ids: ["ws_1"],
			key_ids: ["key_1"],
			key_kids: ["kid_1"],
			deadline_at: "2026-09-29T00:00:00.000Z",
			r2_objects_deleted: 0,
			kv_keys_deleted: 0,
		}];

		const summary = await runAccountDeletionPurgeJob({ now: new Date("2026-08-30T00:00:00.000Z") });

		expect(summary).toMatchObject({ claimed: 1, completed: 1, failed: 0, r2ObjectsDeleted: 2, kvKeysDeleted: 1 });
		expect(runtime.updates[0]).toMatchObject({
			user_id: null,
			workspace_ids: [],
			key_ids: [],
			key_kids: [],
			status: "completed",
			r2_objects_deleted: 2,
			kv_keys_deleted: 1,
		});
	});

	it("does not purge storage while the Auth user still exists", async () => {
		runtime.authUser = { id: "user_1" };
		runtime.claimedJobs = [{
			id: "job_1",
			user_id: "user_1",
			workspace_ids: ["ws_1"],
			key_ids: [],
			key_kids: [],
			deadline_at: "2026-09-29T00:00:00.000Z",
			r2_objects_deleted: 0,
			kv_keys_deleted: 0,
		}];

		const summary = await runAccountDeletionPurgeJob({ now: new Date("2026-08-30T00:00:00.000Z") });

		expect(summary).toMatchObject({ claimed: 1, completed: 0, failed: 1 });
		expect(runtime.updates[0]).toMatchObject({ status: "failed", last_error: "auth_user_still_exists" });
	});
});
