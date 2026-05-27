#!/usr/bin/env node
import { runScanCommand } from "./commands/scan";
import { runSettingsGetCommand } from "./commands/settingsGet";
import { runSettingsSaveCommand } from "./commands/settingsSave";
import { runTrashCommand } from "./commands/trash";
import type { SidecarCommand, SidecarEvent } from "../../shared/protocol";

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function createEvent<T>(command: SidecarCommand, taskId: string, event: SidecarEvent<T>["event"], data?: T): SidecarEvent<T> {
  return {
    protocolVersion: 1,
    command,
    taskId,
    event,
    timestamp: new Date().toISOString(),
    data
  };
}

async function main(argv: string[]): Promise<number> {
  const [command, ...args] = argv;

  if (command === "scan") {
    const requestPath = getRequestPath(args);
    const taskId = await readRequestTaskId(requestPath);
    printJson(createEvent("scan", taskId, "started", { requestPath }));
    printJson(createEvent("scan", taskId, "result", await runScanCommand(requestPath)));
    return 0;
  }

  if (command === "trash") {
    const requestPath = getRequestPath(args);
    const taskId = await readRequestTaskId(requestPath);
    printJson(createEvent("trash", taskId, "started", { requestPath }));
    printJson(createEvent("trash", taskId, "result", await runTrashCommand(requestPath)));
    return 0;
  }

  if (command === "settings-get") {
    const requestPath = getRequestPath(args);
    const taskId = await readRequestTaskId(requestPath);
    printJson(createEvent("settings-get", taskId, "started", { requestPath }));
    printJson(createEvent("settings-get", taskId, "result", await runSettingsGetCommand(requestPath)));
    return 0;
  }

  if (command === "settings-save") {
    const requestPath = getRequestPath(args);
    const taskId = await readRequestTaskId(requestPath);
    printJson(createEvent("settings-save", taskId, "started", { requestPath }));
    printJson(createEvent("settings-save", taskId, "result", await runSettingsSaveCommand(requestPath)));
    return 0;
  }

  process.stderr.write(`Unknown sidecar command: ${command ?? "(missing)"}\n`);
  return 1;
}

function getRequestPath(args: string[]): string {
  const requestFlagIndex = args.indexOf("--request");
  const requestPath = requestFlagIndex >= 0 ? args[requestFlagIndex + 1] : undefined;
  if (!requestPath) {
    throw new Error("Missing --request <path> argument.");
  }
  return requestPath;
}

async function readRequestTaskId(requestPath: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const request = JSON.parse(await readFile(requestPath, "utf8")) as { taskId?: string };
  return request.taskId ?? "scan";
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(error instanceof Error ? `${error.message}\n` : `${String(error)}\n`);
    process.exitCode = 1;
  });
