import type {
  AppSettings,
  CompareConflict,
  DeleteMode,
  DirectoryMode,
  MatchedPair,
  MediaFile,
  ScanOptions
} from "./types";

export type SidecarCommand = "scan" | "trash" | "settings-get" | "settings-save";

export type SidecarEventType = "started" | "progress" | "result" | "warning" | "error";

export interface SidecarError {
  code: string;
  message: string;
  detail?: string;
}

export interface SidecarEvent<T = unknown> {
  protocolVersion: 1;
  command: SidecarCommand;
  taskId: string;
  event: SidecarEventType;
  timestamp: string;
  data?: T;
  error?: SidecarError;
}

export interface ScanRequest {
  protocolVersion: 1;
  taskId: string;
  rootPath: string;
  deleteMode: DeleteMode;
  dataDir?: string;
  options: ScanOptions;
}

export interface SidecarScanResult {
  scanId: string;
  rootPath: string;
  deleteMode: DeleteMode;
  directoryMode: DirectoryMode;
  imageFiles: MediaFile[];
  rawFiles: MediaFile[];
  sidecarFiles: MediaFile[];
  unknownFiles: MediaFile[];
  matchedCount: number;
  matchedPairs: MatchedPair[];
  conflicts: CompareConflict[];
  deleteCandidates: MediaFile[];
  totalDeleteSize: number;
  jpgDirectory?: string;
  rawDirectory?: string;
  manifestPath?: string;
}

export interface DeleteManifestCandidate {
  path: string;
  size: number;
  modifiedAt: number;
}

export interface DeleteManifest {
  protocolVersion: 1;
  scanId: string;
  rootPath: string;
  deleteMode: DeleteMode;
  createdAt: string;
  candidates: DeleteManifestCandidate[];
}

export interface TrashRequest {
  protocolVersion: 1;
  taskId: string;
  scanId: string;
  rootPath: string;
  dataDir?: string;
  confirmed: true;
  generateLog?: boolean;
  selectedFiles: Array<{
    path: string;
    size: number;
  }>;
}

export interface TrashResultItem {
  path: string;
  size: number;
  status: "moved_to_trash" | "failed";
  error?: string;
}

export interface TrashResult {
  taskId: string;
  scanId: string;
  total: number;
  successCount: number;
  failedCount: number;
  releasedSize: number;
  items: TrashResultItem[];
  logPath?: string;
}

export interface SettingsGetRequest {
  protocolVersion: 1;
  taskId: string;
  dataDir?: string;
}

export interface SettingsSaveRequest {
  protocolVersion: 1;
  taskId: string;
  dataDir?: string;
  settings: Partial<AppSettings>;
}
