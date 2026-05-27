import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DEFAULT_RELEASE_PROXY_PREFIX, DEFAULT_SETTINGS } from "../../shared/constants";
import type { TrashRequest } from "../../shared/protocol";
import { runScanCommand } from "../src/commands/scan";
import { runSettingsGetCommand } from "../src/commands/settingsGet";
import { runSettingsSaveCommand } from "../src/commands/settingsSave";
import { runTrashCommand } from "../src/commands/trash";

describe("settings and delete logs", () => {
  it("returns default settings and saves merged settings in the sidecar data directory", async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), "raw-pair-settings-"));
    try {
      const dataDir = path.join(base, "app data");
      await mkdir(dataDir, { recursive: true });

      const getRequestPath = await writeRequest(base, "settings-get", {
        protocolVersion: 1,
        taskId: "settings_get_test",
        dataDir
      });
      expect(await runSettingsGetCommand(getRequestPath)).toEqual(DEFAULT_SETTINGS);

      const saveRequestPath = await writeRequest(base, "settings-save", {
        protocolVersion: 1,
        taskId: "settings_save_test",
        dataDir,
        settings: {
          scan: {
            recursive: false
          },
          updates: {
            releaseProxyPrefix: "   "
          }
        }
      });
      const saved = await runSettingsSaveCommand(saveRequestPath);

      expect(saved.scan.recursive).toBe(false);
      expect(saved.scan.includeHiddenFiles).toBe(DEFAULT_SETTINGS.scan.includeHiddenFiles);
      expect(saved.updates.releaseProxyPrefix).toBe(DEFAULT_RELEASE_PROXY_PREFIX);
      expect(JSON.parse(await readFile(path.join(dataDir, "settings.json"), "utf8"))).toEqual(saved);
      expect(await runSettingsGetCommand(getRequestPath)).toEqual(saved);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it("writes a delete log when trash request enables logging", async () => {
    const fixture = await createTrashFixture();
    try {
      const scanResult = await runScanCommand(fixture.scanRequestPath);
      const selected = scanResult.deleteCandidates[0];
      const trashRequestPath = await writeRequest(fixture.base, "trash", {
        protocolVersion: 1,
        taskId: "trash_log_test",
        scanId: scanResult.scanId,
        rootPath: fixture.root,
        dataDir: fixture.dataDir,
        confirmed: true,
        generateLog: true,
        selectedFiles: [
          {
            path: selected.path,
            size: selected.size
          }
        ]
      } satisfies TrashRequest);

      const result = await runTrashCommand(trashRequestPath, {
        moveFileToTrash: async () => undefined,
        now: () => new Date("2026-05-26T10:30:00.000Z")
      });

      expect(result.logPath).toBe(path.join(fixture.dataDir, "logs", "delete-log-2026-05-26-10-30-00.json"));
      const log = JSON.parse(await readFile(result.logPath!, "utf8"));
      expect(log).toMatchObject({
        mode: "jpg_as_source_delete_raw",
        rootPath: fixture.root,
        total: 1,
        success: 1,
        failed: 0,
        items: [
          {
            path: selected.path,
            status: "moved_to_trash"
          }
        ]
      });
    } finally {
      await fixture.cleanup();
    }
  });
});

async function createTrashFixture(): Promise<{
  base: string;
  dataDir: string;
  root: string;
  scanRequestPath: string;
  cleanup: () => Promise<void>;
}> {
  const base = await mkdtemp(path.join(os.tmpdir(), "raw-pair-log-"));
  const root = path.join(base, "Shoot");
  const dataDir = path.join(base, "data");
  await mkdir(path.join(root, "jpg"), { recursive: true });
  await mkdir(path.join(root, "raw"), { recursive: true });
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(root, "jpg", "IMG_0001.jpg"), "jpg");
  await writeFile(path.join(root, "raw", "IMG_0001.CR3"), "raw");
  await writeFile(path.join(root, "raw", "IMG_9999.CR3"), "orphan");

  const scanRequestPath = await writeRequest(base, "scan", {
    protocolVersion: 1,
    taskId: "scan_log_test",
    rootPath: root,
    deleteMode: "jpg_as_source_delete_raw",
    dataDir,
    options: {
      recursive: true,
      includeHiddenFiles: false,
      ignoreCase: true
    }
  });

  return {
    base,
    dataDir,
    root,
    scanRequestPath,
    cleanup: () => rm(base, { recursive: true, force: true })
  };
}

async function writeRequest(base: string, command: string, value: unknown): Promise<string> {
  const requestPath = path.join(base, `${command}-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(requestPath, JSON.stringify(value), "utf8");

  return requestPath;
}
