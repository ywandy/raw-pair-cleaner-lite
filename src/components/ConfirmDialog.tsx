import { AlertTriangle, Trash2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type { DeleteMode, TrashCapability } from "../../shared/types";
import { formatBytes, formatDeleteMode } from "../lib/format";
import { dialogPanelVariants, dialogScrimVariants, getPressMotion } from "./MotionPrimitives";

interface ConfirmDialogProps {
  open: boolean;
  count: number;
  totalSize: number;
  mode: DeleteMode;
  moveToTrash: boolean;
  trashCapability: TrashCapability;
  checkingTrashCapability: boolean;
  busy?: boolean;
  onCancel: () => void;
  onMoveToTrashChange: (moveToTrash: boolean) => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  count,
  totalSize,
  mode,
  moveToTrash,
  trashCapability,
  checkingTrashCapability,
  busy,
  onCancel,
  onMoveToTrashChange,
  onConfirm
}: ConfirmDialogProps) {
  const reduced = useReducedMotion();

  const trashUnavailable = trashCapability.status === "unavailable";
  const canConfirm = !busy && !checkingTrashCapability;
  const title = moveToTrash ? "确认移动到系统回收站？" : "确认永久删除？";
  const actionLabel = moveToTrash ? "确认删除" : "永久删除";

  return (
    <AnimatePresence>
      {open && (
    <motion.div className="modal-scrim" variants={dialogScrimVariants(reduced)} initial="hidden" animate="show" exit="exit">
      <motion.div className="modal-panel max-w-xl" variants={dialogPanelVariants(reduced)}>
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-warning-soft)] text-[var(--color-warning-strong)]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="type-section-title text-[var(--color-heading)]">{title}</h2>
              <p className="type-caption mt-1 text-[var(--color-muted)]">{formatDeleteMode(mode)}</p>
            </div>
          </div>
          <motion.button className="icon-btn text-[var(--color-subtle)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]" onClick={onCancel} aria-label="关闭" {...getPressMotion(reduced)}>
            <X className="h-5 w-5" />
          </motion.button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className={`type-body alert-panel ${moveToTrash ? "alert-orange" : "alert-red"}`}>
            {moveToTrash ? (
              <span>
                你将移动 {count} 个文件到系统回收站，预计释放 {formatBytes(totalSize)}。此操作通常可以从系统回收站还原。
              </span>
            ) : (
              <span>
                你将永久删除 {count} 个文件，预计释放 {formatBytes(totalSize)}。此操作不会进入系统回收站，删除后无法从本应用还原。
              </span>
            )}
          </div>

          <label className={`flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-strong)] px-3.5 py-3 shadow-[var(--shadow-subtle)] ${trashUnavailable ? "opacity-75" : ""}`}>
            <input
              type="checkbox"
              className="form-check mt-0.5 focus:ring-[var(--color-primary-ring)]"
              checked={moveToTrash}
              disabled={busy || checkingTrashCapability || trashUnavailable}
              onChange={(event) => onMoveToTrashChange(event.target.checked)}
            />
            <span className="min-w-0">
              <span className="type-ui block text-[var(--color-heading)]">移动到系统回收站</span>
              <span className="type-caption mt-1 block text-[var(--color-muted)]">
                {checkingTrashCapability ? "正在检测当前目录是否支持回收站..." : getTrashCapabilityMessage(trashCapability)}
              </span>
            </span>
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t border-[var(--color-border)] px-5 py-4">
          <motion.button className="btn btn-secondary" onClick={onCancel} {...getPressMotion(reduced)}>
            取消
          </motion.button>
          <motion.button
            className="btn btn-danger"
            disabled={!canConfirm}
            onClick={onConfirm}
            {...getPressMotion(reduced)}
          >
            <Trash2 className="h-4 w-4" />
            {busy ? (moveToTrash ? "正在移动" : "正在删除") : `${actionLabel}（${count} 个文件）`}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}

function getTrashCapabilityMessage(capability: TrashCapability): string {
  if (capability.status === "available") return capability.reason || "已检测到系统回收站能力。";
  if (capability.status === "unavailable") return capability.reason || "当前路径未检测到可用回收站。";
  return capability.reason || "无法预先确认回收站能力，请谨慎选择。";
}
