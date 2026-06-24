# Production Distribution Gate

This document tracks PR-09 readiness. It does not mark production distribution as
complete; it defines the checks that must pass before RAW Pair Cleaner Lite is
promoted beyond internal beta builds.

## Current Status

The project is ready for internal, ad-hoc beta packaging only. The GitHub
release workflow currently builds macOS arm64, macOS x64, and Windows x64 NSIS
internal beta assets. Public production distribution remains blocked by
external credentials and real platform evidence:

- Apple Developer Program access.
- Developer ID Application signing identity.
- Apple notarization credentials.
- COS or CDN bucket credentials and final production base URL.
- Real beta.1 to beta.2 updater install test.
- Tampered updater artifact rejection test.
- Physical macOS x64 and Windows x64 install, scan, Trash, settings, log, and
  update checks.
- Windows production code-signing and SmartScreen readiness.

Do not advertise the macOS build as smooth for ordinary users until Developer ID
signing and notarization are proven. Tauri updater signatures verify update
origin only; they do not replace Apple signing or notarization.

Do not advertise the Windows build as production-ready until installer signing,
SmartScreen behavior, and real-machine update evidence are proven. The internal
beta update channel uses NSIS as the single `windows-x86_64` updater artifact.

## Local Release Gates

Run these before preparing a tag or release:

```bash
pnpm version:check
pnpm release:check
pnpm test
pnpm typecheck
cargo test --manifest-path src-tauri/Cargo.toml
pnpm build
```

After signed updater artifacts are collected and `latest.json` is generated,
validate the concrete update manifest:

```bash
pnpm release:check -- --latest-path dist-release/latest.json --required-platforms darwin-aarch64,darwin-x86_64,windows-x86_64
```

The release gate verifies:

- version sync across `package.json`, `sidecar/package.json`,
  `shared/constants.ts`, `src-tauri/tauri.conf.json`, and
  `src-tauri/Cargo.toml`;
- absence of runtime hard-delete filesystem APIs in app, shared, sidecar, and
  Rust bridge source paths;
- required release-readiness docs;
- HTTPS updater artifact URLs and raw `.sig` text inside `latest.json` when a
  manifest is present.

## Production Secrets

Required for signed updater builds:

```txt
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

Required for COS or CDN publication:

```txt
COS_SECRET_ID
COS_SECRET_KEY
COS_BUCKET
COS_REGION
COS_CDN_BASE_URL
```

Required for macOS production distribution:

```txt
APPLE_CERTIFICATE
APPLE_CERTIFICATE_PASSWORD
APPLE_SIGNING_IDENTITY
APPLE_ID
APPLE_PASSWORD
APPLE_TEAM_ID
```

Store these only in the release environment or CI secret store. Do not commit
private keys, signing certificates, notarization credentials, generated
keychains, or local `.env` files.

## Production Asset Layout

Use a stable HTTPS base URL, for example:

```txt
https://download.example.com/raw-pair-cleaner-lite/releases/vX.Y.Z/
```

Publish all installer artifacts, updater archives, updater `.sig` files, and
the generated `latest.json` under the same release namespace. The updater
manifest must contain the raw signature text from each `.sig` file, not a URL to
the signature file.

When switching from GitHub Release testing to production CDN updates:

1. Build signed updater artifacts for every supported platform.
2. Collect release artifacts with `pnpm collect:release`.
3. Generate `latest.json` with `RAW_PAIR_UPDATE_BASE_URL` pointing at the final
   production HTTPS release URL.
4. Run `pnpm release:check -- --latest-path dist-release/latest.json`.
5. Upload artifacts and `latest.json` to COS or CDN.
6. Install the previous public version and verify it updates to the new version.
7. Tamper with a copied updater archive while keeping the original signature and
   verify installation is rejected.

## macOS Production Checklist

Before public macOS promotion:

- enable Developer ID Application signing for the app bundle and sidecar;
- revisit hardened runtime and entitlements for the packaged Node sidecar;
- notarize the DMG or app bundle and staple the notarization ticket when
  applicable;
- verify a fresh browser download opens without the unknown-developer blocking
  flow;
- verify the sidecar still launches after signing, notarization, update install,
  and relaunch;
- record evidence in `docs/INTERNAL_RELEASE_CHECKLIST.md`.

Current caveat: hardened runtime is disabled for the local beta build because
the packaged Node sidecar failed under hardened runtime during local testing.
This must be solved before production macOS distribution.
