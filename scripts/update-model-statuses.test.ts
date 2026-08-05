import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { collectActiveGatewayModelIds, deriveStatusFromDates, pickStatus } from "./update-model-statuses.ts";

test("keeps a model deprecated while an active gateway route exists", () => {
    const status = deriveStatusFromDates(
        {
            deprecation_date: "2026-07-01T00:00:00",
            retirement_date: "2026-07-31T00:00:00",
        },
        new Date("2026-08-05T00:00:00"),
        true
    );

    assert.deepEqual(status, {
        status: "Deprecated",
        reason: "deprecation_date 2026-07-01T00:00:00",
    });
});

test("retires a model after its retirement date when no active gateway route exists", () => {
    const status = deriveStatusFromDates(
        { retirement_date: "2026-07-31T00:00:00" },
        new Date("2026-08-05T00:00:00")
    );

    assert.equal(status?.status, "Retired");
});

test("does not promote a rumoured model without manual announcement verification", () => {
    const derived = deriveStatusFromDates(
        { announced_date: "2026-08-01T00:00:00" },
        new Date("2026-08-05T00:00:00")
    );

    assert.equal(pickStatus("Rumoured", derived), "Rumoured");
});

test("collects only active gateway model ids", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "model-status-routes-"));
    const providerDir = path.join(root, "provider");
    fs.mkdirSync(providerDir);
    fs.writeFileSync(
        path.join(providerDir, "models.json"),
        JSON.stringify([
            { internal_model_id: "example/active", is_active_gateway: true },
            { internal_model_id: "example/inactive", is_active_gateway: false },
        ])
    );

    try {
        assert.deepEqual([...collectActiveGatewayModelIds(root)], ["example/active"]);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
