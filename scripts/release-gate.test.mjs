import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  checkRequiredDocs,
  findForbiddenHardDeleteCalls,
  readVersionSources,
  validateLatestJson,
  validateVersionSync,
  runReleaseGate
} from "./release-gate.mjs";

describe("release gate checks", () => {
  it("collects version sources and accepts synchronized versions", async () => {
    const root = await createProjectFixture({
      versions: {
        packageJson: "0.1.0-beta.2",
        sidecarPackageJson: "0.1.0-beta.2",
        sharedConstants: "0.1.0-beta.2",
        tauriConf: "0.1.0-beta.2",
        cargoToml: "0.1.0-beta.2"
      }
    });

    const sources = await readVersionSources(root);

    expect(sources.map((source) => [source.name, source.version])).toEqual([
      ["package.json", "0.1.0-beta.2"],
      ["sidecar/package.json", "0.1.0-beta.2"],
      ["shared/constants.ts", "0.1.0-beta.2"],
      ["src-tauri/tauri.conf.json", "0.1.0-beta.2"],
      ["src-tauri/Cargo.toml", "0.1.0-beta.2"]
    ]);
    expect(validateVersionSync(sources)).toEqual([]);
  });

  it("reports all version values when a source drifts", async () => {
    const sources = [
      { name: "package.json", version: "0.1.0-beta.2" },
      { name: "shared/constants.ts", version: "0.1.0-beta.1" }
    ];

    expect(validateVersionSync(sources)).toEqual([
      "Version mismatch: package.json=0.1.0-beta.2, shared/constants.ts=0.1.0-beta.1"
    ]);
  });

  it("accepts an expected release version when all version sources match it", async () => {
    const root = await createProjectFixture({
      versions: {
        packageJson: "0.1.0-beta.2",
        sidecarPackageJson: "0.1.0-beta.2",
        sharedConstants: "0.1.0-beta.2",
        tauriConf: "0.1.0-beta.2",
        cargoToml: "0.1.0-beta.2"
      }
    });

    await writeRequiredDocs(root);

    await expect(
      runReleaseGate({
        rootDir: root,
        expectedVersion: "0.1.0-beta.2",
        hardDeleteScanPaths: []
      })
    ).resolves.toMatchObject({
      issues: []
    });
  });

  it("reports when an expected release version differs from the synced project version", async () => {
    const root = await createProjectFixture({
      versions: {
        packageJson: "0.1.0-beta.2",
        sidecarPackageJson: "0.1.0-beta.2",
        sharedConstants: "0.1.0-beta.2",
        tauriConf: "0.1.0-beta.2",
        cargoToml: "0.1.0-beta.2"
      }
    });

    await writeRequiredDocs(root);

    await expect(
      runReleaseGate({
        rootDir: root,
        expectedVersion: "0.1.0-beta.3",
        hardDeleteScanPaths: []
      })
    ).resolves.toMatchObject({
      issues: [
        "Expected release version 0.1.0-beta.3 does not match version sources: package.json=0.1.0-beta.2, sidecar/package.json=0.1.0-beta.2, shared/constants.ts=0.1.0-beta.2, src-tauri/tauri.conf.json=0.1.0-beta.2, src-tauri/Cargo.toml=0.1.0-beta.2"
      ]
    });
  });

  it("finds runtime hard-delete filesystem APIs but ignores test cleanup files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "raw-pair-release-gate-"));
    await mkdir(path.join(root, "sidecar", "src"), { recursive: true });
    await mkdir(path.join(root, "sidecar", "tests"), { recursive: true });
    await writeFile(
      path.join(root, "sidecar", "src", "danger.ts"),
      'import { unlink } from "node:fs/promises";\nawait unlink("/photos/IMG_0001.CR3");\n',
      "utf8"
    );
    await writeFile(
      path.join(root, "sidecar", "tests", "cleanup.test.ts"),
      'import { rm } from "node:fs/promises";\nawait rm(tmp, { recursive: true });\n',
      "utf8"
    );

    expect(await findForbiddenHardDeleteCalls(root, ["sidecar"])).toEqual([
      {
        file: "sidecar/src/danger.ts",
        line: 1,
        match: 'import { unlink } from "node:fs/promises";'
      },
      {
        file: "sidecar/src/danger.ts",
        line: 2,
        match: 'await unlink("/photos/IMG_0001.CR3");'
      }
    ]);
  });

  it("validates updater latest.json shape and signature placement", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "raw-pair-latest-gate-"));
    const latestPath = path.join(root, "latest.json");
    await writeFile(
      latestPath,
      JSON.stringify({
        version: "0.1.0-beta.2",
        notes: "Internal beta",
        pub_date: "2026-05-26T00:00:00.000Z",
        platforms: {
          "darwin-aarch64": {
            signature: "trusted-signature-text",
            url: "https://github.com/ywandy/raw-pair-cleaner-lite/releases/download/v0.1.0-beta.2/raw-pair-cleaner-lite_0.1.0-beta.2_darwin-aarch64.app.tar.gz"
          }
        }
      }),
      "utf8"
    );

    expect(await validateLatestJson(latestPath, { expectedVersion: "0.1.0-beta.2" })).toEqual([]);
  });

  it("rejects latest.json with URL signatures or non-HTTPS artifacts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "raw-pair-latest-gate-"));
    const latestPath = path.join(root, "latest.json");
    await writeFile(
      latestPath,
      JSON.stringify({
        version: "0.1.0-beta.2",
        platforms: {
          "darwin-aarch64": {
            signature: "https://example.com/app.tar.gz.sig",
            url: "http://example.com/app.tar.gz"
          }
        }
      }),
      "utf8"
    );

    expect(await validateLatestJson(latestPath, { expectedVersion: "0.1.0-beta.1" })).toEqual([
      "latest.json version 0.1.0-beta.2 does not match expected 0.1.0-beta.1.",
      "latest.json platform darwin-aarch64 url must be HTTPS.",
      "latest.json platform darwin-aarch64 signature must be raw .sig text, not a URL."
    ]);
  });

  it("reports required updater platforms missing from latest.json through the release gate", async () => {
    const root = await createProjectFixture({
      versions: {
        packageJson: "0.1.0-beta.2",
        sidecarPackageJson: "0.1.0-beta.2",
        sharedConstants: "0.1.0-beta.2",
        tauriConf: "0.1.0-beta.2",
        cargoToml: "0.1.0-beta.2"
      }
    });
    await writeRequiredDocs(root);
    await mkdir(path.join(root, "dist-release"), { recursive: true });
    await writeFile(
      path.join(root, "dist-release", "latest.json"),
      JSON.stringify({
        version: "0.1.0-beta.2",
        platforms: {
          "darwin-aarch64": {
            signature: "trusted-signature-text",
            url: "https://github.com/ywandy/raw-pair-cleaner-lite/releases/download/v0.1.0-beta.2/raw-pair-cleaner-lite_0.1.0-beta.2_darwin-aarch64.app.tar.gz"
          }
        }
      }),
      "utf8"
    );

    await expect(
      runReleaseGate({
        rootDir: root,
        hardDeleteScanPaths: [],
        requiredPlatforms: "darwin-aarch64,darwin-x86_64,windows-x86_64"
      })
    ).resolves.toMatchObject({
      issues: [
        "latest.json is missing required platform darwin-x86_64.",
        "latest.json is missing required platform windows-x86_64."
      ]
    });
  });

  it("reports missing release-readiness documents", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "raw-pair-docs-gate-"));
    await mkdir(path.join(root, "docs"), { recursive: true });
    await writeFile(path.join(root, "docs", "UPDATER_RELEASE.md"), "# Updater\n", "utf8");

    expect(
      await checkRequiredDocs(root, [
        "docs/UPDATER_RELEASE.md",
        "docs/INTERNAL_RELEASE_CHECKLIST.md",
        "docs/PRODUCTION_DISTRIBUTION.md"
      ])
    ).toEqual(["Required release document is missing: docs/INTERNAL_RELEASE_CHECKLIST.md", "Required release document is missing: docs/PRODUCTION_DISTRIBUTION.md"]);
  });
});

