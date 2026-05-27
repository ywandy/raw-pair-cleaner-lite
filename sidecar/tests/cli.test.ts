import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("sidecar CLI", () => {
  it("rejects the removed hello command", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "src/index.ts", "hello", "Codex"],
      {
        cwd: process.cwd(),
        encoding: "utf8"
      }
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("Unknown sidecar command: hello\n");
  });
});
