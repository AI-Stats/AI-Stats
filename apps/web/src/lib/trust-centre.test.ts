import {
	dataPractices,
	deliberatelyUnclaimed,
	disclosedServiceProviders,
	trustPractices,
	trustStates,
} from "./trust-centre";

describe("trust centre claims", () => {
	it("defines every public claim state", () => {
		const states = new Set(trustStates.map((state) => state.id));
		for (const item of [...trustPractices, ...dataPractices]) {
			expect(states.has(item.state)).toBe(true);
		}
	});

	it("does not present an independent certification", () => {
		expect([...trustPractices, ...dataPractices]).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ state: "independently-certified" }),
			]),
		);
		expect(deliberatelyUnclaimed.join(" ")).toMatch(/SOC 2/);
	});

	it("discloses the provider categories named in the privacy posture", () => {
		expect(disclosedServiceProviders.map(({ name }) => name)).toEqual(
			expect.arrayContaining(["Supabase", "Stripe", "Model providers"]),
		);
	});
});
