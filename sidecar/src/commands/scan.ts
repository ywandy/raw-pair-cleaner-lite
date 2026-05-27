import { readFile } from "node:fs/promises";

import type { ScanRequest, SidecarScanResult } from "../../../shared/protocol";
import { compareFiles } from "../services/compareService";
import { writeDeleteManifest } from "../services/manifestService";
import { scanDirectory } from "../services/scanService";

export async function runScanCommand(requestPath: string): Promise<SidecarScanResult> {
  const request = JSON.parse(await readFile(requestPath, "utf8")) as ScanRequest;
  validateScanRequest(request);

  const scanResult = await scanDirectory(request.rootPath, request.options);
  const compareResult = compareFiles(scanResult, request.deleteMode);
  const manifestPath = await writeDeleteManifest({
    scanId: request.taskId,
    rootPath: scanResult.rootPath,
    deleteMode: request.deleteMode,
    candidates: compareResult.deleteCandidates,
    dataDir: request.dataDir
  });

  return {
    scanId: request.taskId,
    rootPath: scanResult.rootPath,
    deleteMode: request.deleteMode,
    directoryMode: scanResult.directoryMode,
    imageFiles: scanResult.imageFiles,
    rawFiles: scanResult.rawFiles,
    sidecarFiles: scanResult.sidecarFiles,
    unknownFiles: scanResult.unknownFiles,
    matchedCount: compareResult.matchedPairs.length,
    matchedPairs: compareResult.matchedPairs,
    conflicts: compareResult.conflicts,
    deleteCandidates: compareResult.deleteCandidates,
    totalDeleteSize: compareResult.totalDeleteSize,
    jpgDirectory: scanResult.jpgDirectory,
    rawDirectory: scanResult.rawDirectory,
    manifestPath
  };
}

function validateScanRequest(request: ScanRequest): void {
  if (request.protocolVersion !== 1) {
    throw new Error("Unsupported scan request protocol version.");
  }
  if (!request.taskId) {
    throw new Error("Scan request taskId is required.");
  }
  if (!request.rootPath) {
    throw new Error("Scan request rootPath is required.");
  }
  if (
    request.deleteMode !== "jpg_as_source_delete_raw" &&
    request.deleteMode !== "raw_as_source_delete_jpg"
  ) {
    throw new Error("Scan request deleteMode is invalid.");
  }
}
