# RAW Pair Cleaner Lite

![RAW Pair Cleaner Lite README hero: a calm desktop photo utility banner showing paired image files, camera storage, and safe cleanup](docs/assets/readme-hero.png)

RAW Pair Cleaner / 底片清理器是一个桌面工具，用来识别照片目录中 JPG 类图片与 RAW 文件的匹配关系，并在人工确认后安全清理冗余文件。它面向摄影工作流里的常见场景：保留成片或保留原始底片，同时把已经确认不需要的配对文件移入系统回收站。

当前项目处于 beta / 内部分发阶段。请在真实照片目录上操作前先备份，并仔细确认扫描结果。

## 功能特性

- 选择或拖入照片目录，扫描 JPG 类图片、RAW 文件和可配置的附属文件。
- 支持混合目录与 JPG/RAW 分离目录，按文件名 key 匹配对应关系。
- 提供两种清理模式：以 JPG 为准删除 RAW，或以 RAW 为准删除 JPG。
- 检测同名冲突并跳过冲突组，避免把不确定的文件加入删除候选。
- 删除前显示候选列表、预计释放空间和确认弹窗。
- 当前桌面版本优先移动到系统回收站，并在执行前重新校验扫描 manifest。
- 可生成删除日志，便于回看本次操作结果。
- 内置设置持久化与 Tauri updater 接入。

## 安全模型

RAW Pair Cleaner 的核心原则是：扫描只生成候选，删除必须人工确认。

- 删除请求只接受上一轮扫描 manifest 中的候选文件。
- 执行前会校验根目录、文件大小、修改时间和文件类型，防止扫描后文件变化导致误删。
- 冲突文件不会自动进入候选列表。
- 当前 Tauri 路径只支持移动到系统回收站，不把永久删除作为默认能力。
- 生产级公开分发仍需完成 Apple Developer ID 签名、公证、跨架构实机验证和 updater 安全验证。

## 支持的文件

- JPG 类图片：`.jpg`, `.jpeg`, `.png`, `.heic`, `.tif`, `.webp`, `.avif`, `.bmp` 等。
- RAW 文件：`.cr2`, `.cr3`, `.nef`, `.arw`, `.raf`, `.rw2`, `.dng`, `.orf`, `.pef`, `.r3d` 等。
- 附属文件：默认包含 `.xmp`, `.dop`, `.cos`, `.on1`, `.pp3`，可在设置中调整。

## 开发

```bash
pnpm install
pnpm dev
```

常用检查：

```bash
pnpm test
pnpm typecheck
pnpm build:web
```

浏览器调试 UI 时可以使用：

```bash
pnpm dev:web
```

## 构建与发布

Sidecar 构建：

```bash
pnpm --filter ./sidecar test
pnpm build:sidecar
pnpm stage:sidecar
```

桌面应用构建：

```bash
pnpm build
```

`pnpm build` 当前生成 macOS `.app` bundle。签名 updater 构建需要 `TAURI_SIGNING_PRIVATE_KEY`：

```bash
pnpm build:updater
pnpm collect:release
RAW_PAIR_UPDATE_BASE_URL="https://example.com/releases/vX.Y.Z" pnpm latest:updater
pnpm release:check
```

发布前请参考：

- [Updater release notes](docs/UPDATER_RELEASE.md)
- [Internal release checklist](docs/INTERNAL_RELEASE_CHECKLIST.md)
- [Production distribution gate](docs/PRODUCTION_DISTRIBUTION.md)

## 技术栈

- Tauri v2
- React 19
- TypeScript
- Tailwind CSS
- Node.js sidecar packaged with `@yao-pkg/pkg`
- Vitest

## License

MIT

---

## English

RAW Pair Cleaner / 底片清理器 is a desktop utility for finding relationships between JPG-like image files and RAW files, then safely cleaning up redundant paired files after manual review. It is designed for photography workflows where you want to keep either edited/exported images or original RAW files and move the matched extras to the system Trash.

The project is currently in beta / internal distribution status. Back up real photo libraries before using it and review every scan result carefully.

## Features

- Select or drag in a photo directory and scan JPG-like images, RAW files, and configurable sidecar files.
- Supports mixed folders and separated JPG/RAW folder layouts, matching files by filename key.
- Two cleanup modes: keep JPG and remove matching RAW files, or keep RAW and remove matching JPG files.
- Detects duplicate-key conflicts and skips uncertain groups.
- Shows delete candidates, estimated recoverable space, and a confirmation dialog before any operation.
- The current desktop path moves selected files to the system Trash and revalidates the scan manifest before execution.
- Optional delete logs for reviewing what happened.
- Persistent settings and Tauri updater integration.

## Safety Model

RAW Pair Cleaner follows a simple rule: scanning only creates candidates; deletion requires explicit user confirmation.

- Delete requests are limited to candidates from the latest scan manifest.
- Before moving files, the app checks root path, file size, modified time, and file type.
- Conflicting files are never added to the delete list automatically.
- The current Tauri path supports moving files to the system Trash and does not expose permanent deletion as the default capability.
- Public production distribution still requires Apple Developer ID signing, notarization, real-device architecture checks, and updater security validation.

## Supported Files

- JPG-like images: `.jpg`, `.jpeg`, `.png`, `.heic`, `.tif`, `.webp`, `.avif`, `.bmp`, and more.
- RAW files: `.cr2`, `.cr3`, `.nef`, `.arw`, `.raf`, `.rw2`, `.dng`, `.orf`, `.pef`, `.r3d`, and more.
- Sidecar files: `.xmp`, `.dop`, `.cos`, `.on1`, `.pp3` by default, configurable in settings.

## Development

```bash
pnpm install
pnpm dev
```

Common checks:

```bash
pnpm test
pnpm typecheck
pnpm build:web
```

For browser-only UI development:

```bash
pnpm dev:web
```

## Build And Release

Build the sidecar:

```bash
pnpm --filter ./sidecar test
pnpm build:sidecar
pnpm stage:sidecar
```

Build the desktop app:

```bash
pnpm build
```

`pnpm build` currently produces the macOS `.app` bundle. Signed updater builds require `TAURI_SIGNING_PRIVATE_KEY`:

```bash
pnpm build:updater
pnpm collect:release
RAW_PAIR_UPDATE_BASE_URL="https://example.com/releases/vX.Y.Z" pnpm latest:updater
pnpm release:check
```

Release references:

- [Updater release notes](docs/UPDATER_RELEASE.md)
- [Internal release checklist](docs/INTERNAL_RELEASE_CHECKLIST.md)
- [Production distribution gate](docs/PRODUCTION_DISTRIBUTION.md)

## Tech Stack

- Tauri v2
- React 19
- TypeScript
- Tailwind CSS
- Node.js sidecar packaged with `@yao-pkg/pkg`
- Vitest

## License

MIT
