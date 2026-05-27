import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { APP_NAME, APP_VERSION } from "../../../shared/constants";
import type { DeleteMode } from "../../../shared/types";
import type { TrashResultItem } from "../../../shared/protocol";
import { resolveSidecarDataDir } from "./manifestService";

export async function writeDeleteLog(options: {
  dataDir?: string;
  mode: DeleteMode;
  rootPath: string;
  startedAt: string;
  finishedAt: string;
  total: number;
  success: number;
  failed: number;
  items: TrashResultItem[];
}): Promise<string> {
  const logsDirectory = path.join(resolveSidecarDataDir(options.dataDir), "logs");
  await mkdir(logsDirectory, { recursive: true });

  const logPath = path.join(logsDirectory, `delete-log-${formatLogDate(new Date(options.startedAt))}.json`);
  const payload = {
    app: APP_NAME,
    version: APP_VERSION,
    mode: options.mode,
    rootPath: options.rootPath,
    startedAt: options.startedAt,
    finishedAt: options.finishedAt,
    total: options.total,
    success: options.success,
    failed: options.failed,
    items: options.items
  };

  await writeFile(logPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return logPath;
}

function formatLogDate(date: Date): string {
  const parts = [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  ];

  return parts.map((part, index) => (index === 0 ? `${part}` : `${part}`.padStart(2, "0"))).join("-");
}
