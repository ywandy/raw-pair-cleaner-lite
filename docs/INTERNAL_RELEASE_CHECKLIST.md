# Internal Release Checklist

This checklist tracks the internal beta release loop. The current CI release
scope is macOS arm64 and macOS x64; Windows remains deferred until the macOS
update loop is proven. PR-09 production distribution gates are tracked in
`docs/PRODUCTION_DISTRIBUTION.md`.

## Build Matrix

| Platform | Runner | Tauri target | Status |
|---|---|---|---|
| macOS arm64 | `macos-14` | `aarch64-apple-darwin` | CI build configured for `main`, manual, and `v*` tag runs; local build and smoke verified |
| macOS x64 | `macos-15-intel` | `x86_64-apple-darwin` | CI build configured for `main`, manual, and `v*` tag runs; physical install pending |
| Windows x64 | deferred | `x86_64-pc-windows-msvc` | Deferred until macOS arm64 update loop is proven |
| Linux x64 | not in release matrix | `x86_64-unknown-linux-gnu` | Experimental only; Trash behavior not committed |

## Local macOS arm64 Evidence

Last verified on 2026-05-26:

```txt
pnpm test
pnpm typecheck
pnpm release:check
cargo test
pnpm build
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/raw-pair-cleaner-lite.key)" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" pnpm build:updater
RAW_PAIR_UPDATE_BASE_URL="https://github.com/ywandy/raw-pair-cleaner-lite/releases/download/v0.1.0-beta.1" pnpm latest:updater
```

Artifacts:

```txt
src-tauri/target/release/bundle/macos/RAW Pair Cleaner.app
src-tauri/target/release/bundle/macos/RAW Pair Cleaner.app.tar.gz
src-tauri/target/release/bundle/macos/RAW Pair Cleaner.app.tar.gz.sig
dist-release/latest.json
```

Observed sizes:

```txt
RAW Pair Cleaner.app: 60M
RAW Pair Cleaner.app.tar.gz: 23M
raw-pair-sidecar inside app: 45M
```

Smoke result:

```txt
Packaged sidecar scan: matchedCount=1
Packaged sidecar trash: successCount=1, source candidate removed from original path
Settings save/get: verified through packaged sidecar
Delete log: generated and read successfully
```

## Internal Tester Flow

For macOS ad-hoc builds:

1. Download the `.dmg` from the draft GitHub Release.
2. Drag `RAW Pair Cleaner.app` into Applications.
3. If Gatekeeper blocks launch, right-click the app and choose Open, then confirm.
4. Test a temporary fixture folder first, not real photo archives.
5. Verify:
   - Directory picker opens.
   - Scan finds matched pairs and orphan candidates.
   - Conflicts are not selected for deletion.
   - Delete confirmation appears before moving files.
   - Selected candidates move to system Trash.
   - JSON delete log is written when enabled in settings.
   - Settings persist after restart.
   - Check for updates reports the expected state for the current release channel.

## GitHub Release Flow

The release workflow has two modes:

1. `main` push or manual `workflow_dispatch` builds signed macOS updater
   assets and uploads them as GitHub Actions artifacts.
2. `v*` tag push builds the same assets, validates the tag version against all
   project version sources, generates `latest.json`, creates a formal GitHub
   Release, and uploads the assets.

The app reads updates from:

```txt
https://github.com/ywandy/raw-pair-cleaner-lite/releases/latest/download/latest.json
```

Only tag-created formal releases affect this endpoint. Actions artifacts from
ordinary `main` pushes are build evidence only and are not visible to updater
clients.

## Pending PR-08 Evidence

These must be filled from CI runs or physical machines before considering the
current macOS release loop accepted:

| Platform | Install opens | Scan | Trash | Logs | Settings | Updater check | Signed update install |
|---|---|---|---|---|---|---|---|
| macOS arm64 | pending tester pass | local sidecar smoke | local sidecar smoke | local sidecar smoke | local sidecar smoke | pending release | pending beta.1 -> beta.2 |
| macOS x64 | pending | pending | pending | pending | pending | pending release | pending beta.1 -> beta.2 |
| Windows x64 | deferred | deferred | deferred | deferred | deferred | deferred | deferred |

Signed update install and tamper rejection require two published releases:

```txt
1. Install v0.1.0-beta.1.
2. Publish v0.1.0-beta.2 updater artifacts and latest.json.
3. Confirm beta.1 detects beta.2, downloads, installs, relaunches, and sidecar still runs.
4. Replace the updater archive with modified bytes while keeping the original signature.
5. Confirm the updater rejects the tampered package.
```
