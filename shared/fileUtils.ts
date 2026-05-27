import path from "node:path";

import { IMAGE_EXTENSIONS, RAW_EXTENSIONS, SIDECAR_EXTENSIONS } from "./fileExtensions.js";
import type { MediaKind } from "./types.js";

export function normalizeExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

export function getFileKey(filePath: string): string {
  const filename = path.basename(filePath);
  const ext = path.extname(filename);
  return filename.slice(0, filename.length - ext.length).toLowerCase();
}

export function getMediaKind(filePath: string): MediaKind {
  const ext = normalizeExtension(filePath);

  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (RAW_EXTENSIONS.includes(ext)) return "raw";
  if (SIDECAR_EXTENSIONS.includes(ext)) return "sidecar";

  return "unknown";
}

export function isHiddenName(name: string): boolean {
  return name.startsWith(".");
}
