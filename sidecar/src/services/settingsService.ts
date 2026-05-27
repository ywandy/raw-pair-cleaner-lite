import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_RELEASE_PROXY_PREFIX,
  DEFAULT_SETTINGS
} from "../../../shared/constants";
import type { AppSettings } from "../../../shared/types";
import { resolveSidecarDataDir } from "./manifestService";

export async function getSettings(dataDir?: string): Promise<AppSettings> {
  try {
    const content = await readFile(getSettingsPath(dataDir), "utf8");
    const parsed = JSON.parse(content) as Partial<AppSettings>;
    return mergeSettings(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return DEFAULT_SETTINGS;
    }
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Partial<AppSettings>, dataDir?: string): Promise<AppSettings> {
  const merged = mergeSettings(settings);
  const settingsPath = getSettingsPath(dataDir);

  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  return merged;
}

function getSettingsPath(dataDir?: string): string {
  return path.join(resolveSidecarDataDir(dataDir), "settings.json");
}

function mergeSettings(settings: Partial<AppSettings>): AppSettings {
  return {
    appearance: {
      ...DEFAULT_SETTINGS.appearance,
      ...settings.appearance
    },
    scan: {
      ...DEFAULT_SETTINGS.scan,
      ...settings.scan
    },
    delete: {
      generateLog: settings.delete?.generateLog ?? DEFAULT_SETTINGS.delete.generateLog
    },
    sidecar: {
      ...DEFAULT_SETTINGS.sidecar,
      ...settings.sidecar
    },
    updates: {
      ...DEFAULT_SETTINGS.updates,
      ...settings.updates,
      releaseProxyPrefix: settings.updates?.releaseProxyPrefix?.trim() || DEFAULT_RELEASE_PROXY_PREFIX
    }
  };
}
