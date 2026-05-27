import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { compareFiles } from "../src/services/compareService";
import { scanDirectory } from "../src/services/scanService";
import { getFileKey, getMediaKind } from "../../shared/fileUtils";
import type { MediaFile, ScanResult } from "../../shared/types";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "raw-pair-sidecar-scan-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function mediaFile(name: string, kind: MediaFile["kind"], size = 10): MediaFile {
  return {
    path: path.join("/photos", kind, name),
    name,
    ext: path.extname(name).toLowerCase(),
    key: getFileKey(name),
    kind,
    size,
    modifiedAt: 1
  };
}

describe("shared file utilities", () => {
  it("normalizes file keys and classifies media extensions", () => {
    expect(getFileKey("/Photos/IMG_0042.CR3")).toBe("img_0042");
    expect(getFileKey("Vacation.Final.JPG")).toBe("vacation.final");
    expect(getMediaKind("photo.HEIC")).toBe("image");
    expect(getMediaKind("photo.CR3")).toBe("raw");
    expect(getMediaKind("photo.XMP")).toBe("sidecar");
    expect(getMediaKind("photo.txt")).toBe("unknown");
  });
});

describe("scanDirectory", () => {
  it("detects separate JPG and RAW directories and skips hidden files by default", async () => {
    await withTempDir(async (root) => {
      await mkdir(path.join(root, "JPG"));
      await mkdir(path.join(root, "RAW"));
      await writeFile(path.join(root, "JPG", "IMG_0001.JPG"), "");
      await writeFile(path.join(root, "JPG", ".hidden.jpg"), "");
      await writeFile(path.join(root, "RAW", "IMG_0001.CR3"), "raw");
      await writeFile(path.join(root, "RAW", "IMG_0002.CR3"), "rawraw");

      const result = await scanDirectory(root, {
        recursive: true,
        includeHiddenFiles: false,
        ignoreCase: true
      });

      expect(result.directoryMode).toBe("separate_dirs");
      expect(result.imageFiles.map((file) => file.name)).toEqual(["IMG_0001.JPG"]);
      expect(result.rawFiles).toHaveLength(2);
      expect(result.jpgDirectory).toBe(path.join(root, "JPG"));
      expect(result.rawDirectory).toBe(path.join(root, "RAW"));
    });
  });

  it("detects mixed directories when image and RAW files share the same folder", async () => {
    await withTempDir(async (root) => {
      await writeFile(path.join(root, "IMG_0001.JPG"), "");
      await writeFile(path.join(root, "IMG_0001.CR3"), "raw");
      await writeFile(path.join(root, "IMG_0001.xmp"), "sidecar");

      const result = await scanDirectory(root, {
        recursive: true,
        includeHiddenFiles: false,
        ignoreCase: true
      });

      expect(result.directoryMode).toBe("mixed_dir");
      expect(result.imageFiles).toHaveLength(1);
      expect(result.rawFiles).toHaveLength(1);
      expect(result.sidecarFiles).toHaveLength(1);
    });
  });
});

describe("compareFiles", () => {
  it("uses JPG as source and excludes duplicate-key conflicts from delete candidates", () => {
    const image = mediaFile("IMG_0001.jpg", "image");
    const rawMatch = mediaFile("IMG_0001.CR3", "raw", 100);
    const rawOrphan = mediaFile("IMG_0002.CR3", "raw", 200);
    const duplicateA = mediaFile("IMG_0003.CR3", "raw", 300);
    const duplicateB = mediaFile("IMG_0003.NEF", "raw", 400);

    const scanResult: ScanResult = {
      rootPath: "/photos",
      directoryMode: "mixed_dir",
      imageFiles: [image],
      rawFiles: [rawMatch, rawOrphan, duplicateA, duplicateB],
      sidecarFiles: [],
      unknownFiles: []
    };

    const result = compareFiles(scanResult, "jpg_as_source_delete_raw");

    expect(result.matchedPairs).toHaveLength(1);
    expect(result.deleteCandidates).toEqual([rawOrphan]);
    expect(result.totalDeleteSize).toBe(200);
    expect(result.conflicts).toEqual([
      {
        key: "img_0003",
        reason: "duplicate_raw",
        files: [duplicateA, duplicateB]
      }
    ]);
  });

  it("uses RAW as source and excludes duplicate image conflicts from delete candidates", () => {
    const imageMatch = mediaFile("IMG_0001.jpg", "image", 100);
    const raw = mediaFile("IMG_0001.CR3", "raw", 200);
    const imageOrphan = mediaFile("IMG_0002.jpg", "image", 300);
    const duplicateA = mediaFile("IMG_0003.jpg", "image", 400);
    const duplicateB = mediaFile("IMG_0003.jpeg", "image", 500);

    const scanResult: ScanResult = {
      rootPath: "/photos",
      directoryMode: "mixed_dir",
      imageFiles: [imageMatch, imageOrphan, duplicateA, duplicateB],
      rawFiles: [raw],
      sidecarFiles: [],
      unknownFiles: []
    };

    const result = compareFiles(scanResult, "raw_as_source_delete_jpg");

    expect(result.matchedPairs).toHaveLength(1);
    expect(result.deleteCandidates).toEqual([imageOrphan]);
    expect(result.totalDeleteSize).toBe(300);
    expect(result.conflicts).toEqual([
      {
        key: "img_0003",
        reason: "duplicate_image",
        files: [duplicateA, duplicateB]
      }
    ]);
  });
});
