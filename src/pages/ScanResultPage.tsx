import { AlertTriangle, CheckCircle2, Database, FileImage, FolderOpen, RefreshCw, Trash2, X, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState, type DragEvent } from "react";

import type { CompareResult, DeleteMode, DeleteOperation, DeleteResult, DirectoryMode, ScanResult, TrashCapability } from "../../shared/types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { FileTable } from "../components/FileTable";
import { getPressMotion, MotionItem, MotionStack } from "../components/MotionPrimitives";
import { WarningPanel } from "../components/WarningPanel";
import { createSelectedFileSummary } from "../lib/fileTree";
import { formatBytes, formatDirectoryMode } from "../lib/format";

interface ScanResultPageProps {
  rootPath?: string;
  scanResult?: ScanResult;
  compareResult?: CompareResult;
  selectedPaths: Set<string>;
  error?: string;
  scanning: boolean;
  deleting: boolean;
  deleteResult?: DeleteResult;
  confirmOpen: boolean;
  mode: DeleteMode;
  trashCapability: TrashCapability;
  deleteOperation: DeleteOperation;
  checkingTrashCapability: boolean;
  onToggleFile: (path: string) => void;
  onToggleAll: () => void;
  onSetFilesSelected: (paths: string[], selected: boolean) => void;
  onOpenConfirm: () => void;
  onCloseConfirm: () => void;
  onDeleteOperationChange: (operation: DeleteOperation) => void;
  onConfirmDelete: () => void;
  onOpenFileLocation: (path: string) => void;
  onDropFile: (file: File) => void;
  onBrowse: () => void;
  onRescan: () => void;
  onGoHome: () => void;
}

