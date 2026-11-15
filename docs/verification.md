# Verification record

Verified on 2026-11-15.

| Area | Evidence |
| --- | --- |
| Runtime automation with scoped App, default token read-only | [Updater run](https://github.com/budget-buddy-org/ci-workflows/actions/runs/43730619431) opened [runtime PR #10](https://github.com/budget-buddy-org/ci-workflows/pull/10), which passed CI and merged. Workflow review approval remains disabled. |
| Contracts shared validation and release preview | [PR #154](https://github.com/budget-buddy-org/budget-buddy-contracts/pull/154), [preview](https://github.com/budget-buddy-org/budget-buddy-contracts/actions/runs/43733534554), [main release workflow](https://github.com/budget-buddy-org/budget-buddy-contracts/actions/runs/43737467947) passed. |
| API shared build and release preview | [PR #238](https://github.com/budget-buddy-org/budget-buddy-api/pull/238), [preview](https://github.com/budget-buddy-org/budget-buddy-api/actions/runs/43733527905), [main CI](https://github.com/budget-buddy-org/budget-buddy-api/actions/runs/43737480157) passed. |
| API explicit dependency submission | [Main submission](https://github.com/budget-buddy-org/budget-buddy-api/actions/runs/43737480269) passed with contract dependency access. |
| Web shared validation and release preview | [PR #193](https://github.com/budget-buddy-org/budget-buddy-web-app/pull/193), [preview](https://github.com/budget-buddy-org/budget-buddy-web-app/actions/runs/43733531129), [main CI](https://github.com/budget-buddy-org/budget-buddy-web-app/actions/runs/43737491783) passed. |
| Shared container library | [Full fixture](https://github.com/budget-buddy-org/ci-workflows/actions/runs/43738863829) passed native amd64/arm64 builds, digest validation, both pulls, SARIF, actual vulnerability rejection, Cosign verification, and signed-digest tag copy. |
| Native audit cleanup | [iOS PR #114](https://github.com/budget-buddy-org/budget-buddy-ios-app/pull/114) merged after its iOS build and SonarCloud checks passed. |

The local regression suite covers real commitlint events and malicious text, frozen setup, write-job event boundaries, immutable action pins, mixed digest/source/version rejection, architecture coverage, vulnerability gates, signer/caller identity, idempotent version tags, and non-regressing latest aliases. Library PR validation runs that suite and actionlint automatically.

Real application image candidate runs are recorded in their consumer PRs and the container issues after validation completes. Those runs use candidate tags and do not promote production aliases.
