import type {
  CompareConflict,
  CompareResult,
  DeleteMode,
  DeleteResult,
  MatchedPair,
  MediaFile,
  ScanResult
} from "../../shared/types";

export interface MockScanBundle {
  rootPath: string;
  scanResult: ScanResult;
  compareResult: CompareResult;
  selectedPaths: Set<string>;
}

const DEFAULT_ROOT = "/Users/demo/Pictures/Sample Shoot";

export function createMockScanBundle(
  options: { rootPath?: string; mode?: DeleteMode } = {}
): MockScanBundle {
  const rootPath = options.rootPath ?? DEFAULT_ROOT;
  const mode = options.mode ?? "jpg_as_source_delete_raw";
  const imageFiles = [
    mediaFile(rootPath, "jpg/DSC_1001.jpg", "image", 4_600_000),
    mediaFile(rootPath, "jpg/DSC_1002.jpg", "image", 4_300_000),
    mediaFile(rootPath, "jpg/DSC_1003.jpg", "image", 5_100_000),
    mediaFile(rootPath, "jpg/DSC_2000.jpg", "image", 3_900_000),
    mediaFile(rootPath, "jpg/DSC_DUP.jpg", "image", 3_200_000),
    mediaFile(rootPath, "exports/DSC_DUP.jpeg", "image", 3_300_000)
  ];
  const rawFiles = [
    mediaFile(rootPath, "raw/DSC_1001.ARW", "raw", 42_000_000),
    mediaFile(rootPath, "raw/DSC_1002.ARW", "raw", 40_500_000),
    mediaFile(rootPath, "raw/DSC_1003.ARW", "raw", 43_400_000),
    mediaFile(rootPath, "raw/DSC_ORPHAN_01.ARW", "raw", 39_700_000),
    mediaFile(rootPath, "raw/DSC_ORPHAN_02.CR3", "raw", 45_900_000),
    mediaFile(rootPath, "archive/DSC_ORPHAN_03.NEF", "raw", 38_100_000),
    mediaFile(rootPath, "raw/DSC_DUP.ARW", "raw", 41_300_000)
  ];
  const sidecarFiles = [
    mediaFile(rootPath, "raw/DSC_1001.xmp", "sidecar", 24_000),
    mediaFile(rootPath, "raw/DSC_ORPHAN_01.dop", "sidecar", 18_000)
  ];
  const matchedPairs: MatchedPair[] = [
    { key: "dsc_1001", image: imageFiles[0], raw: rawFiles[0] },
    { key: "dsc_1002", image: imageFiles[1], raw: rawFiles[1] },
    { key: "dsc_1003", image: imageFiles[2], raw: rawFiles[2] }
  ];
  const conflicts: CompareConflict[] = [
    {
      key: "dsc_dup",
      reason: "duplicate_image",
      files: [imageFiles[4], imageFiles[5], rawFiles[6]]
    }
  ];
  const deleteCandidates =
    mode === "jpg_as_source_delete_raw"
      ? [rawFiles[3], rawFiles[4], rawFiles[5]]
      : [imageFiles[3]];
  const scanResult: ScanResult = {
    rootPath,
    directoryMode: "separate_dirs",
    imageFiles,
    rawFiles,
    sidecarFiles,
    unknownFiles: [],
    jpgDirectory: `${rootPath}/jpg`,
    rawDirectory: `${rootPath}/raw`
  };
  const compareResult: CompareResult = {
    mode,
    directoryMode: scanResult.directoryMode,
    imageFiles,
    rawFiles,
    matchedPairs,
    deleteCandidates,
    conflicts,
    totalDeleteSize: deleteCandidates.reduce((total, file) => total + file.size, 0)
  };

  return {
    rootPath,
    scanResult,
    compareResult,
    selectedPaths: new Set(deleteCandidates.map((file) => file.path))
  };
}

export function createMockDeleteResult(
  files: MediaFile[],
  options: { mode: DeleteMode; rootPath: string }
): DeleteResult {
  const now = new Date().toISOString();

  return {
    startedAt: now,
    finishedAt: now,
    mode: options.mode,
    rootPath: options.rootPath,
    operation: "trash",
    total: files.length,
    success: files.length,
    failed: 0,
    logPath: `${options.rootPath}/.raw-pair-cleaner/mock-delete-log.json`,
    items: files.map((file) => ({
      path: file.path,
      size: file.size,
      status: "moved_to_trash"
    }))
  };
}

function mediaFile(
  rootPath: string,
  relativePath: string,
  kind: MediaFile["kind"],
  size: number
): MediaFile {
  const path = `${rootPath}/${relativePath}`;
  const segments = relativePath.split("/");
  const name = segments[segments.length - 1] ?? relativePath;
  const dotIndex = name.lastIndexOf(".");
  const ext = dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : "";
  const key = dotIndex >= 0 ? name.slice(0, dotIndex).toLowerCase() : name.toLowerCase();

  return {
    path,
    name,
    ext,
    key,
    kind,
    size,
    modifiedAt: new Date("2026-05-26T00:00:00.000Z").getTime()
  };
}
