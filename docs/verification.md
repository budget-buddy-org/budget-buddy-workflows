# Verification record

## Current rollout

The [library validation runs](https://github.com/budget-buddy-org/budget-buddy-workflows/actions/workflows/validate.yml?query=branch%3Amain+event%3Apush) identify the tested main commit. The [consumer alignment audit](https://github.com/budget-buddy-org/budget-buddy-workflows/actions/workflows/audit-consumers.yml) compares each consumer’s main branch and runtime metadata with that revision. Check the run date and target before using a result for rollback.

After the rollout PRs merge, dispatch the alignment audit. For a breaking interface change, add an entry below naming the migration, affected consumers, and links to the consumer PRs and their verification. Record outstanding production checks explicitly. Keep immutable revisions under dated Historical headings so the current instructions stay valid when pins advance.

## Interface changes

### Retired contracts validation workflow

Contracts callers must provide their own validation job before advancing past [library PR #27](https://github.com/budget-buddy-org/budget-buddy-workflows/pull/27). [Contracts PR #169](https://github.com/budget-buddy-org/budget-buddy-contracts/pull/169) migrated the only caller and ran its PR checks. Existing callers can use the earlier pinned library while migrating.

### Application release profiles

API and web switched to `profile: application` in [API #254](https://github.com/budget-buddy-org/budget-buddy-api/pull/254) and [web #211](https://github.com/budget-buddy-org/budget-buddy-web-app/pull/211). Both use the central release configuration. Manual dispatch with `dry-run-release=true` exercises release preview on the selected ref. See the [API preview](https://github.com/budget-buddy-org/budget-buddy-api/actions/runs/45241537021) and [web preview](https://github.com/budget-buddy-org/budget-buddy-web-app/actions/runs/45241539209).

- API published [release v1.18.0](https://github.com/budget-buddy-org/budget-buddy-api/releases/tag/v1.18.0) and [the tagged image](https://github.com/budget-buddy-org/budget-buddy-api/actions/runs/45197044322).
- Web passed [candidate image verification](https://github.com/budget-buddy-org/budget-buddy-web-app/actions/runs/44298186684). Record the first genuine post-migration release and its successful tagged image publication here before retiring the compatibility profiles. [Tracking issue #19](https://github.com/budget-buddy-org/budget-buddy-workflows/issues/19)

## Historical verification — 2026-11-23

Library main passed [validation at `bb258fd511c836146d959f8ee015872faf7ccb0e`](https://github.com/budget-buddy-org/budget-buddy-workflows/actions/runs/45200896419). A library validation run establishes the rollout target. Consult the alignment audit above for consumer adoption.

## Historical verification — 2026-11-15

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
| Final app release previews | [API](https://github.com/budget-buddy-org/budget-buddy-api/actions/runs/43742451545) and [web](https://github.com/budget-buddy-org/budget-buddy-web-app/actions/runs/43742454899) passed using the final common library commit. |
| Final common runtime reader | [Contracts PR #155](https://github.com/budget-buddy-org/budget-buddy-contracts/pull/155) and [release preview](https://github.com/budget-buddy-org/budget-buddy-contracts/actions/runs/43742014211) validated the same library commit used by both apps. |
| Native audit cleanup | [iOS PR #114](https://github.com/budget-buddy-org/budget-buddy-ios-app/pull/114) merged after its iOS build and SonarCloud checks passed. |

The local regression suite covers real commitlint events and malicious text, frozen setup, write-job event boundaries, immutable action pins, mixed digest/source/version rejection, architecture coverage, vulnerability gates, signer/caller identity, idempotent version tags, and non-regressing latest aliases. Library PR validation runs that suite and actionlint automatically.

At the time of this run all three consumers used library commit `ad780d45400f3a82e82a817a8ad4cd1f5f89c989` for every shared workflow/action. Node/pnpm are read through one version action. Both apps use the same scan/sign/promotion policy with no caller overrides. Candidate validation uses temporary tags; production aliases are promoted on a genuine release.

Live validation caught and corrected Docker-media-type annotation loss in API buildpacks and a fixed CRITICAL Brotli issue in the former web base image. The web image now uses current Nginx with available Alpine security updates and runs as the nginx user; native smoke checks verify startup, runtime configuration, routing and non-root execution.
