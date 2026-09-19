# moddable-m5chain agent guide

Follow `$MODDABLE/AGENTS.md` for Moddable SDK development and validation. This file contains only routing instructions
specific to this repository.

Inspect the affected implementation and tests before changing code. Read manifests, examples, and project
documentation when they are relevant to the requested change:

- [README.md](README.md): public usage, supported devices, and examples
- [docs/api.md](docs/api.md): public API, lifecycle, callbacks, and runtime behavior
- [docs/setup.md](docs/setup.md): public manifests, Host/Mod integration, pins, and injected transports
- [docs/development.md](docs/development.md): contribution policy, internal architecture, type boundaries, custom
  devices, and validation
- [docs/devices](docs/devices/README.md) and [docs/features](docs/features/README.md): device- and feature-specific APIs

Read only the documents relevant to the requested change. Treat the implementation and tests as authoritative when
documentation disagrees with them. Follow the change policy and relevant validation in `docs/development.md`. Fix
failures caused by the requested change, rerun the affected checks, and report the checks performed plus any hardware
or behavior that remains unverified.

When committing, opening a pull request, or creating a release, follow the corresponding workflow in
`docs/development.md`. Keep commits focused, and do not include a package version bump in an ordinary change.