async function createProjectFixture({ versions }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "raw-pair-version-gate-"));
  await mkdir(path.join(root, "sidecar"), { recursive: true });
  await mkdir(path.join(root, "shared"), { recursive: true });
  await mkdir(path.join(root, "src-tauri"), { recursive: true });
  await writeFile(path.join(root, "package.json"), JSON.stringify({ version: versions.packageJson }), "utf8");
  await writeFile(path.join(root, "sidecar", "package.json"), JSON.stringify({ version: versions.sidecarPackageJson }), "utf8");
  await writeFile(path.join(root, "shared", "constants.ts"), `export const APP_VERSION = "${versions.sharedConstants}";\n`, "utf8");
  await writeFile(path.join(root, "src-tauri", "tauri.conf.json"), JSON.stringify({ version: versions.tauriConf }), "utf8");
  await writeFile(path.join(root, "src-tauri", "Cargo.toml"), `[package]\nversion = "${versions.cargoToml}"\n`, "utf8");
  return root;
}

async function writeRequiredDocs(root) {
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, "docs", "UPDATER_RELEASE.md"), "# Updater\n", "utf8");
  await writeFile(path.join(root, "docs", "INTERNAL_RELEASE_CHECKLIST.md"), "# Checklist\n", "utf8");
  await writeFile(path.join(root, "docs", "PRODUCTION_DISTRIBUTION.md"), "# Distribution\n", "utf8");
}
