# Updater Release Notes

This project uses the Tauri v2 updater. Updater signing is separate from Apple
Developer ID signing and notarization.

## Local Key

The current local updater key was generated at:

```txt
~/.tauri/raw-pair-cleaner-lite.key
~/.tauri/raw-pair-cleaner-lite.key.pub
```

The public key is stored in `src-tauri/tauri.conf.json`. The private key must
not be committed. Back it up before publishing any updater-enabled build.

For a production key, prefer a password-protected key and store these CI secrets:

```txt
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

## Build Signed Updater Artifact

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/raw-pair-cleaner-lite.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
pnpm build:updater
```

On macOS this currently produces:

```txt
src-tauri/target/release/bundle/macos/RAW Pair Cleaner.app.tar.gz
src-tauri/target/release/bundle/macos/RAW Pair Cleaner.app.tar.gz.sig
```

On Windows x64 CI builds, the release workflow uses the NSIS bundle as the
updater channel. The generated updater artifact is represented in
`latest.json` as `windows-x86_64`; MSI artifacts are not part of the current
internal beta update channel.

## Generate latest.json

```bash
RAW_PAIR_UPDATE_BASE_URL="https://github.com/ywandy/raw-pair-cleaner-lite/releases/download/v0.1.0-beta.2" \
pnpm latest:updater
```

The script scans the bundle directory for updater artifacts and reads the actual
`.sig` contents. It does not hard-code artifact filenames.

For GitHub Release assets, collect flat, unique filenames first:

```bash
pnpm collect:release -- --root src-tauri/target/release/bundle --out dist-release
RAW_PAIR_UPDATE_BASE_URL="https://github.com/ywandy/raw-pair-cleaner-lite/releases/download/v0.1.0-beta.2" \
pnpm latest:updater -- --artifacts dist-release --out dist-release/latest.json
```

The release workflow currently builds macOS arm64, macOS x64, and Windows x64
NSIS assets. Pushes to `main` and manual workflow runs upload signed internal
beta assets as GitHub Actions artifacts only. Pushing a `v*` tag builds the same
assets, generates `latest.json`, validates it, and uploads the assets to a
formal GitHub Release.

Before publishing, run the local release gate against the generated manifest:

```bash
pnpm release:check -- --latest-path dist-release/latest.json --required-platforms darwin-aarch64,darwin-x86_64,windows-x86_64
```

The required platform gate prevents publishing a tag release whose manifest is
missing one of the internal beta updater targets.

## Current Endpoint

The app checks:

```txt
https://gh-pxy.ywandy.top/https://github.com/ywandy/raw-pair-cleaner-lite/releases/latest/download/latest.json
```

The default runtime setting prefixes the canonical GitHub endpoint with the
release proxy because direct GitHub release downloads can be slow or
unreachable on some networks. Clearing the update connection prefix in settings
checks the canonical endpoint directly. In both modes, the endpoint still
resolves GitHub's latest release, so ordinary `main` pushes and manual builds
are not visible to updater clients. Only a formal release created from a `v*`
tag can change the version seen by the app.

For the beta.1 to beta.2 test, push a `v0.1.0-beta.2` tag after all version
sources are updated to `0.1.0-beta.2`. The release gate checks that the tag
version, project version sources, and generated `latest.json` version match. A
full install test still needs two released versions: an installed beta.1 client
and a signed beta.2 update. Windows acceptance should use the NSIS installer,
then confirm settings, scan, Trash, update install, relaunch, and packaged
sidecar execution after the update.
