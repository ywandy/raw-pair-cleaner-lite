import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildLatestJson,
  createReleaseArtifactName,
  discoverUpdaterArtifacts,
  inferUpdaterPlatform
} from "./updater-utils.mjs";

describe("updater latest.json utilities", () => {
  it("infers updater platform names from artifact paths", () => {
    expect(inferUpdaterPlatform("macos/RAW Pair Cleaner_0.1.0-beta.2_aarch64.app.tar.gz")).toBe("darwin-aarch64");
    expect(inferUpdaterPlatform("macos/RAW Pair Cleaner_0.1.0-beta.2_x64.app.tar.gz")).toBe("darwin-x86_64");
    expect(inferUpdaterPlatform("macos/RAW Pair Cleaner.app.tar.gz", "darwin", "arm64")).toBe("darwin-aarch64");
    expect(inferUpdaterPlatform("raw-pair-cleaner-lite_0.1.0-beta.2_darwin-aarch64.app.tar.gz", "linux", "x64")).toBe("darwin-aarch64");
    expect(inferUpdaterPlatform("nsis/RAW Pair Cleaner_0.1.0-beta.2_x64-setup.nsis.zip")).toBe("windows-x86_64");
    expect(inferUpdaterPlatform("appimage/raw-pair-cleaner-lite_0.1.0-beta.2_amd64.AppImage.tar.gz")).toBe("linux-x86_64");
  });

  it("creates flat release artifact names that keep updater suffixes", () => {
    expect(
      createReleaseArtifactName({
        version: "0.1.0-beta.2",
        platform: "darwin-aarch64",
        artifactPath: "macos/RAW Pair Cleaner.app.tar.gz"
      })
    ).toBe("raw-pair-cleaner-lite_0.1.0-beta.2_darwin-aarch64.app.tar.gz");
    expect(
      createReleaseArtifactName({
        version: "0.1.0-beta.2",
        platform: "windows-x86_64",
        artifactPath: "nsis/RAW Pair Cleaner_0.1.0-beta.2_x64-setup.nsis.zip"
      })
    ).toBe("raw-pair-cleaner-lite_0.1.0-beta.2_windows-x86_64.nsis.zip");
  });

  it("discovers signed artifacts and builds latest.json without hard-coded filenames", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "raw-pair-latest-json-"));
    try {
      const artifactPath = path.join(root, "macos", "RAW Pair Cleaner_0.1.0-beta.2_aarch64.app.tar.gz");
      await mkdir(path.dirname(artifactPath), { recursive: true });
      await writeFile(artifactPath, "artifact");
      await writeFile(`${artifactPath}.sig`, "signature-text\n");

      const artifacts = await discoverUpdaterArtifacts(root);
      expect(artifacts).toEqual([
        {
          platform: "darwin-aarch64",
          absolutePath: artifactPath,
          relativePath: "macos/RAW Pair Cleaner_0.1.0-beta.2_aarch64.app.tar.gz",
          signature: "signature-text"
        }
      ]);

      const latest = buildLatestJson({
        version: "0.1.0-beta.2",
        notes: "Signed update test",
        pubDate: "2026-05-26T00:00:00.000Z",
        baseUrl: "https://github.com/ywandy/raw-pair-cleaner-lite/releases/download/v0.1.0-beta.2",
        artifacts
      });

      expect(latest).toEqual({
        version: "0.1.0-beta.2",
        notes: "Signed update test",
        pub_date: "2026-05-26T00:00:00.000Z",
        platforms: {
          "darwin-aarch64": {
            signature: "signature-text",
            url: "https://github.com/ywandy/raw-pair-cleaner-lite/releases/download/v0.1.0-beta.2/macos/RAW%20Pair%20Cleaner_0.1.0-beta.2_aarch64.app.tar.gz"
          }
        }
      });
    } finally {
      await import("node:fs/promises").then(({ rm }) => rm(root, { recursive: true, force: true }));
    }
  });
});
