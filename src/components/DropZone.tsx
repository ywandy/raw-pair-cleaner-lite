import { FolderOpen, UploadCloud } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import { getCardPressMotion, getPressMotion } from "./MotionPrimitives";

interface DropZoneProps {
  rootPath?: string;
  disabled?: boolean;
  onBrowse: () => void;
  onDropFile: (file: File) => void;
}

export function DropZone({ rootPath, disabled, onBrowse, onDropFile }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={[
        "panel-compact flex min-h-28 items-center gap-4 border-2 border-dashed text-left transition",
        dragging ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border-strong)]",
        disabled ? "opacity-60" : "hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
      ].join(" ")}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (disabled) return;
        const file = event.dataTransfer.files.item(0);
        if (file) onDropFile(file);
      }}
      animate={{ scale: dragging && !reduced ? 1.006 : 1 }}
      transition={{ duration: reduced ? 0.01 : 0.18, ease: "easeOut" }}
      {...(!disabled ? getCardPressMotion(reduced) : {})}
    >
      <motion.div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]"
        animate={{ y: dragging && !reduced ? -2 : 0 }}
        transition={{ duration: reduced ? 0.01 : 0.18, ease: "easeOut" }}
      >
        <UploadCloud className="h-5 w-5" />
      </motion.div>
      <div className="min-w-0 flex-1">
        <div className="type-section-title text-[var(--color-primary-strong)]">拖入照片目录到这里</div>
        <div className="type-body mt-1 truncate text-[var(--color-muted)]" title={rootPath}>
          {rootPath || "支持拖拽文件夹到此处，或点击选择目录"}
        </div>
      </div>
      <motion.button
        className="btn btn-secondary shrink-0"
        disabled={disabled}
        onClick={onBrowse}
        {...getPressMotion(reduced)}
      >
        <FolderOpen className="h-4 w-4" />
        选择目录
      </motion.button>
    </motion.div>
  );
}
