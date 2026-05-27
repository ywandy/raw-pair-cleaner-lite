import type { DirectoryMode } from "../../shared/types";
import { formatDirectoryMode } from "../lib/format";

export function DirectoryModeBadge({ mode }: { mode: DirectoryMode }) {
  const className =
    mode === "separate_dirs"
      ? "bg-[var(--color-directory-separate-bg)] text-[var(--color-directory-separate-text)] ring-[var(--color-directory-separate-ring)]"
      : mode === "mixed_dir"
        ? "bg-[var(--color-directory-mixed-bg)] text-[var(--color-directory-mixed-text)] ring-[var(--color-directory-mixed-ring)]"
        : "bg-[var(--color-directory-manual-bg)] text-[var(--color-directory-manual-text)] ring-[var(--color-directory-manual-ring)]";

  return (
    <span className={`type-caption inline-flex items-center rounded-full px-3 py-1 ring-1 ${className}`}>
      {formatDirectoryMode(mode)}
    </span>
  );
}
