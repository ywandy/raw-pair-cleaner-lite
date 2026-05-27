import type { MatchedPair, MediaFile } from "../../shared/types";

export interface FileTreeFileNode {
  type: "file";
  id: string;
  name: string;
  path: string;
  relativePath: string;
  parentPath: string;
  file: MediaFile;
  matchedFile?: MediaFile;
}

export interface FileTreeDirectoryNode {
  type: "directory";
  id: string;
  name: string;
  path: string;
  relativePath: string;
  children: FileTreeNode[];
  fileCount: number;
  totalSize: number;
}

export type FileTreeNode = FileTreeDirectoryNode | FileTreeFileNode;

export interface FileTreeData {
  basePath: string;
  nodes: FileTreeNode[];
  allDirectoryIds: string[];
}

export type SelectionState = "checked" | "indeterminate" | "unchecked";

export interface SelectedFileSummary {
  count: number;
  size: number;
  folderCount: number;
}

interface NormalizedPath {
  originalPath: string;
  normalizedPath: string;
  segments: string[];
}

interface DirectoryDraft {
  type: "directory";
  id: string;
  name: string;
  path: string;
  relativePath: string;
  children: Map<string, DirectoryDraft>;
  files: FileTreeFileNode[];
}

export function buildFileTree(files: MediaFile[], matchedPairs: MatchedPair[]): FileTreeData {
  const normalizedFiles = files.map((file) => ({ file, path: normalizePath(file.path) }));
  const baseSegments = getCommonDirectorySegments(normalizedFiles.map((item) => item.path));
  const basePath = toDisplayPath(baseSegments);
  const rootDirectories = new Map<string, DirectoryDraft>();
  const rootFiles: FileTreeFileNode[] = [];
  const matchedFileByPath = createMatchedFileMap(matchedPairs);

  for (const { file, path } of normalizedFiles) {
    const relativeSegments = stripBaseSegments(path.segments, baseSegments);
    const fileName = relativeSegments[relativeSegments.length - 1] ?? file.name;
    const directorySegments = relativeSegments.slice(0, -1);
    const fileNode = createFileNode(file, fileName, directorySegments, baseSegments, matchedFileByPath.get(file.path));

    if (directorySegments.length === 0) {
      rootFiles.push(fileNode);
      continue;
    }

    let currentMap = rootDirectories;
    let currentDirectory: DirectoryDraft | undefined;

    for (let index = 0; index < directorySegments.length; index += 1) {
      const segment = directorySegments[index];
      const fullSegments = [...baseSegments, ...directorySegments.slice(0, index + 1)];
      const id = toDisplayPath(fullSegments);
      let draft = currentMap.get(segment);

      if (!draft) {
        draft = {
          type: "directory",
          id,
          name: segment,
          path: id,
          relativePath: toDisplayPath(directorySegments.slice(0, index + 1)),
          children: new Map(),
          files: []
        };
        currentMap.set(segment, draft);
      }

      currentDirectory = draft;
      currentMap = draft.children;
    }

    currentDirectory?.files.push(fileNode);
  }

  const directoryIds: string[] = [];
  const nodes = [...directoryDraftsToNodes(rootDirectories, directoryIds), ...sortFileNodes(rootFiles)];

  return {
    basePath,
    nodes,
    allDirectoryIds: directoryIds
  };
}

export function collectFilePaths(node: FileTreeNode): string[] {
  if (node.type === "file") return [node.path];
  return node.children.flatMap(collectFilePaths);
}

export function collectVisibleFilePaths(nodes: FileTreeNode[]): string[] {
  return nodes.flatMap(collectFilePaths);
}

export function filterFileTree(tree: FileTreeData, query: string): FileTreeData {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return tree;

  const directoryIds: string[] = [];
  const nodes = tree.nodes
    .map((node) => filterTreeNode(node, normalizedQuery, directoryIds))
    .filter((node): node is FileTreeNode => Boolean(node));

  return {
    ...tree,
    nodes,
    allDirectoryIds: directoryIds
  };
}

export function getSelectionState(paths: string[], selectedPaths: Set<string>): SelectionState {
  if (paths.length === 0) return "unchecked";
  const selectedCount = paths.filter((path) => selectedPaths.has(path)).length;
  if (selectedCount === 0) return "unchecked";
  if (selectedCount === paths.length) return "checked";
  return "indeterminate";
}

export function countSelected(paths: string[], selectedPaths: Set<string>): number {
  return paths.filter((path) => selectedPaths.has(path)).length;
}

