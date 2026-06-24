import type { AppSettings } from "./types.js";
import { SIDECAR_EXTENSIONS } from "./fileExtensions.js";

export const APP_NAME = "RAW Pair Cleaner";
export const APP_TITLE = "RAW Pair Cleaner / 底片清理器";
export const APP_VERSION = "0.1.0-beta.3";
export const APP_AUTHOR = {
  name: "ywandy",
  email: "ywandy@users.noreply.github.com",
  url: "https://github.com/ywandy"
} as const;
export const APP_LICENSE = "MIT";
export const APP_REPOSITORY_URL = "https://github.com/ywandy/raw-pair-cleaner-lite";
export const DEFAULT_RELEASE_PROXY_PREFIX = "https://gh-pxy.ywandy.top/";
export const APP_WINDOW_BOUNDS = {
  width: 1200,
  height: 820,
  minWidth: 1200,
  minHeight: 720
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  appearance: {
    fontScale: "medium"
  },
  scan: {
    recursive: true,
    includeHiddenFiles: false,
    ignoreCase: true
  },
  delete: {
    generateLog: true
  },
  sidecar: {
    deleteWithRaw: false,
    extensions: SIDECAR_EXTENSIONS
  },
  updates: {
    autoCheckOnStartup: true,
    releaseProxyPrefix: DEFAULT_RELEASE_PROXY_PREFIX
  }
};
