# macOS Release Update Loop Design

## 背景

RAW Pair Cleaner Lite 已经接入 Tauri v2 updater，并具备生成签名 updater artifact、收集 release 产物、生成 `latest.json` 和执行 release gate 的基础脚本。当前缺口是把 GitHub Actions、GitHub Release 和客户端更新检查串成稳定闭环：

- 推送到 GitHub 后能自动触发 macOS 构建，先只覆盖 Apple Silicon。
- 只有 `v*` tag 才创建正式 GitHub Release。
- 客户端通过 GitHub Release 中的 `latest.json` 获取可更新版本。

## 目标

本次设计的目标是先跑通 macOS arm64 内测发布闭环：

- `main` 分支 push 自动构建签名 macOS arm64 updater artifact。
- `workflow_dispatch` 支持手动构建同样的签名 macOS arm64 artifact。
- `v*` tag push 构建同样的 artifact，并发布到正式 GitHub Release。
- `latest.json` 只在 tag release 阶段生成并上传，因此普通 push 不影响客户端更新检测。
- tag 去掉 `v` 后的版本必须与项目版本源一致。

暂不恢复 macOS x64、Windows 或 Linux 发布矩阵；这些平台在 Apple Silicon 闭环稳定后再扩展。

## 非目标

- 不改变 Tauri updater endpoint，继续使用 `https://github.com/ywandy/raw-pair-cleaner-lite/releases/latest/download/latest.json`。
- 不引入新的发布服务、CDN 或 COS 上传流程。
- 不处理 Apple Developer ID 签名、公证和生产分发问题。
- 不改变应用内更新 UI 或 updater 客户端交互。

## 推荐方案

采用单一 `.github/workflows/release.yml` 承载构建和发布，并用 job 条件区分普通构建与 tag 发布。

触发条件：

- `push` 到 `main`：运行 macOS arm64 签名构建，上传 GitHub Actions artifact。
- `workflow_dispatch`：手动运行 macOS arm64 签名构建，上传 GitHub Actions artifact。
- `push` `v*` tag：运行 macOS arm64 签名构建，再创建正式 GitHub Release。

这个方案让 main、手动触发和 tag release 共享同一套打包步骤，减少构建逻辑漂移。tag release 只是多走发布 job，不重新定义另一套构建流程。

## Workflow 结构

`release.yml` 保留两个 job：

- `build-macos-arm64`
  - runner: `macos-14`
  - Tauri target: `aarch64-apple-darwin`
  - bundles: `app,dmg`
  - 执行依赖安装、测试、release gate、sidecar 构建与 staging、Tauri updater bundle 构建、release artifact 收集。
  - 使用 `TAURI_SIGNING_PRIVATE_KEY` 和 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`，main push 也要求签名 secrets 可用。
  - 上传 `dist-release/*` 到 Actions artifact，例如 `release-assets-macos-arm64`。

- `publish-release`
  - 依赖 `build-macos-arm64`。
  - 仅在 `refs/tags/v*` 上运行。
  - 下载 `release-assets-macos-arm64`。
  - 用 `RAW_PAIR_UPDATE_BASE_URL=https://github.com/<repo>/releases/download/<tag>` 生成 `release-artifacts/latest.json`。
  - 校验 `latest.json`。
  - 创建正式 GitHub Release 并上传所有 release assets。

普通 `main` push 和手动构建不会创建 Release，也不会上传对客户端可见的 `latest.json`。

## 数据流

普通构建数据流：

1. 开发者 push 到 `main`，或手动触发 workflow。
2. GitHub Actions 在 macOS arm64 runner 上构建 signed updater bundle。
3. `collect-release-artifacts` 将 updater archive、`.sig` 和 `.dmg` 收集到 `dist-release`。
4. Actions 上传构建结果为 workflow artifact。
5. 流程结束，不影响 GitHub Release 的 `latest.json`。

tag 发布数据流：

1. 开发者 push `v0.1.0-beta.N` 形式的 tag。
2. 构建 job 产出同样的 `dist-release` artifact。
3. 发布 job 下载 artifact 到 `release-artifacts`。
4. `create-latest-json` 使用 tag 去掉 `v` 后的版本生成 `latest.json`。
5. release gate 校验版本、HTTPS URL 和 raw `.sig` 签名文本。
6. `gh release create` 创建正式 GitHub Release。
7. `gh release upload --clobber` 上传 updater archive、`.sig`、`.dmg` 和 `latest.json`。
8. 客户端通过 GitHub `releases/latest/download/latest.json` 看到新版本。

## 版本与 Tag 校验

发布阶段必须显式校验 tag 与项目版本一致：

- `GITHUB_REF_NAME` 必须匹配 `v*`。
- 去掉开头 `v` 后得到 expected version。
- expected version 必须等于：
  - `package.json`
  - `sidecar/package.json`
  - `shared/constants.ts`
  - `src-tauri/tauri.conf.json`
  - `src-tauri/Cargo.toml`
- `latest.json.version` 必须等于 expected version。

建议在 `scripts/release-gate.mjs` 增加 `--expected-version <version>` 参数，让 CI 失败信息直接指出 tag 与项目版本不一致，而不是等到后续步骤间接失败。

## 错误处理

- 缺少 `TAURI_SIGNING_PRIVATE_KEY` 或 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：构建失败，提示 GitHub Actions secrets 配置缺失。
- tag 与项目版本不一致：发布 job 在生成或校验 `latest.json` 前失败，不创建 Release。
- updater artifact 或 `.sig` 缺失：`latest:updater` 或 release gate 失败，不发布不完整更新。
- `latest.json` 使用非 HTTPS URL：release gate 失败。
- `latest.json` 的 `signature` 是 URL 而不是 raw `.sig` 文本：release gate 失败。
- 重跑同一个 tag workflow：`gh release upload --clobber` 允许覆盖 release assets。

## 测试策略

本地验证：

- `pnpm test`：覆盖 updater utility 和 release gate 脚本测试。
- `pnpm release:check`：验证版本源同步和 release 基础门禁。
- 新增 release gate 测试，覆盖 `--expected-version` 与版本源不一致时的失败信息。

CI 验证：

- `main` push 应产出 macOS arm64 Actions artifact。
- `workflow_dispatch` 应产出同样的 artifact。
- `v*` tag 应创建正式 GitHub Release，并包含 `latest.json`、updater archive、`.sig` 和 `.dmg`。

人工验证：

- 安装上一个已发布版本。
- 发布下一个 tag 版本。
- 在应用内检查更新，应发现 release 的 `latest.json` 中声明的新版本。
- 下载、安装、重启后确认 sidecar 功能仍可用。

## 后续扩展

Apple Silicon 闭环稳定后，可以按同一结构逐步扩展：

- 增加 macOS x64 构建矩阵。
- 增加 Windows x64 构建矩阵。
- 根据生产分发要求引入 Apple Developer ID 签名、公证和 CDN 发布。
