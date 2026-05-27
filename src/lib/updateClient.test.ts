import { describe, expect, it } from "vitest";

import { APP_VERSION } from "../../shared/constants";
import { createUpdateClient } from "./updateClient";

describe("updateClient", () => {
  it("returns not available when Tauri updater finds no update", async () => {
    const client = createUpdateClient({
      check: async () => null,
      relaunch: async () => undefined
    });

    await expect(client.checkForUpdates()).resolves.toEqual({
      available: false,
      currentVersion: APP_VERSION
    });
  });

  it("stores the checked update, reports download progress, installs, and relaunches", async () => {
    const progress: Array<{ downloaded: number; total?: number }> = [];
    const calls: string[] = [];
    const fakeUpdate = {
      currentVersion: "0.1.0-beta.1",
      version: "0.1.0-beta.2",
      date: "2026-05-26T00:00:00Z",
      body: "Signed update test",
      download: async (onEvent?: (event: { event: "Started"; data: { contentLength?: number } } | { event: "Progress"; data: { chunkLength: number } } | { event: "Finished" }) => void) => {
        calls.push("download");
        onEvent?.({ event: "Started", data: { contentLength: 100 } });
        onEvent?.({ event: "Progress", data: { chunkLength: 40 } });
        onEvent?.({ event: "Progress", data: { chunkLength: 60 } });
        onEvent?.({ event: "Finished" });
      },
      install: async () => {
        calls.push("install");
      }
    };
    const client = createUpdateClient({
      check: async () => fakeUpdate,
      relaunch: async () => {
        calls.push("relaunch");
      }
    });
    const dispose = client.onUpdateProgress((event) => progress.push(event));

    await expect(client.checkForUpdates()).resolves.toEqual({
      available: true,
      currentVersion: "0.1.0-beta.1",
      info: {
        currentVersion: "0.1.0-beta.1",
        version: "0.1.0-beta.2",
        date: "2026-05-26T00:00:00Z",
        body: "Signed update test"
      }
    });
    await client.downloadUpdate();
    await client.installUpdate();
    dispose();

    expect(progress).toEqual([
      { downloaded: 0, total: 100 },
      { downloaded: 40, total: 100 },
      { downloaded: 100, total: 100 }
    ]);
    expect(calls).toEqual(["download", "install", "relaunch"]);
  });
});
