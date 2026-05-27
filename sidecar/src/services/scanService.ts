import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import { IMAGE_DIRECTORY_NAMES, RAW_DIRECTORY_NAMES } from "../../../shared/fileExtensions";
import {
  getFileKey,
  getMediaKind,
  isHiddenName,
  normalizeExtension
} from "../../../shared/fileUtils";
import type { DirectoryMode, MediaFile, ScanOptions, ScanResult } from "../../../shared/types";

interface DirectoryDetection {
  directoryMode: DirectoryMode;
  jpgDirectory?: string;
  rawDirectory?: string;
}

export async function scanDirectory(rootPath: string, options: ScanOptions): Promise<ScanResult> {
  const rootStats = await stat(rootPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      throw new Error("目录不存在，请重新选择。");
    }
    if (error.code === "EACCES" || error.code === "EPERM") {
      throw new Error("无法读取该目录，请检查系统权限。");
    }
    throw error;
  });

  if (!rootStats.isDirectory()) {
    throw new Error("请选择照片目录。");
  }

  const rootDirectoryDetection = await detectRootDirectories(rootPath, options);
  const filePaths = await walkDirectory(rootPath, options);
  const mediaFiles = await Promise.all(filePaths.map(toMediaFile));
  const imageFiles = mediaFiles.filter((file) => file.kind === "image");
  const rawFiles = mediaFiles.filter((file) => file.kind === "raw");
  const sidecarFiles = mediaFiles.filter((file) => file.kind === "sidecar");
  const unknownFiles = mediaFiles.filter((file) => file.kind === "unknown");
  const detection = detectDirectoryMode(rootPath, imageFiles, rawFiles, rootDirectoryDetection);

  return {
    rootPath,
    ...detection,
    imageFiles,
    rawFiles,
    sidecarFiles,
    unknownFiles
  };
}

export function detectDirectoryMode(
  rootPath: string,
  imageFiles: MediaFile[],
  rawFiles: MediaFile[],
  rootDirectoryDetection: Partial<DirectoryDetection> = {}
): DirectoryDetection {
  const imageDirectory =
    rootDirectoryDetection.jpgDirectory ??
    findFirstMatchingDirectory(rootPath, imageFiles, IMAGE_DIRECTORY_NAMES);
  const rawDirectory =
    rootDirectoryDetection.rawDirectory ??
    findFirstMatchingDirectory(rootPath, rawFiles, RAW_DIRECTORY_NAMES);

  if (imageDirectory && rawDirectory && imageDirectory !== rawDirectory) {
    return {
      directoryMode: "separate_dirs",
      jpgDirectory: imageDirectory,
      rawDirectory
    };
  }

  if (imageFiles.length > 0 && rawFiles.length > 0) {
    return {
      directoryMode: "mixed_dir"
    };
  }

  return {
    directoryMode: "manual"
  };
}

async function walkDirectory(rootPath: string, options: ScanOptions): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentPath: string, depth: number): Promise<void> {
    let entries;
    try {
      entries = await readdir(currentPath, { withFileTypes: true });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EACCES" || code === "EPERM") {
        throw new Error("无法读取该目录，请检查系统权限。");
      }
      throw error;
    }

    for (const entry of entries) {
      if (!options.includeHiddenFiles && isHiddenName(entry.name)) {
        continue;
      }

      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (options.recursive || depth === 0) {
          await walk(entryPath, depth + 1);
        }
      } else if (entry.isFile()) {
        results.push(entryPath);
      }
    }
  }

  await walk(rootPath, 0);
  return results;
}

async function toMediaFile(filePath: string): Promise<MediaFile> {
  const fileStats = await stat(filePath);

  return {
    path: filePath,
    name: path.basename(filePath),
    ext: normalizeExtension(filePath),
    key: getFileKey(filePath),
    kind: getMediaKind(filePath),
    size: fileStats.size,
    modifiedAt: fileStats.mtimeMs
  };
}

async function detectRootDirectories(
  rootPath: string,
  options: ScanOptions
): Promise<Partial<DirectoryDetection>> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  let jpgDirectory: string | undefined;
  let rawDirectory: string | undefined;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!options.includeHiddenFiles && isHiddenName(entry.name)) continue;

    const normalizedName = entry.name.toLowerCase();
    if (!jpgDirectory && IMAGE_DIRECTORY_NAMES.includes(normalizedName)) {
      jpgDirectory = path.join(rootPath, entry.name);
    }
    if (!rawDirectory && RAW_DIRECTORY_NAMES.includes(normalizedName)) {
      rawDirectory = path.join(rootPath, entry.name);
    }
  }

  return { jpgDirectory, rawDirectory };
}

function findFirstMatchingDirectory(
  rootPath: string,
  files: MediaFile[],
  directoryNames: string[]
): string | undefined {
  for (const file of files) {
    const relativePath = path.relative(rootPath, file.path);
    const segments = relativePath.split(path.sep);
    if (segments.length < 2) continue;

    const firstSegment = segments[0].toLowerCase();
    if (directoryNames.includes(firstSegment)) {
      return path.join(rootPath, segments[0]);
    }
  }

  return undefined;
}
