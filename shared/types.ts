export type DeleteMode = "jpg_as_source_delete_raw" | "raw_as_source_delete_jpg";

export type DirectoryMode = "auto" | "separate_dirs" | "mixed_dir" | "manual";

export type MediaKind = "image" | "raw" | "sidecar" | "unknown";

export type DeleteOperation = "trash" | "permanent";

export type TrashCapabilityStatus = "available" | "unavailable" | "unknown";

export type CompareConflictReason = "duplicate_image" | "duplicate_raw" | "ambiguous_match";

export type PlatformName = "darwin" | "win32" | "linux" | string;

export type FontScale = "small" | "medium" | "large";

export interface MediaFile {
  path: string;
  name: string;
  ext: string;
  key: string;
  kind: MediaKind;
  size: number;
  modifiedAt: number;
}

export interface ScanOptions {
  recursive: boolean;
  includeHiddenFiles: boolean;
  ignoreCase: boolean;
}

export interface ScanResult {
  rootPath: string;
  directoryMode: DirectoryMode;
  imageFiles: MediaFile[];
  rawFiles: MediaFile[];
  sidecarFiles: MediaFile[];
  unknownFiles: MediaFile[];
  jpgDirectory?: string;
  rawDirectory?: string;
}

export interface MatchedPair {
  key: string;
  image?: MediaFile;
  raw?: MediaFile;
}

export interface CompareConflict {
  key: string;
  reason: CompareConflictReason;
  files: MediaFile[];
}

export interface CompareResult {
  mode: DeleteMode;
  directoryMode: DirectoryMode;
  imageFiles: MediaFile[];
  rawFiles: MediaFile[];
  matchedPairs: MatchedPair[];
  deleteCandidates: MediaFile[];
  conflicts: CompareConflict[];
  totalDeleteSize: number;
}

export interface DeleteContext {
  mode: DeleteMode;
  rootPath: string;
  operation?: DeleteOperation;
}

export interface DeleteResultItem {
  path: string;
  size: number;
  status: "moved_to_trash" | "deleted_permanently" | "failed";
  error?: string;
}

export interface DeleteResult {
  startedAt: string;
  finishedAt: string;
  mode: DeleteMode;
  rootPath: string;
  operation: DeleteOperation;
  total: number;
  success: number;
  failed: number;
  logPath?: string;
  items: DeleteResultItem[];
}

export interface TrashCapability {
  status: TrashCapabilityStatus;
  checkedPath: string;
  reason?: string;
}

export interface UpdateSettings {
  autoCheckOnStartup: boolean;
  lastCheckedAt?: string;
  releaseProxyPrefix: string;
}

export interface UpdateInfo {
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
}

export interface UpdateCheckResult {
  available: boolean;
  currentVersion?: string;
  info?: UpdateInfo;
}

export interface UpdateProgress {
  downloaded: number;
  total?: number;
}

export type UpdateStatus = "idle" | "checking" | "available" | "not-available" | "downloading" | "ready" | "installing" | "error";

export interface UpdateState {
  status: UpdateStatus;
  info?: UpdateInfo;
  downloaded?: number;
  total?: number;
  error?: string;
}

export interface AppSettings {
  appearance: {
    fontScale: FontScale;
  };
  scan: {
    recursive: boolean;
    includeHiddenFiles: boolean;
    ignoreCase: boolean;
  };
  delete: {
    generateLog: boolean;
  };
  sidecar: {
    deleteWithRaw: boolean;
    extensions: string[];
  };
  updates: UpdateSettings;
}
