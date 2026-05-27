import { Camera, Search } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import type { DeleteMode } from "../../shared/types";
import { DropZone } from "../components/DropZone";
import { ModeSelector } from "../components/ModeSelector";
import { getPressMotion, MotionItem, MotionStack } from "../components/MotionPrimitives";
import { WarningPanel } from "../components/WarningPanel";

interface HomePageProps {
  rootPath?: string;
  mode: DeleteMode;
  error?: string;
  scanning: boolean;
  onModeChange: (mode: DeleteMode) => void;
  onBrowse: () => void;
  onDropFile: (file: File) => void;
  onStartScan: () => void;
}

export function HomePage({ rootPath, mode, error, scanning, onModeChange, onBrowse, onDropFile, onStartScan }: HomePageProps) {
  const reduced = useReducedMotion();

  return (
    <div className="page">
      <div className="page-scroll">
        <MotionStack className="page-stack">
          <MotionItem>
            <section className="page-header">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-panel">
                  <Camera className="h-6 w-6" />
                </div>
                <div className="page-title-group">
                  <h1 className="type-page-title page-title truncate">RAW Pair Cleaner / 底片清理器</h1>
                  <p className="type-page-subtitle page-subtitle">智能识别 RAW 与 JPG 匹配关系，安全清理冗余文件</p>
                </div>
              </div>
            </section>
          </MotionItem>

          {error && (
            <MotionItem>
              <WarningPanel title="操作未完成" tone="red">
                {error}
              </WarningPanel>
            </MotionItem>
          )}

          <MotionItem>
            <DropZone rootPath={rootPath} disabled={scanning} onBrowse={onBrowse} onDropFile={onDropFile} />
          </MotionItem>
          <MotionItem>
            <ModeSelector value={mode} onChange={onModeChange} />
          </MotionItem>
        </MotionStack>
      </div>

      <div className="page-actionbar">
        <div className="flex justify-end">
          <motion.button
            className="btn btn-primary min-w-44"
            disabled={!rootPath || scanning}
            onClick={onStartScan}
            {...getPressMotion(reduced)}
          >
            <Search className="h-4 w-4" />
            {scanning ? "正在扫描" : "开始扫描"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