export function ScanResultPage({
  rootPath,
  scanResult,
  compareResult,
  selectedPaths,
  error,
  scanning,
  deleting,
  deleteResult,
  confirmOpen,
  mode,
  trashCapability,
  deleteOperation,
  checkingTrashCapability,
  onToggleFile,
  onToggleAll,
  onSetFilesSelected,
  onOpenConfirm,
  onCloseConfirm,
  onDeleteOperationChange,
  onConfirmDelete,
  onOpenFileLocation,
  onDropFile,
  onBrowse,
  onRescan,
  onGoHome
}: ScanResultPageProps) {
  const reduced = useReducedMotion();

  if (!scanResult || !compareResult) {
    return (
      <EmptyState
        title="还没有扫描结果"
        description="选择照片目录并完成扫描后，结果会显示在这里。"
        action={
          <button className="btn btn-primary" onClick={onGoHome}>
            返回首页
          </button>
        }
      />
    );
  }

  const hasCandidates = compareResult.deleteCandidates.length > 0;
  const selectedFiles = compareResult.deleteCandidates.filter((file) => selectedPaths.has(file.path));
  const allCandidatePaths = compareResult.deleteCandidates.map((file) => file.path);
  const selectedSummary = createSelectedFileSummary(compareResult.deleteCandidates, selectedPaths);
  const confirmDisabled = selectedSummary.count === 0 || deleting;

  function clearSelection(): void {
    onSetFilesSelected(allCandidatePaths, false);
  }

  return (
    <div className="page">
      <MotionStack className="mx-auto flex min-h-0 w-full max-w-[1380px] flex-1 flex-col gap-3 overflow-hidden">
        <MotionItem>
          <ResultHeader
            rootPath={rootPath ?? scanResult.rootPath}
            directoryMode={scanResult.directoryMode}
            mode={mode}
            scanning={scanning}
            onDropFile={onDropFile}
            onBrowse={onBrowse}
            onRescan={onRescan}
          />
        </MotionItem>

        <MotionItem className="grid shrink-0 grid-cols-5 gap-2.5">
          <ResultMetric label="JPG 类文件" value={compareResult.imageFiles.length} helper="个文件" tone="jpg" />
          <ResultMetric label="RAW 类文件" value={compareResult.rawFiles.length} helper="个文件" tone="raw" />
          <ResultMetric label="匹配成功" value={compareResult.matchedPairs.length} helper="对文件" tone="match" />
          <ResultMetric label="待删除" value={compareResult.deleteCandidates.length} helper="个文件" tone={hasCandidates ? "pending" : "match"} />
          <ResultMetric label="预计释放" value={formatBytes(compareResult.totalDeleteSize)} helper="可释放空间" tone="release" />
        </MotionItem>

        {deleteResult && (
          <MotionItem>
            <WarningPanel title={deleteResult.failed > 0 ? "部分文件删除失败" : "删除完成"} tone={deleteResult.failed > 0 ? "red" : "blue"}>
              {deleteResult.operation === "permanent" ? "永久删除" : "移动到回收站"}成功 {deleteResult.success} 个，失败 {deleteResult.failed} 个
              {deleteResult.logPath ? `，日志：${deleteResult.logPath}` : ""}。
            </WarningPanel>
          </MotionItem>
        )}

        {error && (
          <MotionItem>
            <WarningPanel title="操作未完成" tone="red">
              {error}
            </WarningPanel>
          </MotionItem>
        )}

        {compareResult.conflicts.length > 0 && (
          <MotionItem>
            <WarningPanel title="检测到同名冲突文件" tone="orange">
              已跳过 {compareResult.conflicts.length} 组冲突，冲突文件不会自动加入待删除列表。
            </WarningPanel>
          </MotionItem>
        )}

        {!hasCandidates && (
          <MotionItem>
            <WarningPanel title="未发现需要删除的冗余文件" tone="blue">
              当前模式下没有待删除候选文件。
            </WarningPanel>
          </MotionItem>
        )}

        {hasCandidates && (
          <MotionItem className="flex min-h-0 flex-1 flex-col gap-2">
            <section className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="type-section-title text-[var(--color-heading)]">待删除文件</h2>
                  <p className="type-body mt-0.5 text-[var(--color-muted)]">以下文件将在确认弹窗中选择删除方式，请仔细确认后执行删除操作。</p>
                </div>
                <div className="status-pill">
                  已选 {selectedSummary.count}/{compareResult.deleteCandidates.length}
                </div>
              </div>

              <FileTable
                files={compareResult.deleteCandidates}
                matchedPairs={compareResult.matchedPairs}
                selectedPaths={selectedPaths}
                refreshing={scanning}
                onToggleFile={onToggleFile}
                onToggleAll={onToggleAll}
                onSetFilesSelected={onSetFilesSelected}
                onOpenFileLocation={onOpenFileLocation}
              />
            </section>
          </MotionItem>
        )}

        {hasCandidates && (
          <MotionItem>
            <section className="alert-panel alert-orange shrink-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-warning-soft)] text-[var(--color-warning-strong)]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="type-ui">即将移动 {selectedSummary.count} 个文件到系统回收站</div>
                <div className="type-body mt-0.5">默认优先移动到系统回收站；如果当前目录不支持回收站，确认弹窗会切换为永久删除提示。</div>
              </div>
            </section>
          </MotionItem>
        )}
      </MotionStack>

      <div className="page-actionbar">
        <div className="mx-auto flex w-full max-w-[1380px] flex-wrap justify-end gap-3">
          <motion.button
            className="btn btn-secondary actionbar-btn"
            disabled={selectedSummary.count === 0 || deleting}
            onClick={clearSelection}
            {...getPressMotion(reduced)}
          >
            <X />
            取消选择
          </motion.button>
          <motion.button
            className="btn btn-danger actionbar-btn min-w-56"
            disabled={confirmDisabled}
            onClick={onOpenConfirm}
            {...getPressMotion(reduced)}
          >
            <Trash2 />
            确认删除（{selectedSummary.count} 个文件）
          </motion.button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        count={selectedFiles.length}
        totalSize={selectedSummary.size}
        mode={mode}
        moveToTrash={deleteOperation === "trash"}
        trashCapability={trashCapability}
        checkingTrashCapability={checkingTrashCapability}
        busy={deleting}
        onCancel={onCloseConfirm}
        onMoveToTrashChange={(moveToTrash) => onDeleteOperationChange(moveToTrash ? "trash" : "permanent")}
        onConfirm={onConfirmDelete}
      />
    </div>
  );
}

type MetricTone = "jpg" | "raw" | "match" | "pending" | "release";

