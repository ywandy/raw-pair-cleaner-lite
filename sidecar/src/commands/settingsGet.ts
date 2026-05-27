import { readFile } from "node:fs/promises";

import type { SettingsGetRequest } from "../../../shared/protocol";
import type { AppSettings } from "../../../shared/types";
import { getSettings } from "../services/settingsService";

export async function runSettingsGetCommand(requestPath: string): Promise<AppSettings> {
  const request = JSON.parse(await readFile(requestPath, "utf8")) as SettingsGetRequest;
  validateSettingsGetRequest(request);

  return getSettings(request.dataDir);
}

function validateSettingsGetRequest(request: SettingsGetRequest): void {
  if (request.protocolVersion !== 1) {
    throw new Error("Unsupported settings-get request protocol version.");
  }
  if (!request.taskId) {
    throw new Error("Settings-get request taskId is required.");
  }
}
