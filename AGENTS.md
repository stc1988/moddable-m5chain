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
