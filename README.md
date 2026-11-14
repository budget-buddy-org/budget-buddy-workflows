# Budget Buddy CI workflows

Shared GitHub Actions jobs for `budget-buddy-org`. App repositories retain their
event triggers, build commands, lint configuration, and dependency lockfiles.

## Commitlint

`.github/workflows/commitlint.yml` checks pull request commits using the caller's
installed `@commitlint/cli` and configuration. Dependabot commits are exempt,
matching the existing API and contracts workflows. No additional secrets are needed;
the job only requests `contents: read`.

Example caller (replace `COMMIT_SHA` with a published full commit SHA):

```yaml
name: Commitlint

on:
  pull_request:

permissions:
  contents: read

jobs:
  commitlint:
    uses: budget-buddy-org/ci-workflows/.github/workflows/commitlint.yml@COMMIT_SHA
```

All callers use Node.js **26.13.1** and pnpm **12.18.0**, the latest stable versions
verified on 2026-11-14. Versions are maintained centrally, with no caller overrides.
Installation uses `--frozen-lockfile --ignore-scripts`; lifecycle scripts such as
Husky setup are unnecessary for checking commit messages.

The caller must supply a pnpm lockfile, commitlint dependency, and commitlint config.
Only `pull_request` events are supported. PR-title and push checks can be added
when their policy is agreed across apps.

## Updating and rolling out shared jobs

Pin action dependencies and caller workflow references to full commit SHAs.
Dependabot maintains action dependencies here. Review shared workflow changes,
publish them, then update consumer pins in separate changes so adoption is deliberate.

This repository is public because public repositories cannot call reusable workflows
from a private repository. Checkout inside the shared job checks out the caller's code.

Reusable jobs appear as nested checks (for example `commitlint / commitlint`).
When migrating a consumer, inspect its PR checks and update any branch rules that
require the old check name before merging. Publish the shared commit before opening
consumer PRs so their references resolve.
