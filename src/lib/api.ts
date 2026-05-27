import { isTauri } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";

import { DEFAULT_SETTINGS } from "../../shared/constants";
import type {
  AppSettings,
  CompareResult,
  DeleteContext,
  DeleteMode,
  MediaFile,
  ScanOptions,
  ScanResult,
  UpdateCheckResult,
  UpdateProgress,
  UpdateState,
  TrashCapability,
  DeleteResult
} from "../../shared/types";
import { createMockDeleteResult, createMockScanBundle } from "./mockData";
import {
  runSidecarGetSettings,
  runSidecarSaveSettings,
  runSidecarScan,
  runSidecarTrash,
  sidecarScanResultToCompareResult,
  sidecarScanResultToScanResult,
  sidecarTrashResultToDeleteResult
} from "./sidecarClient";
import { updateClient } from "./updateClient";

let currentSettings = DEFAULT_SETTINGS;
let currentBundle = createMockScanBundle();
let currentSidecarBundle:
  | {
      rootPath: string;
      mode: DeleteMode;
      scanResult: ScanResult;
      compareResult: CompareResult;
      scanId: string;
    }
  | undefined;

interface DesktopApi {
  selectDirectory: () => Promise<string | null>;
  scanDirectory: (rootPath: string, options: ScanOptions, mode: CompareResult["mode"]) => Promise<ScanResult>;
  compareFiles: (scanResult: ScanResult, mode: CompareResult["mode"]) => Promise<CompareResult>;
  moveToTrash: (files: MediaFile[], context: DeleteContext) => Promise<DeleteResult>;
  getTrashCapability: (checkedPath: string) => Promise<TrashCapability>;
  showItemInFolder: (path: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  getPathForFile: (file: File) => string;
  getUpdateState: () => Promise<UpdateState>;
  checkForUpdates: () => Promise<UpdateCheckResult>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  onUpdateProgress: (listener: (progress: UpdateProgress) => void) => () => void;
}

export const api: DesktopApi = {
  selectDirectory: async (): Promise<string | null> => {
    if (!isTauri()) return currentBundle.rootPath;

    const selected = await openDialog({
      title: "选择照片目录",
      directory: true,
      multiple: false,
      recursive: true
    });

    return Array.isArray(selected) ? (selected[0] ?? null) : selected;
  },

  scanDirectory: async (
    rootPath: string,
    options: ScanOptions,
    mode: CompareResult["mode"]
  ): Promise<ScanResult> => {
    if (isTauri()) {
      const sidecarResult = await runSidecarScan(rootPath, options, mode);
      const scanResult = sidecarScanResultToScanResult(sidecarResult);
      const compareResult = sidecarScanResultToCompareResult(sidecarResult);
      currentSidecarBundle = {
        rootPath,
        mode,
        scanResult,
        compareResult,
        scanId: sidecarResult.scanId
      };
      return scanResult;
    }

    currentBundle = createMockScanBundle({
      rootPath,
      mode
    });
    return currentBundle.scanResult;
  },

  compareFiles: async (
    scanResult: ScanResult,
    mode: CompareResult["mode"]
  ): Promise<CompareResult> => {
    if (isTauri()) {
      if (
        currentSidecarBundle &&
        currentSidecarBundle.rootPath === scanResult.rootPath &&
        currentSidecarBundle.mode === mode
      ) {
        return currentSidecarBundle.compareResult;
      }

      throw new Error("扫描结果已过期，请重新扫描。");
    }

    currentBundle = createMockScanBundle({
      rootPath: scanResult.rootPath,
      mode
    });
    return currentBundle.compareResult;
  },

  moveToTrash: async (files: MediaFile[], context: DeleteContext) => {
    if (isTauri()) {
      if (context.operation && context.operation !== "trash") {
        throw new Error("当前版本只支持移动到系统回收站，不支持永久删除。");
      }
      if (
        !currentSidecarBundle ||
        currentSidecarBundle.rootPath !== context.rootPath ||
        currentSidecarBundle.mode !== context.mode
      ) {
        throw new Error("删除候选已过期，请重新扫描后再删除。");
      }

      const result = await runSidecarTrash(files, context, currentSidecarBundle.scanId, currentSettings.delete.generateLog);
      return sidecarTrashResultToDeleteResult(result, context);
    }

    return createMockDeleteResult(files, {
      mode: context.mode,
      rootPath: context.rootPath
    });
  },

  getTrashCapability: async (checkedPath: string) => ({
    status: isTauri() ? ("unknown" as const) : ("available" as const),
    checkedPath,
    reason: isTauri()
      ? "将通过系统回收站执行，并在执行前重新校验扫描 manifest。"
      : "Mock 模式：真实删除尚未接入，本轮只验证 UI。"
  }),

  showItemInFolder: async (path: string) => {
    if (isTauri()) {
      await revealItemInDir(path);
    }
  },

  openExternal: async (url: string) => {
    if (isTauri()) {
      await openUrl(url);
      return;
    }
    window.open(url, "_blank", "noreferrer");
  },

  getSettings: async (): Promise<AppSettings> => {
    if (isTauri()) {
      currentSettings = await runSidecarGetSettings();
    }

    return currentSettings;
  },

  saveSettings: async (settings: AppSettings) => {
    currentSettings = isTauri() ? await runSidecarSaveSettings(settings) : settings;
  },

  getPathForFile: (file: File) => {
    if (isTauri()) {
      return (file as File & { path?: string }).path ?? "";
    }

    return currentBundle.rootPath;
  },

  getUpdateState: async (): Promise<UpdateState> => ({ status: "idle" }),

  checkForUpdates: async (): Promise<UpdateCheckResult> => {
    if (!isTauri()) {
      return {
        available: false,
        currentVersion: "0.1.0-beta.1"
      };
    }

    return updateClient.checkForUpdates();
  },

  downloadUpdate: async () => {
    if (isTauri()) {
      await updateClient.downloadUpdate();
    }
  },

  installUpdate: async () => {
    if (isTauri()) {
      await updateClient.installUpdate();
    }
  },

  onUpdateProgress: (listener: (progress: UpdateProgress) => void) =>
    isTauri() ? updateClient.onUpdateProgress(listener) : () => undefined
};
