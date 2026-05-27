import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../../shared/constants";
import type { SidecarEvent, SidecarScanResult, TrashResult } from "../../shared/protocol";
import type { MediaFile } from "../../shared/types";
import {
  parseSidecarScanResult,
  parseSidecarSettingsResult,
  parseSidecarTrashResult,
  sidecarScanResultToCompareResult,
  sidecarScanResultToScanResult,
  sidecarTrashResultToDeleteResult
} from "./sidecarClient";

describe("sidecar scan client", () => {
  it("parses JSON Lines scan output and returns the result payload", () => {
    const result = createSidecarScanResult();
    const stdout = [
      createEvent("started", { requestPath: "/tmp/request.json" }),
      createEvent("progress", { current: 1, total: 2 }),
      createEvent("result", result)
    ]
      .map((event) => JSON.stringify(event))
      .join("\n");

    expect(parseSidecarScanResult(stdout)).toEqual(result);
  });

  it("throws when scan output does not include a result event", () => {
    const stdout = JSON.stringify(createEvent("started", { requestPath: "/tmp/request.json" }));

    expect(() => parseSidecarScanResult(stdout)).toThrow("did not include a result event");
  });

  it("throws with line context for invalid JSON Lines output", () => {
    const stdout = `${JSON.stringify(createEvent("started"))}\nnot-json`;

    expect(() => parseSidecarScanResult(stdout)).toThrow("Invalid sidecar JSON on line 2");
  });

  it("maps a sidecar scan result into renderer scan and compare models", () => {
    const result = createSidecarScanResult();

    expect(sidecarScanResultToScanResult(result)).toEqual({
      rootPath: "/photos",
      directoryMode: "separate_dirs",
      imageFiles: result.imageFiles,
      rawFiles: result.rawFiles,
      sidecarFiles: result.sidecarFiles,
      unknownFiles: result.unknownFiles,
      jpgDirectory: "/photos/jpg",
      rawDirectory: "/photos/raw"
    });
    expect(sidecarScanResultToCompareResult(result)).toEqual({
      mode: "jpg_as_source_delete_raw",
      directoryMode: "separate_dirs",
      imageFiles: result.imageFiles,
      rawFiles: result.rawFiles,
      matchedPairs: result.matchedPairs,
      deleteCandidates: result.deleteCandidates,
      conflicts: result.conflicts,
      totalDeleteSize: result.totalDeleteSize
    });
  });

  it("parses JSON Lines trash output and maps it into the renderer delete model", () => {
    const trashResult: TrashResult = {
      taskId: "trash_test",
      scanId: "scan_test",
      total: 1,
      successCount: 1,
      failedCount: 0,
      releasedSize: 12,
      logPath: "/logs/delete-log.json",
      items: [
        {
          path: "/photos/raw/IMG_9999.CR3",
          size: 12,
          status: "moved_to_trash"
        }
      ]
    };
    const stdout = [
      createEvent("started", { requestPath: "/tmp/trash-request.json" }, "trash"),
      createEvent("result", trashResult, "trash")
    ]
      .map((event) => JSON.stringify(event))
      .join("\n");

    expect(parseSidecarTrashResult(stdout)).toEqual(trashResult);
    expect(
      sidecarTrashResultToDeleteResult(trashResult, {
        mode: "jpg_as_source_delete_raw",
        rootPath: "/photos"
      })
    ).toMatchObject({
      mode: "jpg_as_source_delete_raw",
      rootPath: "/photos",
      operation: "trash",
      total: 1,
      success: 1,
      failed: 0,
      logPath: "/logs/delete-log.json",
      items: trashResult.items
    });
  });

  it("parses JSON Lines settings output", () => {
    const stdout = [
      createEvent("started", { requestPath: "/tmp/settings-get.json" }, "settings-get"),
      createEvent("result", DEFAULT_SETTINGS, "settings-get")
    ]
      .map((event) => JSON.stringify(event))
      .join("\n");

    expect(parseSidecarSettingsResult(stdout, "settings-get")).toEqual(DEFAULT_SETTINGS);
  });
});

function createEvent<T>(
  event: SidecarEvent["event"],
  data?: T,
  command: SidecarEvent["command"] = "scan"
): SidecarEvent<T> {
  return {
    protocolVersion: 1,
    command,
    taskId: "scan_test",
    event,
    timestamp: "2026-05-26T00:00:00.000Z",
    data
  };
}

function createSidecarScanResult(): SidecarScanResult {
  const image = mediaFile("IMG_0001.jpg", "image", 5);
  const raw = mediaFile("IMG_0001.CR3", "raw", 10);
  const orphanRaw = mediaFile("IMG_9999.CR3", "raw", 12);

  return {
    scanId: "scan_test",
    rootPath: "/photos",
    deleteMode: "jpg_as_source_delete_raw",
    directoryMode: "separate_dirs",
    imageFiles: [image],
    rawFiles: [raw, orphanRaw],
    sidecarFiles: [],
    unknownFiles: [],
    matchedCount: 1,
    matchedPairs: [{ key: "img_0001", image, raw }],
    conflicts: [],
    deleteCandidates: [orphanRaw],
    totalDeleteSize: orphanRaw.size,
    jpgDirectory: "/photos/jpg",
    rawDirectory: "/photos/raw"
  };
}

function mediaFile(name: string, kind: MediaFile["kind"], size: number): MediaFile {
  const dotIndex = name.lastIndexOf(".");

  return {
    path: `/photos/${kind}/${name}`,
    name,
    ext: name.slice(dotIndex).toLowerCase(),
    key: name.slice(0, dotIndex).toLowerCase(),
    kind,
    size,
    modifiedAt: 1
  };
}
