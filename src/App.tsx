import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";

import { DEFAULT_SETTINGS } from "../shared/constants";
import type { AppSettings, CompareResult, DeleteMode, DeleteOperation, DeleteResult, MediaFile, ScanResult, TrashCapability, UpdateInfo, UpdateState } from "../shared/types";
import { AppLayout } from "./components/AppLayout";
import { MotionPage } from "./components/MotionPrimitives";
import { UpdateDialog } from "./components/UpdateDialog";
import { api } from "./lib/api";
import { AboutPage } from "./pages/AboutPage";
import { HomePage } from "./pages/HomePage";
import { ScanResultPage } from "./pages/ScanResultPage";
import { SettingsPage } from "./pages/SettingsPage";
import type { PageKey } from "./types/navigation";

const AUTO_UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageKey>("home");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [rootPath, setRootPath] = useState<string>();
  const [mode, setMode] = useState<DeleteMode>("jpg_as_source_delete_raw");
  const [scanResult, setScanResult] = useState<ScanResult>();
  const [compareResult, setCompareResult] = useState<CompareResult>();
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [deleteResult, setDeleteResult] = useState<DeleteResult>();
  const [error, setError] = useState<string>();
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checkingTrashCapability, setCheckingTrashCapability] = useState(false);
  const [trashCapability, setTrashCapability] = useState<TrashCapability>({
    status: "unknown",
    checkedPath: "",
    reason: "打开确认弹窗后检测当前目录是否支持系统回收站。"
  });
  const [deleteOperation, setDeleteOperation] = useState<DeleteOperation>("trash");
  const [savingSettings, setSavingSettings] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>();
  const [updateState, setUpdateState] = useState<UpdateState>({ status: "idle" });
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [pendingUpdatePrompt, setPendingUpdatePrompt] = useState(false);
  const [nativeDragging, setNativeDragging] = useState(false);
  const updateBusy = updateState.status === "checking" || updateState.status === "downloading" || updateState.status === "installing";
  const appBusyForUpdatePrompt = scanning || deleting || confirmOpen;

  useEffect(() => {
    void api
      .getSettings()
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_SETTINGS))
      .finally(() => setSettingsLoaded(true));
    const dispose = api.onUpdateProgress((progress) => {
      setUpdateState((current) => ({ ...current, status: "downloading", downloaded: progress.downloaded, total: progress.total }));
    });
    return dispose;
  }, []);

  useEffect(() => {
    return api.onDragDrop((dropEvent) => {
      if (dropEvent.type === "enter") {
        setNativeDragging(true);
        return;
      }
      if (dropEvent.type === "leave") {
        setNativeDragging(false);
        return;
      }
      if (dropEvent.type !== "drop") return;

      setNativeDragging(false);
      void acceptDroppedPaths(dropEvent.paths);
    });
  }, [currentPage, scanning, deleting, confirmOpen, updateState.status, mode, settings.scan]);

  useEffect(() => {
    if (!settingsLoaded || !settings.updates.autoCheckOnStartup || !shouldAutoCheck(settings.updates.lastCheckedAt)) return;

    const timer = window.setTimeout(() => {
      void runUpdateCheck({ manual: false });
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [settingsLoaded, settings.updates.autoCheckOnStartup, settings.updates.lastCheckedAt]);

  useEffect(() => {
    if (!pendingUpdatePrompt || appBusyForUpdatePrompt) return;
    setUpdateDialogOpen(true);
    setPendingUpdatePrompt(false);
  }, [appBusyForUpdatePrompt, pendingUpdatePrompt]);

  const selectedSize = useMemo(() => {
    return selectedMediaFiles(compareResult, selectedPaths).reduce((total, file) => total + file.size, 0);
  }, [compareResult, selectedPaths]);

  async function browseDirectory(): Promise<void> {
    const directory = await api.selectDirectory();
    if (directory) {
      setRootPath(directory);
      setError(undefined);
    }
  }

  async function browseDirectoryAndScan(): Promise<void> {
    const directory = await api.selectDirectory();
    if (directory) {
      setRootPath(directory);
      setError(undefined);
      await startScan({ rootPathOverride: directory });
    }
  }

  function acceptDroppedFile(file: File): void {
    const filePath = api.getPathForFile(file);
    acceptDroppedPath(filePath);
  }

  async function acceptDroppedPaths(paths: string[]): Promise<void> {
    if (currentPage !== "home" && currentPage !== "scanResult") return;
    if (scanning || deleting || confirmOpen) return;
    const path = paths[0];
    if (currentPage === "scanResult") {
      await acceptDroppedPathAndScan(path);
      return;
    }
    acceptDroppedPath(path);
  }

  function acceptDroppedPath(path: string | undefined): void {
    const nextPath = path?.trim();
    if (!nextPath) {
      setError("无法读取拖入目录路径，请点击选择目录。");
      return;
    }

    setRootPath(nextPath);
    setError(undefined);
  }

  async function acceptDroppedFileAndScan(file: File): Promise<void> {
    const filePath = api.getPathForFile(file);
    await acceptDroppedPathAndScan(filePath);
  }

  async function acceptDroppedPathAndScan(path: string | undefined): Promise<void> {
    const nextPath = path?.trim();
    if (!nextPath) {
      setError("无法读取拖入目录路径，请点击选择目录。");
      return;
    }

    setRootPath(nextPath);
    setError(undefined);
    await startScan({ rootPathOverride: nextPath });
  }

  async function startScan(options: { preserveDeleteResult?: boolean; rootPathOverride?: string } = {}): Promise<void> {
    const scanRootPath = options.rootPathOverride ?? rootPath;

    if (!scanRootPath) {
      setError("请先选择照片目录。");
      return;
    }
    if (updateState.status === "downloading" || updateState.status === "installing") {
      setError("正在处理更新，请等待完成后再扫描。");
      return;
    }

    setScanning(true);
    setError(undefined);
    if (!options.preserveDeleteResult) {
      setDeleteResult(undefined);
    }

    try {
      const nextScanResult = await api.scanDirectory(scanRootPath, settings.scan, mode);

      if (nextScanResult.imageFiles.length === 0 || nextScanResult.rawFiles.length === 0) {
        setScanResult(nextScanResult);
        setCompareResult(undefined);
        setSelectedPaths(new Set());
        setError(getNoComparableFilesMessage(nextScanResult));
        setCurrentPage("home");
        return;
      }

      const nextCompareResult = await api.compareFiles(nextScanResult, mode);
      setScanResult(nextScanResult);
      setCompareResult(nextCompareResult);
      setSelectedPaths(new Set(nextCompareResult.deleteCandidates.map((file) => file.path)));
      setCurrentPage("scanResult");
    } catch (scanError) {
      setError(getErrorMessage(scanError));
      setCurrentPage("home");
    } finally {
      setScanning(false);
    }
  }

  function toggleFile(filePath: string): void {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }

  function toggleAll(): void {
    if (!compareResult) return;
    const allPaths = compareResult.deleteCandidates.map((file) => file.path);
    const allSelected = allPaths.every((filePath) => selectedPaths.has(filePath));
    setSelectedPaths(allSelected ? new Set() : new Set(allPaths));
  }

  function setFilesSelected(paths: string[], selected: boolean): void {
    setSelectedPaths((current) => {
      const next = new Set(current);
      for (const filePath of paths) {
        if (selected) {
          next.add(filePath);
        } else {
          next.delete(filePath);
        }
      }
      return next;
    });
  }

  async function openDeleteConfirm(): Promise<void> {
    if (!compareResult || !scanResult) return;
    const files = selectedMediaFiles(compareResult, selectedPaths);
    if (files.length === 0) return;

    setConfirmOpen(true);
    setCheckingTrashCapability(true);
    setDeleteOperation("trash");
    setTrashCapability({
      status: "unknown",
      checkedPath: files[0].path,
      reason: "正在检测当前目录是否支持系统回收站..."
    });

    try {
      const capability = await api.getTrashCapability(files[0].path);
      setTrashCapability(capability);
      setDeleteOperation("trash");
    } catch (capabilityError) {
      setTrashCapability({
        status: "unknown",
        checkedPath: files[0].path,
        reason: `无法完成回收站检测：${getErrorMessage(capabilityError)}`
      });
      setDeleteOperation("trash");
    } finally {
      setCheckingTrashCapability(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!compareResult || !scanResult || selectedSize < 0) return;
    if (updateState.status === "downloading" || updateState.status === "installing") {
      setError("正在处理更新，请等待完成后再删除文件。");
      return;
    }
    const files = selectedMediaFiles(compareResult, selectedPaths);
    if (files.length === 0) return;

    setDeleting(true);
    try {
      const result = await api.moveToTrash(files, {
        mode,
        rootPath: scanResult.rootPath,
        operation: deleteOperation
      });
      setDeleteResult(result);
      setSelectedPaths(new Set(result.items.filter((item) => item.status === "failed").map((item) => item.path)));
      setConfirmOpen(false);
      await startScan({ preserveDeleteResult: true });
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  }

  async function openFileLocation(filePath: string): Promise<void> {
    setError(undefined);
    try {
      await api.showItemInFolder(filePath);
    } catch (openError) {
      setError(`无法打开文件位置：${getErrorMessage(openError)}`);
    }
  }

  async function saveSettings(nextSettings: AppSettings): Promise<void> {
    setSavingSettings(true);
    setError(undefined);
    try {
      await api.saveSettings(nextSettings);
      setSettings(nextSettings);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSavingSettings(false);
    }
  }

  async function runUpdateCheck({ manual }: { manual: boolean }): Promise<void> {
    if (updateBusy) return;
    setUpdateState({ status: "checking" });
    if (manual) setError(undefined);

    try {
      const result = await api.checkForUpdates();
      const checkedAt = new Date().toISOString();
      await persistUpdateLastCheckedAt(checkedAt);

      if (!result.available || !result.info) {
        setUpdateInfo(undefined);
        setUpdateState({ status: manual ? "not-available" : "idle" });
        return;
      }

      setUpdateInfo(result.info);
      setUpdateState({ status: "available", info: result.info });
      if (manual || !appBusyForUpdatePrompt) {
        setUpdateDialogOpen(true);
      } else {
        setPendingUpdatePrompt(true);
      }
    } catch (updateError) {
      if (manual) {
        setUpdateState({ status: "error", error: getErrorMessage(updateError) });
      } else {
        setUpdateState({ status: "idle" });
      }
    }
  }

  async function persistUpdateLastCheckedAt(lastCheckedAt: string): Promise<void> {
    const nextSettings = { ...settings, updates: { ...settings.updates, lastCheckedAt } };
    setSettings(nextSettings);
    await api.saveSettings(nextSettings);
  }

  async function downloadUpdate(): Promise<void> {
    if (!updateInfo) return;
    if (scanning || deleting || confirmOpen) {
      setUpdateState({ status: "error", info: updateInfo, error: "请等待当前扫描或删除操作完成后再下载更新。" });
      return;
    }

    setUpdateState({ status: "downloading", info: updateInfo, downloaded: 0 });
    try {
      await api.downloadUpdate();
      setUpdateState({ status: "ready", info: updateInfo });
    } catch (downloadError) {
      setUpdateState({ status: "error", info: updateInfo, error: getErrorMessage(downloadError) });
    }
  }

  async function installUpdate(): Promise<void> {
    if (!updateInfo) return;
    if (scanning || deleting || confirmOpen) {
      setUpdateState({ status: "error", info: updateInfo, error: "请等待当前扫描或删除操作完成后再重启应用更新。" });
      return;
    }

    setUpdateState({ status: "installing", info: updateInfo });
    try {
      await api.installUpdate();
    } catch (installError) {
      setUpdateState({ status: "error", info: updateInfo, error: getErrorMessage(installError) });
    }
  }

  return (
    <AppLayout currentPage={currentPage} fontScale={settings.appearance.fontScale} onNavigate={setCurrentPage}>
      <UpdateDialog
        open={updateDialogOpen}
        info={updateInfo}
        state={updateState}
        onCancel={() => setUpdateDialogOpen(false)}
        onDownload={() => void downloadUpdate()}
        onInstall={() => void installUpdate()}
      />
      <AnimatePresence mode="wait" initial={false}>
        {currentPage === "home" && (
          <MotionPage key="home">
            <HomePage
              rootPath={rootPath}
              mode={mode}
              error={error}
              scanning={scanning}
              onModeChange={setMode}
              onBrowse={() => void browseDirectory()}
              onDropFile={acceptDroppedFile}
              dragging={nativeDragging}
              onStartScan={() => void startScan()}
            />
          </MotionPage>
        )}
        {currentPage === "scanResult" && (
          <MotionPage key="scanResult">
            <ScanResultPage
              rootPath={rootPath}
              scanResult={scanResult}
              compareResult={compareResult}
              selectedPaths={selectedPaths}
              error={error}
              scanning={scanning}
              deleting={deleting}
              deleteResult={deleteResult}
              confirmOpen={confirmOpen}
              mode={mode}
              onToggleFile={toggleFile}
              onToggleAll={toggleAll}
              onSetFilesSelected={setFilesSelected}
              trashCapability={trashCapability}
              deleteOperation={deleteOperation}
              checkingTrashCapability={checkingTrashCapability}
              onDeleteOperationChange={() => setDeleteOperation("trash")}
              onOpenConfirm={() => void openDeleteConfirm()}
              onCloseConfirm={() => setConfirmOpen(false)}
              onConfirmDelete={() => void confirmDelete()}
              onOpenFileLocation={(filePath) => void openFileLocation(filePath)}
              onDropFile={(file) => void acceptDroppedFileAndScan(file)}
              dragging={nativeDragging}
              onBrowse={() => void browseDirectoryAndScan()}
              onRescan={() => void startScan()}
              onGoHome={() => setCurrentPage("home")}
            />
          </MotionPage>
        )}
        {currentPage === "settings" && (
          <MotionPage key="settings">
            <SettingsPage
              settings={settings}
              saving={savingSettings}
              updateInfo={updateInfo}
              updateState={updateState}
              onSave={(nextSettings) => void saveSettings(nextSettings)}
              onCheckUpdate={() => void runUpdateCheck({ manual: true })}
            />
          </MotionPage>
        )}
        {currentPage === "about" && (
          <MotionPage key="about">
            <AboutPage
              updateInfo={updateInfo}
              updateState={updateState}
              onCheckUpdate={() => void runUpdateCheck({ manual: true })}
              onShowUpdate={() => setUpdateDialogOpen(true)}
            />
          </MotionPage>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "操作失败，请重试。";
}

function shouldAutoCheck(lastCheckedAt?: string): boolean {
  if (!lastCheckedAt) return true;
  const checkedAt = new Date(lastCheckedAt).getTime();
  if (Number.isNaN(checkedAt)) return true;
  return Date.now() - checkedAt >= AUTO_UPDATE_CHECK_INTERVAL_MS;
}

function getNoComparableFilesMessage(scanResult: ScanResult): string {
  const imageCount = scanResult.imageFiles.length;
  const rawCount = scanResult.rawFiles.length;
  const modeLabel = scanResult.directoryMode === "separate_dirs" ? "已识别为双目录" : "已完成目录扫描";

  if (imageCount === 0 && rawCount === 0) {
    return `${modeLabel}，但没有找到可识别的 JPG 类图片或 RAW 文件。请检查文件扩展名、隐藏文件设置或目录层级。`;
  }

  if (imageCount === 0) {
    return `${modeLabel}，但没有找到可识别的 JPG 类图片文件；当前 RAW 文件 ${rawCount} 个。请检查 JPG 目录内容或扩展名。`;
  }

  return `${modeLabel}，但没有找到可识别的 RAW 文件；当前 JPG 类图片 ${imageCount} 个。请检查 RAW 目录内容或扩展名。`;
}

function selectedMediaFiles(compareResult: CompareResult | undefined, selectedPaths: Set<string>): MediaFile[] {
  return compareResult?.deleteCandidates.filter((file) => selectedPaths.has(file.path)) ?? [];
}
