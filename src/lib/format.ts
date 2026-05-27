import type { DeleteMode, DirectoryMode } from "../../shared/types";

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

export function formatDeleteMode(mode: DeleteMode): string {
  return mode === "jpg_as_source_delete_raw" ? "以 JPG 为准删除 RAW" : "以 RAW 为准删除 JPG";
}

export function formatDirectoryMode(mode: DirectoryMode): string {
  const labels: Record<DirectoryMode, string> = {
    auto: "自动",
    separate_dirs: "双目录",
    mixed_dir: "混合目录",
    manual: "需手动确认"
  };

  return labels[mode];
}
