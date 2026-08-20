import {
	dedupeSubscriptionPlanPrices,
	sortSubscriptionPlanPricesForDisplay,
	type SubscriptionPrice,
} from "./ModelSubscriptionsClient";

describe("subscription price normalization", () => {
	const prices: SubscriptionPrice[] = [
		{ frequency: "month", currency: "usd", price: 20 },
		{ frequency: "monthly", currency: " USD ", price: 20 },
		{ frequency: "yearly", currency: "USD", price: 20 },
		{ frequency: "monthly", currency: "EUR", price: 20 },
		{ frequency: "monthly", currency: "USD", price: 21 },
	];

	test("deduplicates normalized matches while retaining every distinct key", () => {
		expect(dedupeSubscriptionPlanPrices(prices)).toEqual([
			prices[1],
			prices[2],
			prices[3],
			prices[4],
		]);
	});

	test("preserves deterministic display ordering after deduplication", () => {
		expect(sortSubscriptionPlanPricesForDisplay(prices)).toEqual([
			prices[1],
			prices[4],
			prices[2],
			prices[3],
		]);
	});
});
