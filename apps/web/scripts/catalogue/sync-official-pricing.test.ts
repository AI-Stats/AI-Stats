import { extractHtmlTableRows, extractOfficialPricing, safeOfficialPricingRules } from "./sync-official-pricing";

describe("official pricing extraction", () => {
	test("preserves table row and cell boundaries", () => {
		expect(extractHtmlTableRows(`
			<table>
				<tr><th>Model</th><th>Input</th></tr>
				<tr><td>example</td><td>$1 / MTok</td></tr>
			</table>
		`)).toEqual([[ ["Model", "Input"], ["example", "$1 / MTok"] ]]);
	});

	test("extracts horizontal official token pricing", () => {
		expect(extractOfficialPricing("anthropic", `
			<table>
				<tr><th>Model</th><th>Base Input Tokens</th><th>5m Cache Writes</th><th>Cache Hits</th><th>Output Tokens</th></tr>
				<tr><td>Claude Example 1</td><td>$2 / MTok</td><td>$2.50 / MTok</td><td>$0.20 / MTok</td><td>$10 / MTok</td></tr>
			</table>
		`)).toEqual([{
			providerModel: "Claude Example 1",
			meters: {
				input_text_tokens: 2,
				cached_write_text_tokens_5m: 2.5,
				cached_read_text_tokens: 0.2,
				output_text_tokens: 10,
			},
		}]);
	});

	test("extracts transposed DeepSeek pricing", () => {
		expect(extractOfficialPricing("deepseek", `
			<table>
				<tr><th>MODEL</th><th>deepseek-a</th><th>deepseek-b</th></tr>
				<tr><td>1M INPUT TOKENS (CACHE HIT)</td><td>$0.01</td><td>$0.02</td></tr>
				<tr><td>1M INPUT TOKENS (CACHE MISS)</td><td>$0.10</td><td>$0.20</td></tr>
				<tr><td>1M OUTPUT TOKENS</td><td>$0.30</td><td>$0.40</td></tr>
			</table>
		`)).toEqual([
			{ providerModel: "deepseek-a", meters: { input_text_tokens: 0.1, cached_read_text_tokens: 0.01, output_text_tokens: 0.3 } },
			{ providerModel: "deepseek-b", meters: { input_text_tokens: 0.2, cached_read_text_tokens: 0.02, output_text_tokens: 0.4 } },
		]);
	});

	test("extracts Moonshot MDX pricing", () => {
		expect(extractOfficialPricing("moonshotai", `
			<DocTable
				rows={[
					["kimi-example", "1M tokens", <> {"$"}0.16</>, <> {"$"}0.95</>, <> {"$"}4.00</>],
				]}
			/>
		`)).toEqual([{
			providerModel: "kimi-example",
			meters: {
				cached_read_text_tokens: 0.16,
				input_text_tokens: 0.95,
				output_text_tokens: 4,
			},
		}]);
	});

	test("extracts Fireworks standard token pricing", () => {
		expect(extractOfficialPricing("fireworks", `
			<table>
				<tr><th>Model</th><th>Standard</th><th>Priority</th></tr>
				<tr><td>accounts/fireworks/models/example</td><td>$0.20 / $0.02 / $0.80</td><td>$1.00</td></tr>
			</table>
		`)).toEqual([{
			providerModel: "accounts/fireworks/models/example",
			meters: {
				input_text_tokens: 0.2,
				cached_read_text_tokens: 0.02,
				output_text_tokens: 0.8,
			},
		}]);
	});

	test("extracts Voyage embedding and reranking pricing with capabilities", () => {
		expect(extractOfficialPricing("voyage", `
			<table>
				<tr><th>Model</th><th>Price per million tokens</th></tr>
				<tr><td>voyage-4 voyage-4-lite</td><td>$0.12</td></tr>
				<tr><td>rerank-2.5</td><td>$0.05</td></tr>
			</table>
		`)).toEqual([
			{ providerModel: "voyage-4", capabilityId: "text.embed", meters: { input_text_tokens: 0.12 } },
			{ providerModel: "voyage-4-lite", capabilityId: "text.embed", meters: { input_text_tokens: 0.12 } },
			{ providerModel: "rerank-2.5", capabilityId: "text.rerank", meters: { input_text_tokens: 0.05 } },
		]);
	});

	test("extracts Z.AI horizontal token pricing", () => {
		expect(extractOfficialPricing("z-ai", `
			<table>
				<tr><th>Model</th><th>Input</th><th>Cached Input</th><th>Cached Input Storage</th><th>Output</th></tr>
				<tr><td>glm-example</td><td>$0.40 / M tokens</td><td>$0.04 / M tokens</td><td>Limited-time Free</td><td>$1.20 / M tokens</td></tr>
			</table>
		`)).toEqual([{
			providerModel: "glm-example",
			meters: {
				input_text_tokens: 0.4,
				cached_read_text_tokens: 0.04,
				output_text_tokens: 1.2,
			},
		}]);
	});

	test("skips conditional short and long context tables", () => {
		expect(extractOfficialPricing("openai", `
			<table>
				<tr><th>Short context</th><th>Model</th><th>Input</th><th>Output</th><th>Long context Input</th><th>Output</th></tr>
				<tr><td></td><td>gpt-example</td><td>$1</td><td>$2</td><td>$3</td><td>$4</td></tr>
			</table>
		`)).toEqual([]);
	});

	test("rejects automatic comparison when catalogue units are not USD per million tokens", () => {
		expect(safeOfficialPricingRules({
			rules: [{
				meter: "input_text_tokens",
				unit: "token",
				unit_size: 1_000,
				currency: "USD",
				price_per_unit: 0.001,
				pricing_plan: "standard",
				match: [],
				conditions: [],
				effective_to: null,
			}],
		}, { input_text_tokens: 1 })).toBe(false);
	});
});
