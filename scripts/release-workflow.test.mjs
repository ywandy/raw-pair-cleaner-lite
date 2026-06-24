import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const workflowPath = ".github/workflows/release.yml";

describe("release workflow", () => {
  it("builds signed updater artifacts for macOS and Windows x64", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("platform: macos-arm64");
    expect(workflow).toContain("runner: macos-14");
    expect(workflow).toContain("tauri_target: aarch64-apple-darwin");
    expect(workflow).toContain("name: release-assets-${{ matrix.platform }}");

    expect(workflow).toContain("platform: macos-x64");
    expect(workflow).toContain("runner: macos-15-intel");
    expect(workflow).toContain("tauri_target: x86_64-apple-darwin");

    expect(workflow).toContain("platform: windows-x64");
    expect(workflow).toContain("runner: windows-latest");
    expect(workflow).toContain("tauri_target: x86_64-pc-windows-msvc");
    expect(workflow).toContain("bundles: nsis");
  });

  it("publishes only for version tags and requires all updater platforms", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("if: startsWith(github.ref, 'refs/tags/v')");
    expect(workflow).toContain("pattern: release-assets-*");
    expect(workflow).toContain("merge-multiple: true");
    expect(workflow).toContain("RAW_PAIR_UPDATE_BASE_URL: https://github.com/${{ github.repository }}/releases/download/${{ github.ref_name }}");
    expect(workflow).not.toContain("RAW_PAIR_UPDATE_BASE_URL: https://gh-pxy.ywandy.top/");
    expect(workflow).toContain("pnpm latest:updater -- --artifacts release-artifacts");
    expect(workflow).toContain("--required-platforms darwin-aarch64,darwin-x86_64,windows-x86_64");
  });
});
