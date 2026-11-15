# Specialized workflow audit

The implementation order was regression/runtime foundations, stack validation and release execution, image scanning/publication, then the remaining specialized workflows. The following decisions cover the scope of issue #6.

| Workflow | Decision | Reason and retained behavior |
| --- | --- | --- |
| Contracts `publish.yml` | Keep orchestration local; reuse Node/Java setup | npm/Maven outputs, generation configs, version injection, and registry settings are contract-specific. Both jobs use the shared runtime/cache/authentication actions. |
| Contracts `pages.yml` | Keep local | Only this repo assembles these two documentation files and deploys to its `github-pages` environment. The environment, URL output, Pages permissions, and concurrency remain part of that repo's deployment. |
| API `dependency-submission.yaml` | Extract shared Gradle job | Common Java setup and minimum permissions now live in the library. `contents: write` submits the graph; `packages: read` and `GITHUB_TOKEN` allow resolving contracts. Caller path filters remain local. |
| iOS `ios.yml` | Keep local; audit pins and permissions | Xcode/macOS generation, scheme, project, simulator destination, and native commit conventions have a single consumer. Checkout uses the common current immutable pin and the build token is explicitly read-only. |
| iOS `claude-code-review.yml` | Keep local; scope credential availability | The vendor action and OAuth secret belong to that repository. Automatic review is limited to internal non-Dependabot PRs, where the secret is available. Existing enablement settings are retained. |
| iOS `claude.yml` | Keep local | Interactive issue/review triggers and selected write permissions are repository-specific. Checkout is pinned consistently; authentication and activation behavior remain local. |

The iOS repository now maintains GitHub Actions pins with Dependabot alongside its existing Swift updates. The audit was implemented in an isolated worktree so its active feature checkout was not switched. No native product code, target membership, or app architecture changed.

## Contracts publication and retries

The repository's semantic-release configuration owns version preparation: package and specification versions, generated Swift sources, and the release tag. Published npm and Maven artifacts are generated from the checked-out release source. Explicit publish retry refs should name that tag. Prefer rerunning only failed jobs so a successful immutable package publication is not repeated.

Validation exercises the shared setup, spec checks, TypeScript generation/typecheck, Java generation/compilation, and release dry runs. CI/tooling changes do not require an artificial contracts release or manual version bump. Publishing commands stay with the contract-specific configuration and run on the next genuine release or an explicit retry.

Pages retries should select the intended release ref and retain the `github-pages` environment. There is no second Pages consumer that would benefit from another reusable deployment interface.

## Native workflow boundaries

The iOS build stays on its required macOS/Xcode generation with the generic simulator destination. Its bracketed commit convention is distinct from the three conventional-commit consumers, so the shared commitlint workflow is not applied to it.

Claude review/interactive workflows retain the vendor action version and repository-local OAuth setup. Shared build/release jobs receive no Claude credentials. Checkout and Dependabot maintenance are the shared infrastructure cleanup; platform and review orchestration remain with the native repo.

## Signing/deployment audit

The API and web retain their build technologies and now share the manifest, scan, signature, and promotion implementation. At the user’s request for common configuration, both now use one policy in `container-policy.json`: fixed CRITICAL findings block on both architectures, HIGH findings are reported, and unfixed CVEs are excluded. This strengthens the former API/report-only and web/arm64 exceptions without weakening the web amd64 gate.

No Cosign certificate-identity allowlist was found in the deployment repository. The new reusable publisher identity and caller-repository checks are documented in the README. Production images keep the existing GHCR repository names and stable version/latest access pattern.
