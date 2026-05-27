import { FolderSearch } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className="flex min-h-[320px] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-strong)] text-center shadow-[var(--shadow-panel)]"
      initial={{ opacity: 0, y: reduced ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.01 : 0.2, ease: "easeOut" }}
    >
      <FolderSearch className="h-9 w-9 text-[var(--color-subtle)]" />
      <h2 className="type-section-title mt-3 text-[var(--color-heading)]">{title}</h2>
      {description && <p className="type-body mt-2 max-w-md text-[var(--color-muted)]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
