# Build FurryFly

Build each package on its target OS and architecture. The native addons are
compiled for Electron's ABI; you cannot reuse another architecture's `node_modules`.
Check `node -p "process.platform + '-' + process.arch"` before installing.

## Prerequisites

- **All platforms:** Node.js **22.12+** (Node 22 LTS in CI), Git, and Python 3.10+.
- **macOS arm64 and x64:** Xcode Command Line Tools (`xcode-select --install`).
  Use arm64 Node on Apple Silicon and x64 Node on an Intel machine. The
  addons do not need Homebrew's GMP or libunbound.
- **Windows x64:** Visual Studio 2022 or later with *Desktop development with
  C++*, MSVC, and a Windows SDK. Use x64 Node.
- **Windows ARM64:** Windows 11 on ARM, native ARM64 Node, and Visual Studio
  2022 17.4 or later with ARM64 C++ tools and ARM64 ATL. Use a Windows 11 SDK
  with `setupapi.lib` for ARM64, e.g. 10.0.22621 or 10.0.26100. CI uses Visual
  Studio 2026 with the pinned `node-gyp` 12.4 and does not depend on npm's
  bundled `node-gyp` detecting that toolchain.

## Install and test

```sh
npm ci --ignore-scripts
npm run postinstall
npm test
```

The explicit postinstall builds all six native addons. Electron's executable
is downloaded on first use. If Git attempts to use SSH for public lockfile
URLs and your environment cannot access that transport, use Git's HTTPS
rewrite for the install:

```sh
git config --global url.https://github.com/.insteadOf ssh://git@github.com/
```

The source tests use disposable regtest profiles. For packaged tests, ensure
the temporary volume has enough disk space; set `TMPDIR` on macOS or `TEMP`
on Windows to move scratch data to another volume.

## Package and verify

| Host | Command | Output directory | Installer |
| --- | --- | --- | --- |
| Apple Silicon | `npm run package-mac` | `release/darwin-arm64/` | `.dmg` |
| Intel Mac | `npm run package-mac` | `release/darwin-x64/` | `.dmg` |
| Windows ARM64 | `npm run package-win` | `release/win32-arm64/` | NSIS `.exe` |
| Windows x64 | `npm run package-win` | `release/win32-x64/` | `.msi` |

`npm run package-dir` creates just the unpacked application. After either type
of build, run `npm run test:packaged-app`. It checks the bundled Electron
version and architecture, loads all six compiled addons, and runs a GUI and
local-node smoke test with a disposable regtest profile. macOS additionally
checks that the packaged `goosig` does not link system GMP.

All build commands require a clean Git worktree so the packaged provenance can
identify the exact source commit. GitHub Actions uploads installers with their
SHA-256 checksums. CI macOS bundles are ad-hoc signed, **not** Developer ID
signed or notarized; Windows CI installers are not Authenticode-signed.

The Windows ARM64 application and addons are native ARM64. Its NSIS setup
program is a bootstrap executable; the existing x64 `.msi` remains separate
because this version of electron-builder cannot emit a native ARM64 MSI.

## Development

`npm run dev` serves the renderer with hot reload; `npm run start-main-dev`
runs the compiled main process with its inspector on port 5858. `npm start`
compiles and launches a production-mode source build.

## Troubleshooting

- **`MSB8036` (Windows SDK not found):** verify that Visual Studio Installer
  installed a Windows SDK and the C++ tools matching the target architecture.
- **`unbound.h` not found:** use `npm ci --ignore-scripts` followed by the
  explicit postinstall. `unbound` needs an external library and is optional;
  the app uses the JavaScript resolver without it.
- **Wrong native architecture or ABI:** reinstall from scratch using native
  Node on the target OS and rerun the explicit postinstall. Do not reuse a
  dependency directory across platforms or architectures.
