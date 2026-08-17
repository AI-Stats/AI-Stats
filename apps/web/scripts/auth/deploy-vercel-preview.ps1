$ErrorActionPreference = "Stop"

$previewOrigin = "https://phaseo-planetscale-better-auth.vercel.app"
$values = @{
	PLANETSCALE_DATABASE_URL = [Environment]::GetEnvironmentVariable("PLANETSCALE_DATABASE_URL")
	BETTER_AUTH_ALLOW_SIGN_UP = "false"
	BETTER_AUTH_SECRET = [Environment]::GetEnvironmentVariable("BETTER_AUTH_SECRET")
	BETTER_AUTH_URL = $previewOrigin
	BETTER_AUTH_TRUSTED_ORIGINS = $previewOrigin
	BETTER_AUTH_GITHUB_CLIENT_ID = [Environment]::GetEnvironmentVariable("BETTER_AUTH_GITHUB_CLIENT_ID")
	BETTER_AUTH_GITHUB_CLIENT_SECRET = [Environment]::GetEnvironmentVariable("BETTER_AUTH_GITHUB_CLIENT_SECRET")
	BETTER_AUTH_GITLAB_CLIENT_ID = [Environment]::GetEnvironmentVariable("BETTER_AUTH_GITLAB_CLIENT_ID")
	BETTER_AUTH_GITLAB_CLIENT_SECRET = [Environment]::GetEnvironmentVariable("BETTER_AUTH_GITLAB_CLIENT_SECRET")
	BETTER_AUTH_GOOGLE_CLIENT_ID = [Environment]::GetEnvironmentVariable("BETTER_AUTH_GOOGLE_CLIENT_ID")
	BETTER_AUTH_GOOGLE_CLIENT_SECRET = [Environment]::GetEnvironmentVariable("BETTER_AUTH_GOOGLE_CLIENT_SECRET")
	WEB_API_ORIGIN = "https://phaseo-web-api-staging.danielbutler500.workers.dev"
	STAGING_GATEWAY_BASE_URL = "https://api-staging.phaseo.app"
	NEXT_PUBLIC_STAGING_GATEWAY_BASE_URL = "https://api-staging.phaseo.app"
	NEXT_PUBLIC_WEBSITE_URL = $previewOrigin
}

$arguments = @("exec", "vercel", "deploy", "--yes", "--force", "--with-cache")
foreach ($entry in $values.GetEnumerator()) {
	if ([string]::IsNullOrWhiteSpace($entry.Value)) { throw "Missing $($entry.Key)" }
	$assignment = "$($entry.Key)=$($entry.Value)"
	$arguments += @("--env", $assignment, "--build-env", $assignment)
}

& pnpm @arguments
if ($LASTEXITCODE -ne 0) { throw "Vercel preview deployment failed" }
