import { defineConfig } from "vite";

export default defineConfig({
	build: {
		outDir: "dist/main",
		emptyOutDir: true,
		lib: {
			entry: "src/main/index.ts",
			formats: ["es"],
			fileName: () => "index.mjs",
		},
		rollupOptions: {
			external: ["electron", "node:path", "node:url"],
		},
	},
});
