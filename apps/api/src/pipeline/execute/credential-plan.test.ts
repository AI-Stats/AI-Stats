import { describe, expect, it } from "vitest";
import { buildCredentialAttemptPlan, MAX_BYOK_CREDENTIAL_ATTEMPTS } from "./index";

function key(id: string, routingMode: "priority" | "fallback", sortOrder: number) {
	return {
		id,
		providerId: "provider-a",
		fingerprintSha256: id,
		keyVersion: "1",
		alwaysUse: routingMode === "priority",
		routingMode,
		sortOrder,
		key: `secret-${id}`,
	};
}

describe("credential attempt plan", () => {
	it("tries ordered priority keys, ranked managed providers, then ordered fallback keys", () => {
		const providerA = {
			candidate: {
				providerId: "provider-a",
				byokMeta: [key("a-fallback", "fallback", 0), key("a-priority-2", "priority", 2), key("a-priority-1", "priority", 1)],
			},
		};
		const providerB = {
			candidate: {
				providerId: "provider-b",
				byokMeta: [key("b-fallback", "fallback", 0)],
			},
		};

		const plan = buildCredentialAttemptPlan([providerA, providerB]);
		expect(plan.map((attempt) => attempt.phase)).toEqual([
			"priority_byok",
			"priority_byok",
			"gateway",
			"gateway",
			"fallback_byok",
			"fallback_byok",
		]);
		expect(plan.map((attempt) =>
			attempt.credential.kind === "gateway"
				? `${attempt.routed.candidate.providerId}:gateway`
				: `${attempt.routed.candidate.providerId}:${attempt.credential.key.id}`,
		)).toEqual([
			"provider-a:a-priority-1",
			"provider-a:a-priority-2",
			"provider-a:gateway",
			"provider-b:gateway",
			"provider-a:a-fallback",
			"provider-b:b-fallback",
		]);
	});

	it("omits fallback BYOK keys when the workspace setting is disabled", () => {
		const provider = {
			candidate: {
				providerId: "provider-a",
				byokMeta: [key("priority", "priority", 0), key("fallback", "fallback", 0)],
			},
		};

		const plan = buildCredentialAttemptPlan([provider], { includeFallbackByok: false });
		expect(plan.map((attempt) => attempt.phase)).toEqual(["priority_byok", "gateway"]);
	});

	it("caps total BYOK attempts without removing the managed provider attempt", () => {
		const provider = {
			candidate: {
				providerId: "provider-a",
				byokMeta: Array.from({ length: 2_400 }, (_, index) =>
					key(`key-${String(index).padStart(4, "0")}`, index < 1_200 ? "priority" : "fallback", index)
				),
			},
		};

		const plan = buildCredentialAttemptPlan([provider]);

		expect(plan).toHaveLength(MAX_BYOK_CREDENTIAL_ATTEMPTS + 1);
		expect(plan.filter((attempt) => attempt.credential.kind === "byok")).toHaveLength(
			MAX_BYOK_CREDENTIAL_ATTEMPTS,
		);
		expect(plan.filter((attempt) => attempt.credential.kind === "gateway")).toHaveLength(1);
	});

	it("uses remaining BYOK budget for fallback keys", () => {
		const provider = {
			candidate: {
				providerId: "provider-a",
				byokMeta: [
					...Array.from({ length: 3 }, (_, index) => key(`priority-${index}`, "priority", index)),
					...Array.from({ length: 20 }, (_, index) => key(`fallback-${index}`, "fallback", index)),
				],
			},
		};

		const plan = buildCredentialAttemptPlan([provider]);

		expect(plan.filter((attempt) => attempt.phase === "priority_byok")).toHaveLength(3);
		expect(plan.filter((attempt) => attempt.phase === "fallback_byok")).toHaveLength(5);
	});
});
