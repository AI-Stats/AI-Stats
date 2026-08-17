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

	for (const secret of ["PLANETSCALE_MIGRATION_DATABASE_URL"]) {
		const expression = `secrets.${secret}`;
		if (!productionMigrationJob.includes(expression)) {
			throw new Error(`migrate-production is missing ${secret}`);
		}
		if (workflow.split(expression).length !== 2) {
			throw new Error(`${secret} must only be exposed by migrate-production`);
		}
	}

	const validation = productionMigrationJob.indexOf("db:check");
	const apply = productionMigrationJob.indexOf("Apply pending production migrations");
	if (validation < 0 || apply < 0 || validation > apply) {
		throw new Error("production migrations must validate Drizzle history before applying");
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
		{ testJob: "test-go", publishJob: "publish-go", testCommand: "go -C packages/sdk/agent-sdk-go test ./..." },
		{ testJob: "test-php", publishJob: "publish-php", testCommand: "php packages/sdk/agent-sdk-php/tests/agent_loop_test.php" },
	]) {
		const testJob = extractJob(workflow, boundary.testJob);
		const publishJob = extractJob(workflow, boundary.publishJob);
		if (!testJob.includes(boundary.testCommand)) {
			throw new Error(`${boundary.testJob} must execute the repository-controlled test suite`);
		}
		if (!publishJob.includes(`needs: ${boundary.testJob}`)) {
			throw new Error(`${boundary.publishJob} must require the isolated ${boundary.testJob} job`);
		}
		if (!publishJob.includes("Create GitHub App token") || publishJob.includes(boundary.testCommand)) {
			throw new Error(`${boundary.publishJob} must expose its GitHub App token only on a fresh runner after tests`);
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
