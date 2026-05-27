import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

import { APP_VERSION } from "../../shared/constants";
import type { UpdateCheckResult, UpdateProgress } from "../../shared/types";

type UpdateLike = Pick<Update, "currentVersion" | "version" | "date" | "body" | "download" | "install">;

interface UpdateRuntime {
  check: () => Promise<UpdateLike | null>;
  relaunch: () => Promise<void>;
}

export function createUpdateClient(runtime: UpdateRuntime = { check, relaunch }) {
  let pendingUpdate: UpdateLike | undefined;
  const progressListeners = new Set<(progress: UpdateProgress) => void>();

  return {
    async checkForUpdates(): Promise<UpdateCheckResult> {
      const update = await runtime.check();
      pendingUpdate = update ?? undefined;

      if (!update) {
        return {
          available: false,
          currentVersion: APP_VERSION
        };
      }

      return {
        available: true,
        currentVersion: update.currentVersion,
        info: {
          currentVersion: update.currentVersion,
          version: update.version,
          date: update.date,
          body: update.body
        }
      };
    },

    async downloadUpdate(): Promise<void> {
      if (!pendingUpdate) {
        throw new Error("没有可下载的更新，请先检查更新。");
      }

      let downloaded = 0;
      let total: number | undefined;

      await pendingUpdate.download((event: DownloadEvent) => {
        if (event.event === "Started") {
          downloaded = 0;
          total = event.data.contentLength ?? undefined;
          emitProgress(progressListeners, { downloaded, total });
        }
        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          emitProgress(progressListeners, { downloaded, total });
        }
      });
    },

    async installUpdate(): Promise<void> {
      if (!pendingUpdate) {
        throw new Error("没有可安装的更新，请先检查并下载更新。");
      }

      await pendingUpdate.install();
      await runtime.relaunch();
    },

    onUpdateProgress(listener: (progress: UpdateProgress) => void): () => void {
      progressListeners.add(listener);
      return () => progressListeners.delete(listener);
    }
  };
}

function emitProgress(
  listeners: Set<(progress: UpdateProgress) => void>,
  progress: UpdateProgress
): void {
  for (const listener of listeners) {
    listener(progress);
  }
}

export const updateClient = createUpdateClient();
