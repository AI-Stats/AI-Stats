# Releasing

## One-time setup

1. Create `phaseoteam/terraform-provider-phaseo` as an empty public GitHub repository. Do not initialize it with a README or license; the first subtree push must establish its history.
2. Create a fine-grained token, or a GitHub App installation token, that can write repository contents to that repository. Store it in the Phaseo monorepo as `TERRAFORM_PROVIDER_SYNC_TOKEN`.
3. Run the monorepo's `Sync Terraform provider repository` workflow and confirm the generated repository receives the provider-only history.
4. Choose and add an explicit license for the provider before its first public release.
5. Generate an RSA GPG signing key. Add its armored private key as `GPG_PRIVATE_KEY` and its passphrase as `PASSPHRASE` in the generated repository's protected `publish` environment secrets.
6. Add the armored public key to the Phaseo namespace in Terraform Registry.

Prefer a GitHub App over a personal token for long-lived synchronization. If a GitHub App is used, update the sync workflow to mint its short-lived installation token.

## Release

Provider development and release-file changes are made in the monorepo. After they reach the generated repository:

1. Confirm its `Test` workflow passes.
2. Create and push a unique semantic-version tag, such as `v0.1.0`, in the generated repository.
3. The `Release` workflow tests, cross-compiles, checksums, signs, and creates a draft GitHub release.
4. Inspect the draft assets, then publish the release.
5. For the first version, select **Publish → Provider** in Terraform Registry and choose `phaseoteam/terraform-provider-phaseo`.

Never reuse or replace a published version. Publish fixes under a new semantic version.
