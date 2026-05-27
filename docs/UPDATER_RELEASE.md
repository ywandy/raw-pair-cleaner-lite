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

This currently produces:

```txt
src-tauri/target/release/bundle/macos/RAW Pair Cleaner.app.tar.gz
src-tauri/target/release/bundle/macos/RAW Pair Cleaner.app.tar.gz.sig
```

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

The release workflow performs this per platform and publishes `latest.json` with
the release assets.

Before publishing, run the local release gate against the generated manifest:

```bash
pnpm release:check -- --latest-path dist-release/latest.json
```

## Current Endpoint

The app checks:

```txt
https://github.com/ywandy/raw-pair-cleaner-lite/releases/latest/download/latest.json
```

For the beta.1 to beta.2 test, publish the beta.2 updater artifact and generated
`latest.json` to a GitHub Release. A full install test still needs two released
versions: an installed beta.1 client and a signed beta.2 update.
