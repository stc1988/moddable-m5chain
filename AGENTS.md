# moddable-m5chain agent guide

Follow `$MODDABLE/AGENTS.md` for Moddable SDK development and validation. This file contains only routing instructions
specific to this repository.

Before changing code, read the affected implementation, manifests, tests, and examples, plus the relevant project
documentation:

- [README.md](README.md): public usage, supported devices, and examples
- [docs/api.md](docs/api.md): public API, lifecycle, callbacks, and runtime behavior
- [docs/setup.md](docs/setup.md): public manifests, Host/Mod integration, pins, and injected transports
- [docs/development.md](docs/development.md): contribution policy, internal architecture, type boundaries, custom
  devices, and validation
- [docs/devices](docs/devices/README.md) and [docs/features](docs/features/README.md): device- and feature-specific APIs

Read only the documents relevant to the requested change. Treat the implementation and tests as authoritative when
documentation disagrees with them. Follow the change policy and validation matrix in `docs/development.md`, then
commit requested changes in clean, sensible units and report the commits.

## Commits and pull requests

- Keep each commit focused on one coherent change. Run the relevant validation from `docs/development.md` before
  committing, and report the commit hash together with the checks that passed and any hardware or behavior that was
  not verified.
- Do not include a package version bump in an ordinary feature or fix commit. Release version changes are created by
  the release workflow described below.
- Pull requests should summarize the user-visible behavior, list validation performed, and call out breaking changes
  or unverified hardware behavior explicitly.
- Give each pull request one primary release-note label. Prefer `breaking-change`, `device`, `enhancement`, `bug`,
  `documentation`, `web`, `dependencies`, or `maintenance`; `.github/release.yml` defines the accepted aliases and
  category order. Use `no-release-notes` or `skip-changelog` only when the merged change should be omitted from the
  generated release notes. Unlabeled pull requests appear under `Other Changes`.

## Releases

- Create releases only from the default branch after the intended changes are merged and their required validation
  has passed. The repository Actions settings must allow `GITHUB_TOKEN` write access, and branch protection must allow
  the release workflow to push its version commit and tag.
- Use the `Create GitHub Release` workflow in `.github/workflows/release.yml` through the Actions UI or a
  `workflow_dispatch` API client. With GitHub CLI, run `gh workflow run release.yml --ref main -f version=1.2.3`.
  Supply an explicit npm-compatible version without the `v` prefix; the workflow creates the `v<version>` tag.
- Do not manually edit `package.json` or `package-lock.json`, create the release commit or tag, or publish the GitHub
  Release unless recovery from a failed workflow has been explicitly authorized. The workflow performs these steps,
  verifies both version files, confirms the tagged commit contains the requested package version, and atomically
  pushes the default branch and annotated tag before publishing the release.
- The workflow uses GitHub's generated Release Notes with `.github/release.yml`. After dispatch, wait for the workflow
  to complete and verify that the release tag, the `package.json` version at that tag, and the published release version
  all match before reporting success.
- The current workflow publishes a normal release. Do not use it for a prerelease or draft release without first
  updating the workflow to represent that release type explicitly.
