const mockFetchPublicWebApi = jest.fn();
jest.mock("@/lib/web-api/client", () => ({
	fetchOptionalPublicWebApi: jest.fn(),
	fetchPublicWebApi: (...args: unknown[]) => mockFetchPublicWebApi(...args),
}));

import { fetchFrontendFamilies } from "@/lib/fetchers/frontend/fetchPublicCatalog";

describe("fetchFrontendFamilies", () => {
	beforeEach(() => {
		mockFetchPublicWebApi.mockReset();
	});

	it("enriches legacy family payloads with organisation display names", async () => {
		mockFetchPublicWebApi.mockImplementation(async (path: string) => {
			if (path === "/api/_web/families") {
				return {
					families: [{
						family_id: "openai/gpt",
						family_name: "GPT",
						organisation_id: "openai",
					}],
				};
			}
			return {
				organisations: [{
					organisation_id: "openai",
					organisation_name: "OpenAI",
					country_code: "US",
					colour: null,
				}],
			};
		});

		await expect(fetchFrontendFamilies()).resolves.toMatchObject([{
			family_id: "openai/gpt",
			organisation_name: "OpenAI",
		}]);
		expect(mockFetchPublicWebApi).toHaveBeenCalledTimes(2);
	});

	it("uses names already included in the family payload", async () => {
		mockFetchPublicWebApi.mockResolvedValue({
			families: [{
				family_id: "openai/gpt",
				family_name: "GPT",
				organisation_id: "openai",
				organisation_name: "OpenAI",
			}],
		});

		await expect(fetchFrontendFamilies()).resolves.toMatchObject([{
			organisation_name: "OpenAI",
		}]);
		expect(mockFetchPublicWebApi).toHaveBeenCalledTimes(1);
	});
});
