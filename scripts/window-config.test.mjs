import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Tauri main window sizing", () => {
  it("starts at the 1200x720 UI baseline and does not resize below it", async () => {
    const configPath = path.join(import.meta.dirname, "..", "src-tauri", "tauri.conf.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    const [mainWindow] = config.app.windows;

    expect(mainWindow).toMatchObject({
      width: 1200,
      height: 720,
      minWidth: 1200,
      minHeight: 720
    });
  });
});