const METRIC_TONES: Record<MetricTone, { accent: string; icon: LucideIcon }> = {
  jpg: { accent: "text-[var(--color-warning-strong)]", icon: FileImage },
  raw: { accent: "text-[var(--color-accent-blue)]", icon: Database },
  match: { accent: "text-[var(--color-primary)]", icon: CheckCircle2 },
  pending: { accent: "text-[var(--color-warning-strong)]", icon: Trash2 },
  release: { accent: "text-[var(--color-danger)]", icon: Database }
};

function ResultHeader({
  rootPath,
  directoryMode,
  mode,
  scanning,
  onDropFile,
  onBrowse,
  onRescan
}: {
  rootPath?: string;
  directoryMode: DirectoryMode;
  mode: DeleteMode;
  scanning: boolean;
  onDropFile: (file: File) => void;
  onBrowse: () => void;
  onRescan: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const reduced = useReducedMotion();
  const modeLabel = formatCompactDeleteMode(mode);
  const dropHint = dragging ? "释放后重新扫描" : "拖入目录或选择目录重新扫描";

  function handleDragOver(event: DragEvent<HTMLElement>): void {
    event.preventDefault();
    if (!scanning) setDragging(true);
  }

  function handleDrop(event: DragEvent<HTMLElement>): void {
    event.preventDefault();
    setDragging(false);
    if (scanning) return;
    const file = event.dataTransfer.files.item(0);
    if (file) onDropFile(file);
  }

  return (
    <motion.section
      className={[
        "panel-compact flex shrink-0 items-center gap-4 border transition",
        dragging ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border)]",
        scanning ? "opacity-75" : "hover:border-[var(--color-primary)]"
      ].join(" ")}
      aria-label="扫描结果顶部工具栏"
      onDragOver={handleDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      animate={{ scale: dragging && !reduced ? 1.004 : 1 }}
      transition={{ duration: reduced ? 0.01 : 0.18, ease: "easeOut" }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-[11rem] shrink-0">
          <h1 className="type-section-title page-title">扫描完成</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="status-pill bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]">{formatDirectoryMode(directoryMode)}</span>
            <span className="status-pill">{modeLabel}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 border-l border-[var(--color-border)] pl-3">
          <div className="type-caption text-[var(--color-subtle)]">{dropHint}</div>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-[var(--color-muted)]">
            <FolderOpen className="h-4 w-4 shrink-0 text-[var(--color-accent-blue)]" />
            <span className="type-body truncate" title={rootPath}>
              {rootPath || "当前未选择目录"}
            </span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <motion.button className="btn btn-secondary shrink-0" disabled={scanning} onClick={onBrowse} {...getPressMotion(reduced)}>
          <FolderOpen className="h-4 w-4" />
          选择目录
        </motion.button>
        <motion.button className="btn btn-secondary shrink-0" disabled={scanning} onClick={onRescan} {...getPressMotion(reduced)}>
          <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "扫描中" : "重新扫描"}
        </motion.button>
      </div>
    </motion.section>
  );
}

function formatCompactDeleteMode(mode: DeleteMode): string {
  return mode === "jpg_as_source_delete_raw" ? "JPG -> RAW（删除 RAW）" : "RAW -> JPG（删除 JPG）";
}

function ResultMetric({ label, value, helper, tone }: { label: string; value: string | number; helper: string; tone: MetricTone }) {
  const reduced = useReducedMotion();
  const style = METRIC_TONES[tone];
  const Icon = style.icon;

  return (
    <motion.div
      className="relative min-w-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-3 shadow-[var(--shadow-panel)]"
      whileHover={reduced ? undefined : { y: -1 }}
      transition={{ duration: reduced ? 0.01 : 0.16, ease: "easeOut" }}
    >
      <div className="relative z-10">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="type-card-title truncate text-[var(--color-muted)]">{label}</div>
          <Icon className={`h-5 w-5 ${style.accent}`} />
        </div>
        <div className={`type-stat break-words ${style.accent}`}>{value}</div>
        <div className="type-caption mt-1.5 text-[var(--color-subtle)]">{helper}</div>
      </div>
    </motion.div>
  );
}
