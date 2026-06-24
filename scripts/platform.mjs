const TARGET_CONFIGS = {
  "aarch64-apple-darwin": {
    tauriTriple: "aarch64-apple-darwin",
    pkgTarget: "node20-macos-arm64",
    executableSuffix: ""
  },
  "x86_64-apple-darwin": {
    tauriTriple: "x86_64-apple-darwin",
    pkgTarget: "node20-macos-x64",
    executableSuffix: ""
  },
  "x86_64-pc-windows-msvc": {
    tauriTriple: "x86_64-pc-windows-msvc",
    pkgTarget: "node20-win-x64",
    executableSuffix: ".exe"
  },
  "x86_64-unknown-linux-gnu": {
    tauriTriple: "x86_64-unknown-linux-gnu",
    pkgTarget: "node20-linux-x64",
    executableSuffix: ""
  }
};

export function getTargetConfig(options = {}) {
  const env = options.env ?? process.env;
  const explicitTriple = env.RAW_PAIR_TAURI_TARGET ?? env.TAURI_TARGET ?? env.CARGO_BUILD_TARGET;

  if (explicitTriple) {
    return getTargetConfigForTriple(explicitTriple);
  }

  return getTargetConfigForHost(options.platform ?? process.platform, options.arch ?? process.arch);
}

export function getTargetConfigForTriple(triple) {
  const config = TARGET_CONFIGS[triple];
  if (!config) {
    throw new Error(`Unsupported Tauri target triple: ${triple}`);
  }

  return { ...config };
}

export function getTargetConfigForHost(platform, arch) {
  if (platform === "darwin" && arch === "arm64") return getTargetConfigForTriple("aarch64-apple-darwin");
  if (platform === "darwin" && arch === "x64") return getTargetConfigForTriple("x86_64-apple-darwin");
  if (platform === "win32" && arch === "x64") return getTargetConfigForTriple("x86_64-pc-windows-msvc");
  if (platform === "linux" && arch === "x64") return getTargetConfigForTriple("x86_64-unknown-linux-gnu");

  throw new Error(`Unsupported target for ${platform}/${arch}`);
}

export function getExecutableSuffixForTarget(triple) {
  return getTargetConfigForTriple(triple).executableSuffix;
}

export function getCurrentPkgTarget() {
  return getTargetConfig().pkgTarget;
}

export function getCurrentTauriTriple() {
  return getTargetConfig().tauriTriple;
}

export function getExecutableSuffix() {
  return getTargetConfig().executableSuffix;
}

export function getPnpmCommand(platform = process.platform) {
  return platform === "win32" ? "pnpm.cmd" : "pnpm";
}
