import assert from "node:assert/strict";
import { testingExports } from "./run-internal";

function main(): void {
    checkParseNextLink();
    checkNotificationsDisabledFlag();
}

function checkParseNextLink(): void {
    const baseUrl = "https://huggingface.co/api/models?author=openai&limit=100";

    assert.equal(
        testingExports.parseNextLink(
            '</api/models?author=openai&limit=100&cursor=abc>; rel="next"',
            baseUrl
        ),
        "https://huggingface.co/api/models?author=openai&limit=100&cursor=abc"
    );

    assert.equal(
        testingExports.parseNextLink(
            '<https://huggingface.co/api/models?author=openai&limit=100&cursor=def>; rel="next"',
            baseUrl
        ),
        "https://huggingface.co/api/models?author=openai&limit=100&cursor=def"
    );

    assert.equal(
        testingExports.parseNextLink(
            '<https://attacker.example/collect>; rel="next"',
            baseUrl
        ),
        null
    );

    assert.equal(
        testingExports.parseNextLink(
            '<https://huggingface.co/api/spaces?author=openai>; rel="next"',
            baseUrl
        ),
        null
    );
}

function checkNotificationsDisabledFlag(): void {
    const name = "MODEL_UPDATES_NOTIFICATIONS_DISABLED";
    const original = process.env[name];
    try {
        delete process.env[name];
        assert.equal(testingExports.isModelUpdatesNotificationsDisabled(), false);

        for (const value of ["false", "0", "", "yes"]) {
            process.env[name] = value;
            assert.equal(
                testingExports.isModelUpdatesNotificationsDisabled(),
                false,
                `expected "${value}" to not disable notifications`
            );
        }

        for (const value of ["true", "1", "TRUE", " true", "True "]) {
            process.env[name] = value;
            assert.equal(
                testingExports.isModelUpdatesNotificationsDisabled(),
                true,
                `expected "${value}" to disable notifications`
            );
        }
    } finally {
        if (typeof original === "string") {
            process.env[name] = original;
        } else {
            delete process.env[name];
        }
    }
}

main();
