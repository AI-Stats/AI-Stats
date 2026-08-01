import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const forbiddenDomains = [
	{
		label: "legacy Phaseo .ai domain",
		pattern: new RegExp(`phaseo${"\\."}ai`, "giu"),
	},
	{
		label: "legacy AI Stats Phaseo subdomain",
		pattern: new RegExp(`ai-stats${"\\."}phaseo${"\\."}app`, "giu"),
	},
];

const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
	encoding: "utf8",
})
	.split("\0")
	.filter(Boolean);

const violations = [];

for (const path of trackedFiles) {
	const contents = readFileSync(path);

	// Domain references in binary assets are not actionable text and cannot be
	// safely rewritten. Text files containing NUL bytes are treated as binary.
	if (contents.includes(0)) continue;

	const text = contents.toString("utf8");
	for (const { label, pattern } of forbiddenDomains) {
		for (const match of text.matchAll(pattern)) {
			const line = text.slice(0, match.index).split("\n").length;
			violations.push(`${path}:${line}: ${label} (${match[0]})`);
		}
	}
}

if (violations.length > 0) {
	console.error("Non-canonical Phaseo domain references found:");
	for (const violation of violations) console.error(`- ${violation}`);
	console.error("Use phaseo.app (or an appropriate phaseo.app subdomain).\n");
	process.exit(1);
}

console.log(
	`Canonical domain check passed across ${trackedFiles.length} tracked files.`,
);
