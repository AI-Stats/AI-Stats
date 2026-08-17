import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const explicitlyRequestedOptInSuite = process.argv.some((argument) =>
	argument.includes(".live.spec.ts") ||
	argument.includes("tests/providers/") ||
	argument.includes("tests\\providers\\") ||
	argument.includes("tests/aimock/") ||
	argument.includes("tests\\aimock\\"),
);

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(rootDir, "src"),
            "@core": path.resolve(rootDir, "src/core"),
            "@pipeline": path.resolve(rootDir, "src/pipeline"),
            "@protocols": path.resolve(rootDir, "src/protocols"),
            "@executors": path.resolve(rootDir, "src/executors"),
            "@providers": path.resolve(rootDir, "src/providers"),
            "@observability": path.resolve(rootDir, "src/observability"),
        },
    },
    test: {
        environment: "node",
        testTimeout: 60000,
        hookTimeout: 60000,
        maxConcurrency: 1,
        include: ["tests/**/*.spec.ts", "tests/**/*.test.ts", "src/**/*.test.ts"],
		exclude: explicitlyRequestedOptInSuite ? [] : [
			"tests/integration/**/*.live.spec.ts",
			"tests/providers/**",
			"tests/aimock/**",
		],
        setupFiles: [path.join(rootDir, "tests", "setup.ts")],
        reporters: [
            "default",
            path.join(rootDir, "tests", "table-reporter.js"),
        ],
    },
});
