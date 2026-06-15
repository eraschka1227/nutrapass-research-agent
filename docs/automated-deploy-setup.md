# NutraPass Automated Deploy Setup

Goal: stop depending on the live Hermes/Discord machine having the right Cloudflare token every time.

## What is now in place

A GitHub Actions workflow exists at:

`../.github/workflows/deploy-nutrapass.yml`

It runs on:

- manual GitHub button: **Actions → Deploy NutraPass → Run workflow**
- pushes to `main` that touch `NutraPass/**`

It performs:

1. `npm ci`
2. `npm test`
3. `npx wrangler whoami`
4. `npx wrangler deploy` for the Worker `nutrapass-ai`
5. `bash scripts/deploy-widget.sh --skip-tests` for the Pages widget `nutrapass-widget`

## Required one-time GitHub secrets

Add these in GitHub:

Repo → Settings → Secrets and variables → Actions → New repository secret

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Current Cloudflare account ID used by Wrangler:

`012046b4f5f40edd239e7db8826ba536`

## Cloudflare token permissions

Create a single purpose-built token for automated deploys. Do not reuse random dashboard/session tokens.

Suggested Cloudflare API token permissions:

- Account → Workers Scripts → Edit
- Account → Workers KV Storage → Edit
- Account → Cloudflare Pages → Edit
- User → User Details → Read
- User → Memberships → Read

Scope it to account:

- `Eric@nutrapass.club's Account`

If zone-scoping is required for Pages/custom domains, include the NutraPass zone with the minimum needed Pages/domain permission.

## Why this should be more stable

Hermes currently reads `CLOUDFLARE_API_TOKEN` from its profile environment. That token is valid but does not have enough Worker deploy permission, so deploys fail even though local tests and dry-runs pass.

GitHub Actions moves deployment to one stable place:

- clean Ubuntu runner
- fresh Node/Wrangler install
- repo-pinned workflow
- one dedicated deploy token stored in GitHub Secrets
- manual rerun button without editing Hermes or Cloudflare each time

## Reporting rule

Every NutraPass operational update must explicitly separate:

- Code/config changes completed
- Local test status
- Worker deploy status: **deployed** or **not deployed**
- Pages/widget deploy status: **deployed** or **not deployed**
- Live verification status

Do not trigger a second deploy just to clarify a previous deployment. If the user asks for status, inspect the workflow/live endpoints and report whether deployment already happened.

## Local fallback

`scripts/deploy-widget.sh` now prefers the project-pinned Wrangler from `node_modules/.bin/wrangler`, and falls back to a temp Wrangler install outside Q Sync when local `node_modules` is missing/read-only.
