import { beforeEach, describe, expect, it, vi } from "vitest";

const findEnabledByokKeyMock = vi.fn();
const touchByokKeyLastUsedMock = vi.fn();
const decryptBYOKMock = vi.fn();
const dispatchBackgroundMock = vi.fn((promise: Promise<unknown>) => promise);

vi.mock("@/repositories/gateway-context", () => ({
	findEnabledByokKey: (...args: unknown[]) => findEnabledByokKeyMock(...args),
	touchByokKeyLastUsed: (...args: unknown[]) => touchByokKeyLastUsedMock(...args),
}));

vi.mock("@pipeline/byok/decrypt", () => ({
	decryptBYOK: (...args: unknown[]) => decryptBYOKMock(...args),
	bytesToString: (bytes: Uint8Array) => new TextDecoder().decode(bytes),
}));

vi.mock("@/runtime/env", () => ({
	dispatchBackground: (...args: unknown[]) => dispatchBackgroundMock(...args),
	getBindings: () => ({ PLANETSCALE_HYPERDRIVE: { connectionString: "postgres://example" } }),
	configureRuntime: vi.fn(),
	clearRuntime: vi.fn(),
}));

import { loadByokKey } from "./byok";

describe("loadByokKey", () => {
	beforeEach(() => {
		findEnabledByokKeyMock.mockReset();
		touchByokKeyLastUsedMock.mockReset().mockResolvedValue(undefined);
		decryptBYOKMock.mockReset();
		dispatchBackgroundMock.mockClear();
	});

	it("loads the first ordered enabled key through the Drizzle repository", async () => {
		findEnabledByokKeyMock.mockResolvedValueOnce({
			id: "key-priority",
			key_version: 1,
			enc_iv: new Uint8Array([1]),
			enc_value: new Uint8Array([2]),
			enc_tag: new Uint8Array([3]),
		});
		decryptBYOKMock.mockResolvedValue(new TextEncoder().encode("provider-secret"));

		const result = await loadByokKey({
			workspaceId: "workspace-1",
			providerId: "openai",
			metaList: [
				{ id: "key-fallback", routingMode: "fallback", sortOrder: 0 } as any,
				{ id: "key-priority", routingMode: "priority", sortOrder: 10 } as any,
			],
		});

		expect(findEnabledByokKeyMock).toHaveBeenCalledWith({
			id: "key-priority",
			workspaceId: "workspace-1",
			providerId: "openai",
		});
		expect(result).toMatchObject({ key: "provider-secret", keyId: "key-priority" });
		expect(dispatchBackgroundMock).toHaveBeenCalledTimes(1);
		await vi.waitFor(() => expect(touchByokKeyLastUsedMock).toHaveBeenCalledWith({
			id: "key-priority",
			workspaceId: "workspace-1",
		}));
	});

	it("returns null without querying when no metadata is available", async () => {
		await expect(loadByokKey({
			workspaceId: "workspace-1",
			providerId: "openai",
			metaList: [],
		})).resolves.toBeNull();
		expect(findEnabledByokKeyMock).not.toHaveBeenCalled();
	});
});
