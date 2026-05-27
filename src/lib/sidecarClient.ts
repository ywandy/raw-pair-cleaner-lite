import { invoke } from "@tauri-apps/api/core";
import { Command } from "@tauri-apps/plugin-shell";
import type {
  ScanRequest,
  SettingsGetRequest,
  SettingsSaveRequest,
  SidecarEvent,
  SidecarScanResult,
  TrashRequest,
  TrashResult
} from "../../shared/protocol";
import type {
  CompareResult,
  DeleteContext,
  DeleteMode,
  DeleteResult,
  AppSettings,
  MediaFile,
  ScanOptions,
  ScanResult
} from "../../shared/types";

const SIDECAR_PROGRAM = "binaries/raw-pair-sidecar";

export async function runSidecarScan(
  rootPath: string,
  options: ScanOptions,
  deleteMode: DeleteMode
): Promise<SidecarScanResult> {
  const dataDir = await getSidecarDataDir();
  const request: ScanRequest = {
    protocolVersion: 1,
    taskId: createTaskId("scan"),
    rootPath,
    deleteMode,
    dataDir,
    options
  };
  const requestPath = await invoke<string>("write_sidecar_request", {
    command: "scan",
    taskId: request.taskId,
    contents: JSON.stringify(request)
  });
  const command = Command.sidecar(SIDECAR_PROGRAM, ["scan", "--request", requestPath]);
  const output = await command.execute();

  if (output.code !== 0) {
    throw new Error(output.stderr || `Sidecar exited with code ${output.code}`);
  }

  return parseSidecarScanResult(output.stdout);
}

export async function runSidecarTrash(
  files: MediaFile[],
  context: DeleteContext,
  scanId: string,
  generateLog: boolean
): Promise<TrashResult> {
  const dataDir = await getSidecarDataDir();
  const request: TrashRequest = {
    protocolVersion: 1,
    taskId: createTaskId("trash"),
    scanId,
    rootPath: context.rootPath,
    dataDir,
    confirmed: true,
    generateLog,
    selectedFiles: files.map((file) => ({
      path: file.path,
      size: file.size
    }))
  };
  const requestPath = await invoke<string>("write_sidecar_request", {
    command: "trash",
    taskId: request.taskId,
    contents: JSON.stringify(request)
  });
  const command = Command.sidecar(SIDECAR_PROGRAM, ["trash", "--request", requestPath]);
  const output = await command.execute();

  if (output.code !== 0) {
    throw new Error(output.stderr || `Sidecar exited with code ${output.code}`);
  }

  return parseSidecarTrashResult(output.stdout);
}

export async function runSidecarGetSettings(): Promise<AppSettings> {
  const dataDir = await getSidecarDataDir();
  const request: SettingsGetRequest = {
    protocolVersion: 1,
    taskId: createTaskId("settings-get"),
    dataDir
  };
  const requestPath = await invoke<string>("write_sidecar_request", {
    command: "settings-get",
    taskId: request.taskId,
    contents: JSON.stringify(request)
  });
  const command = Command.sidecar(SIDECAR_PROGRAM, ["settings-get", "--request", requestPath]);
  const output = await command.execute();

  if (output.code !== 0) {
    throw new Error(output.stderr || `Sidecar exited with code ${output.code}`);
  }

  return parseSidecarSettingsResult(output.stdout, "settings-get");
}

export async function runSidecarSaveSettings(settings: AppSettings): Promise<AppSettings> {
  const dataDir = await getSidecarDataDir();
  const request: SettingsSaveRequest = {
    protocolVersion: 1,
    taskId: createTaskId("settings-save"),
    dataDir,
    settings
  };
  const requestPath = await invoke<string>("write_sidecar_request", {
    command: "settings-save",
    taskId: request.taskId,
    contents: JSON.stringify(request)
  });
  const command = Command.sidecar(SIDECAR_PROGRAM, ["settings-save", "--request", requestPath]);
  const output = await command.execute();

  if (output.code !== 0) {
    throw new Error(output.stderr || `Sidecar exited with code ${output.code}`);
  }

  return parseSidecarSettingsResult(output.stdout, "settings-save");
}

export function parseSidecarScanResult(stdout: string): SidecarScanResult {
  return parseSidecarResult<SidecarScanResult>(stdout, "scan");
}

export function parseSidecarTrashResult(stdout: string): TrashResult {
  return parseSidecarResult<TrashResult>(stdout, "trash");
}

export function parseSidecarSettingsResult(
  stdout: string,
  command: Extract<SidecarEvent["command"], "settings-get" | "settings-save">
): AppSettings {
  return parseSidecarResult<AppSettings>(stdout, command);
}

function parseSidecarResult<T>(stdout: string, expectedCommand: SidecarEvent["command"]): T {
  let result: T | undefined;
  const lines = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);

  lines.forEach((line, index) => {
    let event: SidecarEvent<T>;

    try {
      event = JSON.parse(line) as SidecarEvent<T>;
    } catch (error) {
      throw new Error(`Invalid sidecar JSON on line ${index + 1}: ${getErrorMessage(error)}`);
    }

    if (event.command !== expectedCommand) {
      throw new Error(`Unexpected sidecar command "${event.command}" on line ${index + 1}.`);
    }

    if (event.event === "error") {
      throw new Error(event.error?.message ?? `Sidecar ${expectedCommand} failed.`);
    }

    if (event.event === "result") {
      if (!event.data) {
        throw new Error(`Sidecar ${expectedCommand} result event on line ${index + 1} did not include data.`);
      }
      result = event.data;
    }
  });

  if (!result) {
    throw new Error(`Sidecar ${expectedCommand} output did not include a result event.`);
  }

  return result;
}

export function sidecarScanResultToScanResult(result: SidecarScanResult): ScanResult {
  return {
    rootPath: result.rootPath,
    directoryMode: result.directoryMode,
    imageFiles: result.imageFiles,
    rawFiles: result.rawFiles,
    sidecarFiles: result.sidecarFiles,
    unknownFiles: result.unknownFiles,
    jpgDirectory: result.jpgDirectory,
    rawDirectory: result.rawDirectory
  };
}

export function sidecarScanResultToCompareResult(result: SidecarScanResult): CompareResult {
  return {
    mode: result.deleteMode,
    directoryMode: result.directoryMode,
    imageFiles: result.imageFiles,
    rawFiles: result.rawFiles,
    matchedPairs: result.matchedPairs,
    deleteCandidates: result.deleteCandidates,
    conflicts: result.conflicts,
    totalDeleteSize: result.totalDeleteSize
  };
}

export function sidecarTrashResultToDeleteResult(
  result: TrashResult,
  context: Pick<DeleteContext, "mode" | "rootPath">
): DeleteResult {
  const now = new Date().toISOString();

  return {
    startedAt: now,
    finishedAt: now,
    mode: context.mode,
    rootPath: context.rootPath,
    operation: "trash",
    total: result.total,
    success: result.successCount,
    failed: result.failedCount,
    logPath: result.logPath,
    items: result.items
  };
}

async function getSidecarDataDir(): Promise<string> {
  return invoke<string>("get_sidecar_data_dir");
}

function createTaskId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);

  return `${prefix}-${Date.now()}-${randomPart}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
