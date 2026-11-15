# Verification record

Verified on 2026-11-15.

| Area | Evidence |
| --- | --- |
| Runtime automation with scoped App, default token read-only | [Updater run](https://github.com/budget-buddy-org/ci-workflows/actions/runs/43730619431) opened [runtime PR #10](https://github.com/budget-buddy-org/ci-workflows/pull/10), which passed CI and merged. Workflow review approval remains disabled. |
| Contracts shared validation and release preview | [PR #154](https://github.com/budget-buddy-org/budget-buddy-contracts/pull/154), [preview](https://github.com/budget-buddy-org/budget-buddy-contracts/actions/runs/43733534554), [main release workflow](https://github.com/budget-buddy-org/budget-buddy-contracts/actions/runs/43737467947) passed. |
| API shared build and release preview | [PR #238](https://github.com/budget-buddy-org/budget-buddy-api/pull/238), [preview](https://github.com/budget-buddy-org/budget-buddy-api/actions/runs/43733527905), [main CI](https://github.com/budget-buddy-org/budget-buddy-api/actions/runs/43737480157) passed. |
| API explicit dependency submission | [Main submission](https://github.com/budget-buddy-org/budget-buddy-api/actions/runs/43737480269) passed with contract dependency access. |
| Web shared validation and release preview | [PR #193](https://github.com/budget-buddy-org/budget-buddy-web-app/pull/193), [preview](https://github.com/budget-buddy-org/budget-buddy-web-app/actions/runs/43733531129), [main CI](https://github.com/budget-buddy-org/budget-buddy-web-app/actions/runs/43737491783) passed. |
| Shared container library | [Full fixture](https://github.com/budget-buddy-org/ci-workflows/actions/runs/43741898007) passed native amd64/arm64 builds, digest validation, both pulls, SARIF, actual vulnerability rejection, Cosign verification, and signed-digest tag copy. |
| API common-policy candidate | [Final run](https://github.com/budget-buddy-org/budget-buddy-api/actions/runs/43741927210) passed both native builds, the common CRITICAL gate on both platforms, both pulls, signer verification and signed-digest tag copy. |
| Web common-policy candidate | [Final run](https://github.com/budget-buddy-org/budget-buddy-web-app/actions/runs/43741944622) passed both native builds, non-root startup/runtime-config/SPA routing checks, the common CRITICAL gate, both pulls, signer verification and signed-digest tag copy. |
| Final common runtime reader | [Contracts PR #155](https://github.com/budget-buddy-org/budget-buddy-contracts/pull/155) and [release preview](https://github.com/budget-buddy-org/budget-buddy-contracts/actions/runs/43742014211) validated the same library commit used by both apps. |
| Native audit cleanup | [iOS PR #114](https://github.com/budget-buddy-org/budget-buddy-ios-app/pull/114) merged after its iOS build and SonarCloud checks passed. |

The local regression suite covers real commitlint events and malicious text, frozen setup, write-job event boundaries, immutable action pins, mixed digest/source/version rejection, architecture coverage, vulnerability gates, signer/caller identity, idempotent version tags, and non-regressing latest aliases. Library PR validation runs that suite and actionlint automatically.

All three consumers use library commit `ad780d45400f3a82e82a817a8ad4cd1f5f89c989` for every shared workflow/action. Node/pnpm are read through one version action. Both apps use the same scan/sign/promotion policy with no caller overrides. Candidate validation uses temporary tags; production aliases are promoted on a genuine release.

Live validation caught and corrected Docker-media-type annotation loss in API buildpacks and a fixed CRITICAL Brotli issue in the former web base image. The web image now uses current Nginx with available Alpine security updates and runs as the nginx user; native smoke checks verify startup, runtime configuration, routing and non-root execution.
