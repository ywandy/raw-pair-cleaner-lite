import type {
  CompareConflict,
  CompareConflictReason,
  CompareResult,
  DeleteMode,
  MediaFile,
  MatchedPair,
  ScanResult
} from "../../../shared/types";

export function compareFiles(scanResult: ScanResult, mode: DeleteMode): CompareResult {
  const imageGroups = groupByKey(scanResult.imageFiles);
  const rawGroups = groupByKey(scanResult.rawFiles);
  const keys = new Set([...imageGroups.keys(), ...rawGroups.keys()]);
  const matchedPairs: MatchedPair[] = [];
  const conflicts: CompareConflict[] = [];
  const deleteCandidates: MediaFile[] = [];

  for (const key of keys) {
    const images = imageGroups.get(key) ?? [];
    const raws = rawGroups.get(key) ?? [];
    const conflictReason = getConflictReason(images, raws);

    if (conflictReason) {
      conflicts.push({
        key,
        reason: conflictReason,
        files: [...images, ...raws]
      });
      continue;
    }

    const image = images[0];
    const raw = raws[0];

    if (image && raw) {
      matchedPairs.push({ key, image, raw });
      continue;
    }

    if (mode === "jpg_as_source_delete_raw" && raw && !image) {
      deleteCandidates.push(raw);
    }

    if (mode === "raw_as_source_delete_jpg" && image && !raw) {
      deleteCandidates.push(image);
    }
  }

  return {
    mode,
    directoryMode: scanResult.directoryMode,
    imageFiles: scanResult.imageFiles,
    rawFiles: scanResult.rawFiles,
    matchedPairs,
    deleteCandidates,
    conflicts,
    totalDeleteSize: deleteCandidates.reduce((total, file) => total + file.size, 0)
  };
}

function groupByKey(files: MediaFile[]): Map<string, MediaFile[]> {
  const groups = new Map<string, MediaFile[]>();

  for (const file of files) {
    const current = groups.get(file.key) ?? [];
    current.push(file);
    groups.set(file.key, current);
  }

  return groups;
}

function getConflictReason(
  images: MediaFile[],
  raws: MediaFile[]
): CompareConflictReason | undefined {
  if (images.length > 1 && raws.length > 1) return "ambiguous_match";
  if (images.length > 1) return "duplicate_image";
  if (raws.length > 1) return "duplicate_raw";
  return undefined;
}
