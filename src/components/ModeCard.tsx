import { ArrowRight, CheckCircle2, Circle, FileImage, ShieldCheck, Trash2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import type { DeleteMode } from "../../shared/types";
import { getCardPressMotion } from "./MotionPrimitives";

interface ModeCardProps {
  mode: DeleteMode;
  title: string;
  description: string;
  sourceLabel: "JPG" | "RAW";
  deleteLabel: "JPG" | "RAW";
  active: boolean;
  onSelect: (mode: DeleteMode) => void;
}

export function ModeCard({ mode, title, description, sourceLabel, deleteLabel, active, onSelect }: ModeCardProps) {
  const reduced = useReducedMotion();

  return (
    <motion.button
      className={[
        "group flex min-h-[116px] flex-1 gap-3 rounded-[var(--radius-lg)] border bg-[var(--color-surface-strong)] p-3 text-left shadow-[var(--shadow-panel)] transition",
        active
          ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] shadow-[var(--shadow-selected-mode)]"
          : "border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]"
      ].join(" ")}
      onClick={() => onSelect(mode)}
      layout
      {...getCardPressMotion(reduced)}
    >
      {active ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary-strong)]" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-subtle)]" />}
      <span className="min-w-0 flex-1">
        <span className="type-ui block text-[var(--color-heading)]">{title}</span>
        <span className="type-body mt-1 block text-[var(--color-muted)]">{description}</span>
        <span className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-tint)] p-2" aria-hidden="true">
          <ModeNode icon="source" label={`保留 ${sourceLabel}`} tone="source" />
          <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-subtle)] transition group-hover:translate-x-0.5" />
          <ModeNode icon="trash" label={`删除 ${deleteLabel}`} tone="delete" />
        </span>
      </span>
    </motion.button>
  );
}

function ModeNode({ icon, label, tone }: { icon: "source" | "trash"; label: string; tone: "source" | "delete" }) {
  const isSource = tone === "source";
  const Icon = icon === "source" ? ShieldCheck : Trash2;

  return (
    <span
      className={[
        "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2",
        isSource ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]" : "bg-[var(--color-warning-soft)] text-[var(--color-warning-strong)]"
      ].join(" ")}
    >
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-glass-highlight)]">
        <FileImage className="h-4 w-4 opacity-80" />
        <Icon className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-[var(--color-surface-hover)] p-0.5" />
      </span>
      <span className="type-caption truncate">{label}</span>
    </span>
  );
}