export function createSelectedFileSummary(files: MediaFile[], selectedPaths: Set<string>): SelectedFileSummary {
  const selectedFiles = files.filter((file) => selectedPaths.has(file.path));
  const folderPaths = new Set(selectedFiles.map((file) => getParentDirectoryPath(file.path)));

  return {
    count: selectedFiles.length,
    size: selectedFiles.reduce((total, file) => total + file.size, 0),
    folderCount: folderPaths.size
  };
}

export function normalizePath(filePath: string): NormalizedPath {
  const normalizedPath = filePath.replace(/\\+/g, "/");
  const segments = normalizedPath.split("/").filter(Boolean);

  return {
    originalPath: filePath,
    normalizedPath,
    segments
  };
}

function filterTreeNode(node: FileTreeNode, normalizedQuery: string, directoryIds: string[]): FileTreeNode | undefined {
  if (node.type === "file") {
    return fileNodeMatches(node, normalizedQuery) ? node : undefined;
  }

  const children = node.children
    .map((child) => filterTreeNode(child, normalizedQuery, directoryIds))
    .filter((child): child is FileTreeNode => Boolean(child));

  if (children.length === 0) return undefined;

  const filteredNode: FileTreeDirectoryNode = {
    ...node,
    children,
    fileCount: children.reduce((count, child) => count + (child.type === "file" ? 1 : child.fileCount), 0),
    totalSize: children.reduce((size, child) => size + (child.type === "file" ? child.file.size : child.totalSize), 0)
  };

  directoryIds.push(filteredNode.id);
  return filteredNode;
}

function fileNodeMatches(node: FileTreeFileNode, normalizedQuery: string): boolean {
  return [node.name, node.relativePath, node.path].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
}

function getParentDirectoryPath(filePath: string): string {
  const normalized = normalizePath(filePath);
  return toDisplayPath(normalized.segments.slice(0, -1));
}

function getCommonDirectorySegments(paths: NormalizedPath[]): string[] {
  if (paths.length === 0) return [];

  const directorySegments = paths.map((path) => path.segments.slice(0, -1));
  const first = directorySegments[0];
  const common: string[] = [];

  for (let index = 0; index < first.length; index += 1) {
    const segment = first[index];
    if (directorySegments.every((segments) => segments[index] === segment)) {
      common.push(segment);
    } else {
      break;
    }
  }

  return common;
}

function stripBaseSegments(segments: string[], baseSegments: string[]): string[] {
  return segments.slice(baseSegments.length);
}

function createFileNode(
  file: MediaFile,
  fileName: string,
  directorySegments: string[],
  baseSegments: string[],
  matchedFile?: MediaFile
): FileTreeFileNode {
  const relativePath = toDisplayPath([...directorySegments, fileName]);
  const parentPath = directorySegments.length > 0 ? toDisplayPath(directorySegments) : ".";
  const displayPath = toDisplayPath([...baseSegments, ...directorySegments, fileName]);

  return {
    type: "file",
    id: file.path,
    name: fileName,
    path: file.path,
    relativePath,
    parentPath,
    file,
    matchedFile: matchedFile
      ? {
          ...matchedFile,
          path: matchedFile.path || displayPath
        }
      : undefined
  };
}

function directoryDraftsToNodes(drafts: Map<string, DirectoryDraft>, directoryIds: string[]): FileTreeDirectoryNode[] {
  return [...drafts.values()].sort(compareByName).map((draft) => {
    const childDirectories = directoryDraftsToNodes(draft.children, directoryIds);
    const childFiles = sortFileNodes(draft.files);
    const children = [...childDirectories, ...childFiles];
    const fileCount = children.reduce((count, child) => count + (child.type === "file" ? 1 : child.fileCount), 0);
    const totalSize = children.reduce((size, child) => size + (child.type === "file" ? child.file.size : child.totalSize), 0);

    directoryIds.push(draft.id);

    return {
      type: "directory",
      id: draft.id,
      name: draft.name,
      path: draft.path,
      relativePath: draft.relativePath,
      children,
      fileCount,
      totalSize
    };
  });
}

function sortFileNodes(files: FileTreeFileNode[]): FileTreeFileNode[] {
  return [...files].sort(compareByName);
}

function compareByName(left: { name: string }, right: { name: string }): number {
  return left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function createMatchedFileMap(matchedPairs: MatchedPair[]): Map<string, MediaFile> {
  const map = new Map<string, MediaFile>();

  for (const pair of matchedPairs) {
    if (pair.image && pair.raw) {
      map.set(pair.image.path, pair.raw);
      map.set(pair.raw.path, pair.image);
    }
  }

  return map;
}

function toDisplayPath(segments: string[]): string {
  if (segments.length === 0) return ".";
  return segments.join("/");
}
