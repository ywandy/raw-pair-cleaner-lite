import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SidecarEvent } from "../../shared/protocol";

describe("scan CLI", () => {
  it("reads a request file and prints JSON Lines with scan and compare result", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "raw-pair-sidecar-cli-"));
    try {
      await mkdir(path.join(root, "jpg"));
      await mkdir(path.join(root, "raw"));
      await writeFile(path.join(root, "jpg", "IMG_0001.jpg"), "jpg");
      await writeFile(path.join(root, "raw", "IMG_0001.CR3"), "raw");
      await writeFile(path.join(root, "raw", "IMG_9999.CR3"), "orphan");

      const requestPath = path.join(root, "scan-request.json");
      await writeFile(
        requestPath,
        JSON.stringify({
          protocolVersion: 1,
          taskId: "scan_cli_test",
          rootPath: root,
          deleteMode: "jpg_as_source_delete_raw",
          options: {
            recursive: true,
            includeHiddenFiles: false,
            ignoreCase: true
          }
        }),
        "utf8"
      );

      const result = spawnSync(
        process.execPath,
        ["--import", "tsx", "src/index.ts", "scan", "--request", requestPath],
        {
          cwd: process.cwd(),
          encoding: "utf8"
        }
      );

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const events = result.stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as SidecarEvent);
      expect(events.map((event) => event.event)).toEqual(["started", "result"]);
      expect(events[1]).toMatchObject({
        protocolVersion: 1,
        command: "scan",
        taskId: "scan_cli_test",
        event: "result",
        data: {
          rootPath: root,
          directoryMode: "separate_dirs",
          matchedCount: 1,
          deleteCandidates: [
            {
              name: "IMG_9999.CR3",
              kind: "raw"
            }
          ]
        }
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
