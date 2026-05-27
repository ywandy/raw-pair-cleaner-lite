import type { CompareResult, MediaFile, ScanResult } from "../../shared/types";
import { normalizePath } from "./fileTree";

export interface DirectoryDistributionItem {
  name: string;
  imageCount: number;
  rawCount: number;
  deleteCount: number;
  totalCount: number;
}

export function countFirstLevelDirectories(scanResult: ScanResult): number {
  return new Set(getAllScannedFiles(scanResult).map((file) => getFirstLevelDirectoryName(file.path, scanResult.rootPath))).size;
}

export function buildDirectoryDistribution(scanResult: ScanResult, compareResult: CompareResult): DirectoryDistributionItem[] {
  const items = new Map<string, DirectoryDistributionItem>();

  for (const file of scanResult.imageFiles) {
    getOrCreateItem(items, file.path, scanResult.rootPath).imageCount += 1;
  }

  for (const file of scanResult.rawFiles) {
    getOrCreateItem(items, file.path, scanResult.rootPath).rawCount += 1;
  }

  for (const file of compareResult.deleteCandidates) {
    getOrCreateItem(items, file.path, scanResult.rootPath).deleteCount += 1;
  }

  return [...items.values()]
    .map((item) => ({
      ...item,
      totalCount: item.imageCount + item.rawCount
    }))
    .sort((left, right) => right.totalCount - left.totalCount || left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }));
}

function getAllScannedFiles(scanResult: ScanResult): MediaFile[] {
  return [...scanResult.imageFiles, ...scanResult.rawFiles, ...scanResult.sidecarFiles, ...scanResult.unknownFiles];
}

function getOrCreateItem(items: Map<string, DirectoryDistributionItem>, filePath: string, rootPath: string): DirectoryDistributionItem {
  const name = getFirstLevelDirectoryName(filePath, rootPath);
  const current = items.get(name);
  if (current) return current;

  const next: DirectoryDistributionItem = {
    name,
    imageCount: 0,
    rawCount: 0,
    deleteCount: 0,
    totalCount: 0
  };
  items.set(name, next);
  return next;
}

function getFirstLevelDirectoryName(filePath: string, rootPath: string): string {
  const rootSegments = normalizePath(rootPath).segments;
  const fileSegments = normalizePath(filePath).segments;
  const relativeSegments = isPrefix(rootSegments, fileSegments) ? fileSegments.slice(rootSegments.length) : fileSegments;

  if (relativeSegments.length <= 1) return "根目录";
  return relativeSegments[0];
}

function isPrefix(prefix: string[], value: string[]): boolean {
  return prefix.every((segment, index) => value[index] === segment);
}
