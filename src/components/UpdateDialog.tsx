import { DownloadCloud, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type { UpdateInfo, UpdateState } from "../../shared/types";
import { formatBytes } from "../lib/format";
import { dialogPanelVariants, dialogScrimVariants, getPressMotion } from "./MotionPrimitives";

interface UpdateDialogProps {
  open: boolean;
  info?: UpdateInfo;
  state: UpdateState;
  onCancel: () => void;
  onDownload: () => void;
  onInstall: () => void;
}

export function UpdateDialog({ open, info, state, onCancel, onDownload, onInstall }: UpdateDialogProps) {
  const reduced = useReducedMotion();

  const busy = state.status === "downloading" || state.status === "installing";
  const percent = state.total && state.total > 0 ? Math.min(100, Math.round(((state.downloaded ?? 0) / state.total) * 100)) : undefined;

  return (
    <AnimatePresence>
      {open && info && (
    <motion.div className="modal-scrim" variants={dialogScrimVariants(reduced)} initial="hidden" animate="show" exit="exit">
      <motion.div className="modal-panel max-w-xl" variants={dialogPanelVariants(reduced)}>
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-blue-soft)] text-[var(--color-accent-blue)]">
              <DownloadCloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="type-section-title text-[var(--color-heading)]">发现新版本 {info.version}</h2>
              <p className="type-caption mt-1 text-[var(--color-muted)]">当前版本 v{info.currentVersion}</p>
            </div>
          </div>
          <motion.button className="icon-btn text-[var(--color-subtle)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-heading)]" disabled={busy} onClick={onCancel} aria-label="关闭" {...getPressMotion(reduced)}>
            <X className="h-5 w-5" />
          </motion.button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {info.date && <div className="type-caption text-[var(--color-muted)]">发布时间：{formatDate(info.date)}</div>}
          <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-strong)]">
            <div className="type-card-title border-b border-[var(--color-border)] px-3 py-2 text-[var(--color-heading)]">更新日志</div>
            <div className="type-body max-h-40 overflow-auto whitespace-pre-wrap p-3 text-[var(--color-text)]">
              {info.body || "此版本包含稳定性改进。建议在没有进行扫描或删除操作时安装更新。"}
            </div>
          </section>

          <AnimatePresence>
            {(state.status === "downloading" || state.status === "ready" || state.status === "installing") && (
            <motion.div className="space-y-2" initial={{ opacity: 0, y: reduced ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -3 }} transition={{ duration: reduced ? 0.01 : 0.16, ease: "easeOut" }}>
              <div className="flex justify-between type-caption text-[var(--color-muted)]">
                <span>{state.status === "ready" ? "更新已下载，可安装并重启。" : state.status === "installing" ? "正在静默安装，完成后自动重启" : "正在下载更新"}</span>
                <span>{percent !== undefined ? `${percent}%` : formatBytes(state.downloaded ?? 0)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-accent-blue-soft)]">
                <div className="h-full rounded-full bg-[var(--color-accent-blue)] transition-all" style={{ width: `${state.status === "ready" ? 100 : percent ?? 30}%` }} />
              </div>
            </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {state.status === "error" && state.error && (
              <motion.div className="type-body alert-panel alert-red" initial={{ opacity: 0, y: reduced ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0.01 : 0.16, ease: "easeOut" }}>
                {state.error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--color-border)] px-5 py-4">
          <motion.button className="btn btn-secondary" disabled={busy} onClick={onCancel} {...getPressMotion(reduced)}>
            稍后
          </motion.button>
          {state.status === "ready" ? (
            <motion.button className="btn btn-blue" onClick={onInstall} {...getPressMotion(reduced)}>
              <DownloadCloud className="h-4 w-4" />
              安装并重启
            </motion.button>
          ) : (
            <motion.button
              className="btn btn-blue"
              disabled={busy}
              onClick={onDownload}
              {...getPressMotion(reduced)}
            >
              <DownloadCloud className="h-4 w-4" />
              {busy ? "正在下载" : "下载更新"}
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}

function formatDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleString();
}
