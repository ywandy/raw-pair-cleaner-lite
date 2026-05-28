import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const workflowPath = ".github/workflows/release.yml";

describe("release workflow", () => {
  it("builds signed updater artifacts for both macOS architectures", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("platform: macos-arm64");
    expect(workflow).toContain("runner: macos-14");
    expect(workflow).toContain("tauri_target: aarch64-apple-darwin");
    expect(workflow).toContain("name: release-assets-${{ matrix.platform }}");

    expect(workflow).toContain("platform: macos-x64");
    expect(workflow).toContain("runner: macos-13");
    expect(workflow).toContain("tauri_target: x86_64-apple-darwin");
  });

  it("publishes only for version tags and merges both macOS artifacts", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("if: startsWith(github.ref, 'refs/tags/v')");
    expect(workflow).toContain("pattern: release-assets-*");
    expect(workflow).toContain("merge-multiple: true");
    expect(workflow).toContain("pnpm latest:updater -- --artifacts release-artifacts");
  });
});
