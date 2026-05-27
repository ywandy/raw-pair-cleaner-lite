import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { DeleteManifest, TrashRequest } from "../../shared/protocol";
import { runScanCommand } from "../src/commands/scan";
import { runTrashCommand } from "../src/commands/trash";

describe("delete manifest and trash safety", () => {
  it("writes a delete manifest when scan produces candidates", async () => {
    const fixture = await createFixture();
    try {
      const scanResult = await runScanCommand(fixture.scanRequestPath);

      expect(scanResult.manifestPath).toBe(path.join(fixture.dataDir, "manifests", "scan_manifest_test.json"));

      const manifest = JSON.parse(await readFile(scanResult.manifestPath!, "utf8")) as DeleteManifest;
      expect(manifest).toMatchObject({
        scanId: "scan_manifest_test",
        rootPath: fixture.root,
        deleteMode: "jpg_as_source_delete_raw",
        candidates: [
          {
            path: path.join(fixture.root, "raw", "IMG_9999.CR3"),
            size: 6
          }
        ]
      });
      expect(typeof manifest.createdAt).toBe("string");
      expect(manifest.candidates[0].modifiedAt).toBeGreaterThan(0);
    } finally {
      await fixture.cleanup();
    }
  });

  it("moves selected manifest candidates to trash with an injected trash adapter", async () => {
    const fixture = await createFixture();
    try {
      const scanResult = await runScanCommand(fixture.scanRequestPath);
      const selectedPath = scanResult.deleteCandidates[0].path;
      const selectedSize = scanResult.deleteCandidates[0].size;
      const moved: string[] = [];

      const result = await runTrashCommand(await writeTrashRequest(fixture, selectedPath, selectedSize), {
        moveFileToTrash: async (filePath) => {
          moved.push(filePath);
        }
      });

      expect(moved).toEqual([selectedPath]);
      expect(result).toMatchObject({
        taskId: "trash_manifest_test",
        scanId: "scan_manifest_test",
        total: 1,
        successCount: 1,
        failedCount: 0,
        releasedSize: selectedSize,
        items: [
          {
            path: selectedPath,
            size: selectedSize,
            status: "moved_to_trash"
          }
        ]
      });
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects selected files that are not in the scan manifest", async () => {
    const fixture = await createFixture();
    try {
      await runScanCommand(fixture.scanRequestPath);
      const nonCandidate = path.join(fixture.root, "raw", "IMG_0001.CR3");

      await expect(
        runTrashCommand(await writeTrashRequest(fixture, nonCandidate, 3), {
          moveFileToTrash: async () => {
            throw new Error("should not move");
          }
        })
      ).rejects.toThrow("not part of the scan manifest");
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects candidates that changed after scanning", async () => {
    const fixture = await createFixture();
    try {
      const scanResult = await runScanCommand(fixture.scanRequestPath);
      const selectedPath = scanResult.deleteCandidates[0].path;
      await writeFile(selectedPath, "changed");

      await expect(
        runTrashCommand(await writeTrashRequest(fixture, selectedPath, scanResult.deleteCandidates[0].size), {
          moveFileToTrash: async () => {
            throw new Error("should not move");
          }
        })
      ).rejects.toThrow("changed since the last scan");
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects manifest candidates whose real path escapes the root", async () => {
    const fixture = await createFixture();
    try {
      const scanResult = await runScanCommand(fixture.scanRequestPath);
      const manifestPath = scanResult.manifestPath!;
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as DeleteManifest;
      const outsideFile = path.join(fixture.base, "outside.CR3");
      await writeFile(outsideFile, "outside");
      const outsideStats = await stat(outsideFile);
      manifest.candidates = [
        {
          path: outsideFile,
          size: outsideStats.size,
          modifiedAt: outsideStats.mtimeMs
        }
      ];
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

      await expect(
        runTrashCommand(await writeTrashRequest(fixture, outsideFile, outsideStats.size), {
          moveFileToTrash: async () => {
            throw new Error("should not move");
          }
        })
      ).rejects.toThrow("outside the scan root");
    } finally {
      await fixture.cleanup();
    }
  });
});

async function createFixture(): Promise<{
  base: string;
  dataDir: string;
  root: string;
  scanRequestPath: string;
  cleanup: () => Promise<void>;
}> {
  const base = await mkdtemp(path.join(os.tmpdir(), "raw-pair-manifest-trash-"));
  const root = path.join(base, "中文 Shoot");
  const dataDir = path.join(base, "app data");
  await mkdir(path.join(root, "jpg"), { recursive: true });
  await mkdir(path.join(root, "raw"), { recursive: true });
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(root, "jpg", "IMG_0001.jpg"), "jpg");
  await writeFile(path.join(root, "raw", "IMG_0001.CR3"), "raw");
  await writeFile(path.join(root, "raw", "IMG_9999.CR3"), "orphan");

  const scanRequestPath = path.join(base, "scan-request.json");
  await writeFile(
    scanRequestPath,
    JSON.stringify({
      protocolVersion: 1,
      taskId: "scan_manifest_test",
      rootPath: root,
      deleteMode: "jpg_as_source_delete_raw",
      dataDir,
      options: {
        recursive: true,
        includeHiddenFiles: false,
        ignoreCase: true
      }
    }),
    "utf8"
  );

  return {
    base,
    dataDir,
    root,
    scanRequestPath,
    cleanup: () => rm(base, { recursive: true, force: true })
  };
}

async function writeTrashRequest(
  fixture: { base: string; dataDir: string; root: string },
  filePath: string,
  size: number
): Promise<string> {
  const request: TrashRequest = {
    protocolVersion: 1,
    taskId: "trash_manifest_test",
    scanId: "scan_manifest_test",
    rootPath: fixture.root,
    dataDir: fixture.dataDir,
    confirmed: true,
    selectedFiles: [
      {
        path: filePath,
        size
      }
    ]
  };
  const requestPath = path.join(fixture.base, `trash-request-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(requestPath, JSON.stringify(request), "utf8");

  return requestPath;
}
