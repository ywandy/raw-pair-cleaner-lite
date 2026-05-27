# RAW Pair Cleaner Lite

Tauri v2 + React + TypeScript + TailwindCSS skeleton for the RAW Pair Cleaner
rebuild. The product plan is kept in `REBUILD_PLAN.md`.

## Current Scope

This repository currently implements the Tauri sidecar rebuild through the local
updater packaging pass:

- Tauri v2 desktop shell with dialog, shell, updater, and process plugins wired.
- pnpm workspace with a Node.js sidecar subproject.
- `scan`, `trash`, `settings-get`, and `settings-save` sidecar commands
  packaged with `@yao-pkg/pkg`.
- `scan --request <file>` sidecar command with JPG/RAW/sidecar classification,
  directory-mode detection, key matching, conflict exclusion, and delete-candidate
  generation.
- Delete manifests, safe manifest-subset validation, system Trash deletion, and
  JSON delete logs.
- Real Tauri directory selection, scan, settings persistence, and updater bridge.
- Tauri `externalBin` staging for the current target triple.
- Migrated React UI with mock fallback for browser-only development.
- Signed updater artifact generation and `latest.json` generation scripts.

## Commands

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build:sidecar
pnpm stage:sidecar
pnpm dev
pnpm build
pnpm build:updater
pnpm collect:release
pnpm latest:updater
```

`pnpm build` currently produces the macOS `.app` bundle. `pnpm build:updater`
requires `TAURI_SIGNING_PRIVATE_KEY` and produces a signed updater archive. See
`docs/UPDATER_RELEASE.md`. Internal release validation is tracked in
`docs/INTERNAL_RELEASE_CHECKLIST.md`.

## Sidecar

```bash
pnpm --filter ./sidecar test
pnpm build:sidecar
pnpm stage:sidecar
./src-tauri/binaries/raw-pair-sidecar-aarch64-apple-darwin scan --request /tmp/scan-request.json
./src-tauri/binaries/raw-pair-sidecar-aarch64-apple-darwin trash --request /tmp/trash-request.json
```

On macOS, ad-hoc builds disable hardened runtime because the packaged
Node.js sidecar fails under hardened runtime without production entitlements. The
formal signing/notarization round must revisit this and add the correct entitlements.
