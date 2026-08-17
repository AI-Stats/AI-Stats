import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const roots = [
	"apps/api/src",
	"apps/mobile/src",
	"apps/web/src",
	"apps/web-api/src",
	"packages/data/db/src",
];
const extensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const forbidden = [
	/[Ss]upabase/,
	/\b[Pp]ostg[Rr][Ee][Ss][Tt]\b/,
	/\/rpc\//,
	/\.rpc\s*\(/,
	/\bpgPolicy\s*\(/,
	/auth\.uid\s*\(/,
];

function files(root) {
	return readdirSync(root).flatMap((entry) => {
		const path = join(root, entry);
		return statSync(path).isDirectory() ? files(path) : [path];
	});
}

const violations = roots.flatMap((root) => files(root)).flatMap((path) => {
	if (!extensions.has(extname(path))) return [];
	const lines = readFileSync(path, "utf8").split(/\r?\n/);
	return lines.flatMap((line, index) => forbidden.some((pattern) => pattern.test(line))
		? [`${relative(process.cwd(), path)}:${index + 1}`]
		: []);
});

if (violations.length) {
	console.error("Legacy database runtime dependency detected:");
	for (const violation of violations) console.error(`- ${violation}`);
	process.exitCode = 1;
} else {
	console.log("Runtime source is free of legacy database client and RPC dependencies.");
}
