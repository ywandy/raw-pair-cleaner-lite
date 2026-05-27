import { execFile } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type {
  DeleteManifest,
  DeleteManifestCandidate,
  TrashRequest,
  TrashResult,
  TrashResultItem
} from "../../../shared/protocol";
import { getMediaKind } from "../../../shared/fileUtils";
import { writeDeleteLog } from "./logService";
import { readDeleteManifest } from "./manifestService";

const execFileAsync = promisify(execFile);
const MACOS_TRASH_SCRIPT = `
ObjC.import("Foundation");
const path = $.NSProcessInfo.processInfo.environment.objectForKey("RAW_PAIR_TRASH_PATH").js;
const url = $.NSURL.fileURLWithPath(path);
const didTrash = $.NSFileManager.defaultManager.trashItemAtURLResultingItemURLError(url, null, null);
if (!didTrash) {
  throw new Error("NSFileManager could not move the item to Trash.");
}
`;

export interface TrashServiceDependencies {
  moveFileToTrash?: (filePath: string) => Promise<void>;
  now?: () => Date;
}

export async function moveSelectedFilesToTrash(
  request: TrashRequest,
  dependencies: TrashServiceDependencies = {}
): Promise<TrashResult> {
  validateTrashRequestShape(request);
  const manifest = await readDeleteManifest(request.scanId, request.dataDir);
  const candidates = await validateSelectedCandidates(request, manifest);
  const moveFileToTrash = dependencies.moveFileToTrash ?? moveFileToSystemTrash;
  const now = dependencies.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const items: TrashResultItem[] = [];

  for (const candidate of candidates) {
    try {
      await moveFileToTrash(candidate.path);
      items.push({
        path: candidate.path,
        size: candidate.size,
        status: "moved_to_trash"
      });
    } catch (error) {
      items.push({
        path: candidate.path,
        size: candidate.size,
        status: "failed",
        error: getErrorMessage(error)
      });
    }
  }

  const finishedAt = now().toISOString();
  const result: TrashResult = {
    taskId: request.taskId,
    scanId: request.scanId,
    total: items.length,
    successCount: items.filter((item) => item.status === "moved_to_trash").length,
    failedCount: items.filter((item) => item.status === "failed").length,
    releasedSize: items
      .filter((item) => item.status === "moved_to_trash")
      .reduce((total, item) => total + item.size, 0),
    items
  };

  if (request.generateLog ?? true) {
    result.logPath = await writeDeleteLog({
      dataDir: request.dataDir,
      mode: manifest.deleteMode,
      rootPath: manifest.rootPath,
      startedAt,
      finishedAt,
      total: result.total,
      success: result.successCount,
      failed: result.failedCount,
      items
    });
  }

  return result;
}

async function validateSelectedCandidates(
  request: TrashRequest,
  manifest: DeleteManifest
): Promise<DeleteManifestCandidate[]> {
  if (request.rootPath !== manifest.rootPath) {
    throw new Error("Trash request rootPath does not match the scan manifest.");
  }

  const manifestCandidates = new Map(manifest.candidates.map((candidate) => [candidate.path, candidate]));
  const selectedCandidates = request.selectedFiles.map((selectedFile) => {
    const candidate = manifestCandidates.get(selectedFile.path);
    if (!candidate) {
      throw new Error(`Selected file is not part of the scan manifest: ${selectedFile.path}`);
    }
    if (selectedFile.size !== candidate.size) {
      throw new Error(`Selected file size does not match the scan manifest: ${selectedFile.path}`);
    }
    return candidate;
  });

  const rootRealPath = await realpath(manifest.rootPath);
  for (const candidate of selectedCandidates) {
    const fileRealPath = await realpath(candidate.path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        throw new Error(`Selected file no longer exists: ${candidate.path}`);
      }
      throw error;
    });

    if (!isPathInside(fileRealPath, rootRealPath)) {
      throw new Error(`Selected file is outside the scan root: ${candidate.path}`);
    }

    const currentStats = await stat(candidate.path);
    if (currentStats.size !== candidate.size || Math.abs(currentStats.mtimeMs - candidate.modifiedAt) > 1) {
      throw new Error(`Selected file changed since the last scan: ${candidate.path}`);
    }

    const kind = getMediaKind(candidate.path);
    if (manifest.deleteMode === "jpg_as_source_delete_raw" && kind !== "raw") {
      throw new Error(`Selected file extension is not valid for RAW deletion mode: ${candidate.path}`);
    }
    if (manifest.deleteMode === "raw_as_source_delete_jpg" && kind !== "image") {
      throw new Error(`Selected file extension is not valid for JPG deletion mode: ${candidate.path}`);
    }
  }

  return selectedCandidates;
}

function validateTrashRequestShape(request: TrashRequest): void {
  if (request.protocolVersion !== 1) {
    throw new Error("Unsupported trash request protocol version.");
  }
  if (!request.taskId) {
    throw new Error("Trash request taskId is required.");
  }
  if (!request.scanId) {
    throw new Error("Trash request scanId is required.");
  }
  if (!request.rootPath) {
    throw new Error("Trash request rootPath is required.");
  }
  if (request.confirmed !== true) {
    throw new Error("Trash request must be explicitly confirmed.");
  }
  if (!Array.isArray(request.selectedFiles)) {
    throw new Error("Trash request selectedFiles must be an array.");
  }
}

async function moveFileToSystemTrash(filePath: string): Promise<void> {
  if (process.platform === "darwin") {
    await execFileAsync("osascript", ["-l", "JavaScript", "-e", MACOS_TRASH_SCRIPT], {
      env: {
        ...process.env,
        RAW_PAIR_TRASH_PATH: filePath
      },
      timeout: 30_000
    });
    return;
  }

  if (process.platform === "win32") {
    await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($args[0], 'OnlyErrorDialogs', 'SendToRecycleBin')",
        filePath
      ],
      { timeout: 30_000 }
    );
    return;
  }

  await moveFileToFreedesktopTrash(filePath);
}

async function moveFileToFreedesktopTrash(filePath: string): Promise<void> {
  const commands: Array<{ command: string; args: string[] }> = [
    { command: "gio", args: ["trash", filePath] },
    { command: "trash-put", args: [filePath] },
    { command: "kioclient5", args: ["move", filePath, "trash:/"] },
    { command: "kioclient", args: ["move", filePath, "trash:/"] }
  ];
  const errors: string[] = [];

  for (const candidate of commands) {
    try {
      await execFileAsync(candidate.command, candidate.args, { timeout: 30_000 });
      return;
    } catch (error) {
      errors.push(`${candidate.command}: ${getErrorMessage(error)}`);
    }
  }

  throw new Error(`No supported system trash command succeeded. ${errors.join("; ")}`);
}

function isPathInside(targetPath: string, parentPath: string): boolean {
  const relativePath = path.relative(parentPath, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
