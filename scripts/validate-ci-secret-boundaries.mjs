import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function extractJob(workflow, name) {
	const marker = [`    ${name}:`, `  ${name}:`].find((candidate) => workflow.includes(candidate));
	if (!marker) throw new Error(`Missing CI job: ${name}`);
	const start = workflow.indexOf(marker);
	const remainder = workflow.slice(start + marker.length);
	const indent = marker.length - marker.trimStart().length;
	const nextJob = remainder.search(new RegExp(`\\n {${indent}}[a-zA-Z0-9_-]+:\\r?\\n`));
	return nextJob < 0 ? remainder : remainder.slice(0, nextJob);
}

function extractCondition(job, name) {
	const condition = job.match(
		/\n        if: >-?\r?\n([\s\S]*?)(?=\n        [a-zA-Z0-9_-]+:)/,
	)?.[1];
	if (!condition) {
		throw new Error(`${name} must have an explicit job-level authorization condition`);
	}
	return condition;
}

export function validateCiSecretBoundaries(workflow) {
	const previewJob = extractJob(workflow, "deploy-preview-web");
	const previewCondition = extractCondition(previewJob, "deploy-preview-web");
	const migrationValidationJob = extractJob(workflow, "migration-validation");
	const productionMigrationJob = extractJob(workflow, "migrate-production");
	const productionMigrationCondition = extractCondition(
		productionMigrationJob,
		"migrate-production",
	);
	const deployJob = extractJob(workflow, "deploy");
	const deployCondition = extractCondition(deployJob, "deploy");

	if (!workflow.match(/\n    merge_group:\r?\n/)) {
		throw new Error("merge_group validation must remain enabled for merge queue checks");
	}

	if (!previewJob.includes("VERCEL_TOKEN")) {
		throw new Error("Expected deploy-preview-web to remain the Vercel credential boundary");
	}

	if (previewCondition.includes("merge_group")) {
		throw new Error("deploy-preview-web must never run for merge_group events");
	}

	if (!previewCondition.includes("github.event.pull_request.head.repo.full_name == github.repository")) {
		throw new Error("deploy-preview-web must require same-repository pull requests");
	}

	if (!previewCondition.includes('OWNER","MEMBER","COLLABORATOR')) {
		throw new Error("deploy-preview-web must require a trusted pull-request author association");
	}

	if (migrationValidationJob.includes("secrets.")) {
		throw new Error("migration-validation must remain secret-free");
	}

	if (!productionMigrationJob.includes("environment: production-database")) {
		throw new Error("migrate-production must use the production-database approval environment");
	}

	if (
		!productionMigrationCondition.includes("github.event_name == 'push'") ||
		!productionMigrationCondition.includes("github.ref == 'refs/heads/main'")
	) {
		throw new Error("migrate-production must only run for pushes to main");
	}

	if (
		productionMigrationCondition.includes("pull_request") ||
		productionMigrationCondition.includes("merge_group")
	) {
		throw new Error("migrate-production must never expose secrets to pull requests or merge groups");
	}

	if (!productionMigrationCondition.includes("vars.ENABLE_PRODUCTION_DB_MIGRATIONS == 'true'")) {
		throw new Error("migrate-production must retain its explicit repository opt-in");
	}

	if (
		!productionMigrationJob.includes("group: production-database-migrations") ||
		!productionMigrationJob.includes("cancel-in-progress: false")
	) {
		throw new Error("production migrations must remain serialized and non-cancelling");
	}

	for (const secret of [
		"SUPABASE_ACCESS_TOKEN",
		"SUPABASE_DB_PASSWORD",
		"SUPABASE_PROJECT_ID",
	]) {
		const expression = `secrets.${secret}`;
		if (!productionMigrationJob.includes(expression)) {
			throw new Error(`migrate-production is missing ${secret}`);
		}
		if (workflow.split(expression).length !== 2) {
			throw new Error(`${secret} must only be exposed by migrate-production`);
		}
	}

	const dryRun = productionMigrationJob.indexOf("--dry-run");
	const apply = productionMigrationJob.indexOf("Apply pending production migrations");
	if (dryRun < 0 || apply < 0 || dryRun > apply) {
		throw new Error("production migrations must dry-run before applying");
	}

	if (
		!deployJob.includes("- migrate-production") ||
		!deployCondition.includes("needs.migrate-production.result == 'success'") ||
		!deployCondition.includes("needs.check-paths.outputs.migrations-changed != 'true'")
	) {
		throw new Error("production application deploys must remain gated by database migrations");
	}
}

export function validateAgentSdkReleaseSecretBoundaries(workflow) {
	for (const boundary of [
		{ job: "publish-go", testStep: "Test module", publishStep: "Tag module", testCommand: "go -C packages/sdk/agent-sdk-go test ./..." },
		{ job: "publish-php", testStep: "Test package", publishStep: "Tag and sync split repository", testCommand: "php packages/sdk/agent-sdk-php/tests/agent_loop_test.php" },
	]) {
		const job = extractJob(workflow, boundary.job);
		const testIndex = job.indexOf(`- name: ${boundary.testStep}`);
		const tokenIndex = job.indexOf("- name: Create GitHub App token");
		const publishIndex = job.indexOf(`- name: ${boundary.publishStep}`);
		if (testIndex < 0 || tokenIndex < 0 || publishIndex < 0 || !(testIndex < tokenIndex && tokenIndex < publishIndex)) {
			throw new Error(`${boundary.job} must finish repository-controlled tests before creating its GitHub App token`);
		}
		if (job.slice(tokenIndex).includes(boundary.testCommand)) {
			throw new Error(`${boundary.job} must not run repository-controlled tests after exposing its GitHub App token`);
		}
	}
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
	const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
	validateCiSecretBoundaries(workflow);
	const agentSdkWorkflow = readFileSync(new URL("../.github/workflows/publish-agent-sdks.yml", import.meta.url), "utf8");
	validateAgentSdkReleaseSecretBoundaries(agentSdkWorkflow);
	console.log("CI secret-bearing deployment boundaries are valid.");
}
