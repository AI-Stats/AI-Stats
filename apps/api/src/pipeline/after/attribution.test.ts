import { describe, expect, it } from "vitest";

import { readAttributionHeaders } from "./attribution";

describe("readAttributionHeaders", () => {
    it("reads app category attribution", () => {
        const request = new Request("https://api.phaseo.app/v1/responses", {
            headers: {
                "X-App-Id": "support-console",
                "X-App-Categories": "productivity,developer-tools",
            },
        });

        expect(readAttributionHeaders(request)).toMatchObject({
            appId: "support-console",
            appCategories: "productivity,developer-tools",
        });
    });
});
