import { readFile } from "node:fs/promises";

import type { SettingsSaveRequest } from "../../../shared/protocol";
import type { AppSettings } from "../../../shared/types";
import { saveSettings } from "../services/settingsService";

export async function runSettingsSaveCommand(requestPath: string): Promise<AppSettings> {
  const request = JSON.parse(await readFile(requestPath, "utf8")) as SettingsSaveRequest;
  validateSettingsSaveRequest(request);

  return saveSettings(request.settings, request.dataDir);
}

function validateSettingsSaveRequest(request: SettingsSaveRequest): void {
  if (request.protocolVersion !== 1) {
    throw new Error("Unsupported settings-save request protocol version.");
  }
  if (!request.taskId) {
    throw new Error("Settings-save request taskId is required.");
  }
  if (!request.settings || typeof request.settings !== "object") {
    throw new Error("Settings-save request settings are required.");
  }
}
