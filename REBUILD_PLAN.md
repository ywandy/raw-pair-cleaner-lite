# RAW Pair Cleaner Lite
# Tauri v2 + Node.js Sidecar 新仓重建实施文档

> **用途**：本文件用于指导 Codex / Claude Code 在一个全新仓库中重建 RAW Pair Cleaner 轻量版桌面应用。  
> **目标**：在保留 TypeScript / Node.js 可维护性的前提下，替换 Electron 桌面壳，显著降低安装包体积，并建立规范的签名自动更新链路。  
> **当前稳定版参考仓库**：`https://github.com/ywandy/jpgDelRaw-Desktop`  
> **新版本形态**：全新仓库、全新发布，不要求覆盖升级 Electron 旧版本。

---

## 0. 给 Codex 的执行总指令

请先完整阅读本文档，再开始生成或修改代码。

### 强约束

1. 这是一个**新仓库项目**，不要在 Electron 旧仓库内原地迁移。
2. 技术路线固定为：
   - React
   - TypeScript
   - Vite
   - TailwindCSS
   - Tauri v2
   - Node.js Sidecar
   - pnpm workspace
3. 产品核心业务逻辑优先使用 TypeScript / Node.js 维护，不将扫描、匹配、候选生成等业务规则重写到 Rust。
4. Rust 侧仅承担 Tauri 初始化、插件注册和必要的极薄桥接能力。
5. 不要引入 Electron。
6. 不要启动长期驻留的 localhost Node 服务；Sidecar 必须采用**短进程命令模式**，通过参数与 stdout JSON / JSON Lines 通信。
7. 删除安全规则不可降低：
   - 禁止硬删除用户文件。
   - 用户照片文件只允许移动到系统回收站 / 废纸篓。
   - 冲突文件绝不自动删除。
   - 附属文件默认不删除。
   - 删除前必须展示候选列表并二次确认。
   - 删除操作必须可追溯，生成 JSON 日志。
8. 自动更新必须使用 Tauri 官方 Updater；不要复用 Electron 旧版的 `app.asar` 替换更新机制。
9. 更新签名与 macOS Apple 签名属于两套机制，分别实现、分别验收。
10. 首先完成 PoC 与体积对比，再决定是否推进完整发布版本。

---

## 1. 背景与重建目标

### 1.1 现有产品情况

Electron 旧版已经具备稳定产品能力：

- 两种清理模式：
  - 以 JPG 类图片为准，删除没有对应 JPG 的 RAW。
  - 以 RAW 为准，删除没有对应 RAW 的 JPG 类图片。
- JPG / RAW 扩展名识别。
- 同名 key 匹配与冲突保护。
- 待删除树状列表与人工复核。
- 删除前二次确认。
- 文件移入系统回收站 / 废纸篓。
- 删除日志。
- React + TypeScript + TailwindCSS 的桌面 UI。

旧版产品安全模型必须继续保留，不允许因技术栈变化而缩水。

### 1.2 本次重建的核心问题

Electron 对一个“小而美”的本地摄影工具而言，安装包体积偏重。当前产品已稳定，因此本次重建不以新增功能为目标，而以以下指标为目标：

```txt
P0：安装包体积显著下降
P0：核心扫描 / 匹配 / 删除行为与旧版一致
P0：逻辑仍以 TypeScript / Node.js 为主要维护语言
P0：建立可验证的签名自动更新能力
P1：提供 macOS DMG 内测分发路径
P1：形成公开发布前的 Apple 签名 / 公证门槛
```

### 1.3 重建方式

本项目为全新仓库、全新发布，不实现：

- Electron 旧版应用内升级到 Tauri。
- Electron 更新配置兼容。
- Electron 与 Tauri 安装路径覆盖。
- 旧版 `app.asar` 更新逻辑迁移。

旧版可以继续留作稳定版本，新版作为轻量版独立发布。

---

## 2. 技术决策

### 2.1 最终候选架构

```txt
┌──────────────────────────────────────────────────────┐
│ React + TypeScript + TailwindCSS                      │
│ 页面 / 文件树 / 勾选交互 / 删除确认 / 设置 / 更新 UI   │
└────────────────────────┬─────────────────────────────┘
                         │
              Tauri Plugin APIs / Sidecar Client
                         │
┌────────────────────────▼─────────────────────────────┐
│ Tauri v2 Application Shell                            │
│ 窗口 / dialog / shell sidecar / updater / process      │
└────────────────────────┬─────────────────────────────┘
                         │ Command.sidecar + JSON
┌────────────────────────▼─────────────────────────────┐
│ Node.js Sidecar Binary                                │
│ scan / compare / trash / log / settings               │
└──────────────────────────────────────────────────────┘
```

### Tauri 负责

```txt
- 桌面应用壳
- 系统 WebView 窗口
- 系统目录选择
- 文件夹拖入事件接入
- 启动 Sidecar
- Tauri 官方 Updater
- 更新签名验证
- 安装包构建
```

### Node.js Sidecar 负责

```txt
- 扫描目录
- 分类文件类型
- 判断目录结构
- 计算 JPG / RAW 匹配关系
- 检测冲突
- 生成待删除候选
- 移动用户确认后的文件到回收站
- 写入 JSON 删除日志
- 存储应用设置
```

### React 前端负责

```txt
- 页面 UI
- 删除模式选择
- 扫描结果展示
- 树状文件列表展示
- 勾选状态与预计释放空间实时计算
- 二次确认弹窗
- 更新检查 / 下载进度 UI
- 调用 Sidecar Client
```

### Rust 代码范围

Rust 代码要保持极薄，只做：

```txt
- Tauri app 初始化
- 插件注册
- 必要的 capability / permission 配置
- 不承载业务规则
```

不要在 Rust 中重复实现：

```txt
- 文件匹配算法
- 删除候选计算
- 文件树生成
- 扩展名业务配置
- 设置业务逻辑
```

### 2.2 为什么采用 Node.js Sidecar

| 目标 | Tauri + Node.js Sidecar 的对应价值 |
|---|---|
| 减少 Electron 体积负担 | 使用系统 WebView，不随包内置完整 Chromium 桌面壳 |
| 保留维护效率 | 稳定业务逻辑继续使用 TS / Node.js |
| 降低行为重写风险 | 可迁移旧版扫描、匹配、安全检查规则 |
| 更新链路正规化 | 使用 Tauri 官方签名 Updater |
| 不追求技术纯度 | 包体达到产品可接受线即可，不为极限压缩强写 Rust |

注意：Node Sidecar 自身仍会携带自包含 Node 运行能力，因此不会达到“纯 Tauri + Rust”的最小包体。是否满足轻量目标必须通过真实构建产物衡量。

### 2.3 技术验证门槛

不得在未验证体积前直接投入完整重建。

#### Gate 1：Sidecar 方案是否成立

PoC 完成后测量：

| 指标 | Electron 稳定版 | Tauri + Node Sidecar PoC |
|---|---:|---:|
| macOS arm64 DMG / ZIP 大小 | 实测 | 实测 |
| Windows x64 安装包大小 | 实测 | 实测 |
| Linux AppImage 大小 | 实测 | 实测 |
| 首次冷启动耗时 | 实测 | 实测 |
| 扫描 10,000 文件耗时 | 实测 | 实测 |
| 回收站删除可用性 | 基线 | 实测 |
| 更新包大小 | 基线 | 实测 |

继续推进的判断标准：

```txt
- 包体相比 Electron 至少下降 50%，或已经达到产品接受的绝对体积；
- 真实照片目录扫描结果与 Electron 基线一致；
- 系统回收站删除通过目标平台验证；
- Sidecar 构建与 Tauri 打包链路可稳定复现。
```

如果不满足，应停止完整迁移，重新评估：

```txt
- 是否只在某个平台发布轻量版；
- 是否把回收站能力单独下沉为最小 Rust command；
- 是否继续使用 Electron 稳定版。
```

---

## 3. 产品不可变安全规则

以下规则属于产品底线，代码、测试、UI、发布验收均必须体现。

### 3.1 删除规则

```txt
1. 禁止永久删除用户照片。
2. 禁止使用 rm / unlink / remove 等方式删除待清理文件。
3. 所有已确认文件必须进入系统回收站 / 废纸篓。
4. 删除失败必须返回清晰的失败结果，不允许伪装为成功。
5. 删除完成后必须生成操作日志。
```

### 3.2 候选生成规则

```txt
1. 未被用户确认的文件不能进入删除调用。
2. 冲突文件不能进入自动删除候选。
3. sidecar 文件（.xmp / .dop / .cos / .on1 / .pp3）默认只识别，不删除。
4. 删除任务执行前必须再次校验路径与候选集合。
```

### 3.3 UI 规则

```txt
1. 删除前必须展示文件树。
2. 用户可取消勾选任意候选文件。
3. 删除前必须二次确认。
4. 二次确认文案必须明确：文件将移动到系统回收站。
5. 已选数量与预计释放空间必须随勾选实时更新。
```

---

## 4. 新仓库与发布身份

### 4.1 仓库名称

建议：

```txt
raw-pair-cleaner-lite
```

备选：

```txt
jpgDelRaw-Tauri
```

### 4.2 应用展示名称

```txt
RAW Pair Cleaner / 底片清理器
```

### 4.3 Bundle Identifier

由于新版本需要与 Electron 旧版独立存在，建议使用新的 identifier：

```txt
com.ywandy.rawpaircleaner.lite
```

原则：

```txt
- Electron 旧版和 Tauri 新版可同时安装。
- 不复用旧版自动更新身份。
- 新版设置与日志从零初始化。
```

### 4.4 版本策略

```txt
新仓首个内测版本：0.1.0-beta.1
新仓首个公开版本：1.0.0
```

不要用 Electron 的版本号暗示可原地升级。

---

## 5. 目标项目目录结构

使用 pnpm workspace 管理前端与 sidecar。

```txt
raw-pair-cleaner-lite/
├── README.md
├── REBUILD_PLAN.md                       # 本文档
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json
├── vite.config.ts
├── index.html
├── tailwind.config.ts
├── postcss.config.js
│
├── src/                                  # React 前端应用
│   ├── main.tsx
│   ├── App.tsx
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── ScanResultPage.tsx
│   │   ├── PendingDeletePage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── AboutPage.tsx
│   ├── components/
│   │   ├── AppLayout.tsx
│   │   ├── AppTitleBar.tsx
│   │   ├── AppSidebar.tsx
│   │   ├── DropZone.tsx
│   │   ├── ModeSelector.tsx
│   │   ├── StatCard.tsx
│   │   ├── FileTree.tsx
│   │   ├── FileTreeNode.tsx
│   │   ├── WarningPanel.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── UpdateDialog.tsx
│   ├── lib/
│   │   ├── desktopApi.ts
│   │   ├── sidecarClient.ts
│   │   ├── updateClient.ts
│   │   ├── format.ts
│   │   └── platform.ts
│   ├── hooks/
│   │   ├── useScanTask.ts
│   │   ├── useDeleteTask.ts
│   │   └── useUpdater.ts
│   └── styles/
│       └── globals.css
│
├── shared/                               # 前端与 Node Sidecar 共享 TS 定义
│   ├── types.ts
│   ├── protocol.ts
│   ├── fileExtensions.ts
│   ├── constants.ts
│   └── errors.ts
│
├── sidecar/                              # Node.js CLI 业务进程
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── cli.ts
│   │   ├── commands/
│   │   │   ├── scan.ts
│   │   │   ├── trash.ts
│   │   │   ├── settingsGet.ts
│   │   │   └── settingsSave.ts
│   │   ├── services/
│   │   │   ├── scanService.ts
│   │   │   ├── compareService.ts
│   │   │   ├── directoryModeService.ts
│   │   │   ├── trashService.ts
│   │   │   ├── taskManifestService.ts
│   │   │   ├── logService.ts
│   │   │   └── settingsService.ts
│   │   └── utils/
│   │       ├── jsonl.ts
│   │       ├── fileUtils.ts
│   │       ├── paths.ts
│   │       └── validate.ts
│   ├── tests/
│   │   ├── scan.test.ts
│   │   ├── compare.test.ts
│   │   ├── trashValidation.test.ts
│   │   └── fixtures/
│   └── dist/
│
├── src-tauri/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   ├── binaries/                         # 构建脚本生成；不要手改
│   │   └── .gitkeep
│   ├── icons/
│   └── src/
│       ├── lib.rs
│       └── main.rs
│
├── scripts/
│   ├── build-sidecar.mjs
│   ├── stage-sidecar.mjs
│   ├── build-local-release.mjs
│   ├── generate-latest-json.mjs
│   └── compare-artifact-size.mjs
│
├── tests/
│   ├── fixtures/
│   │   ├── small/
│   │   ├── conflicts/
│   │   └── unicode-paths/
│   └── acceptance/
│
└── .github/
    └── workflows/
        ├── verify.yml
        └── release.yml
```

---

## 6. pnpm Workspace 与基础脚本

### 6.1 `pnpm-workspace.yaml`

```yaml
packages:
  - "."
  - "sidecar"
```

### 6.2 根 `package.json` 目标脚本

具体依赖版本使用创建项目时的最新稳定兼容版本，并提交 lockfile。

```json
{
  "name": "raw-pair-cleaner-lite",
  "private": true,
  "scripts": {
    "dev": "pnpm tauri dev",
    "dev:web": "vite",
    "build:web": "tsc -b && vite build",
    "build:sidecar": "node scripts/build-sidecar.mjs",
    "stage:sidecar": "node scripts/stage-sidecar.mjs",
    "build": "pnpm build:sidecar && pnpm stage:sidecar && pnpm tauri build",
    "test": "pnpm --filter ./sidecar test",
    "typecheck": "tsc -b --noEmit",
    "tauri": "tauri"
  }
}
```

说明：

- 开发环境初期允许使用一个本机构建后的 sidecar binary。
- 发布构建必须先编译 sidecar，再运行 Tauri bundle。
- `pnpm-lock.yaml` 必须提交仓库。

---

## 7. Tauri 应用初始化

### 7.1 初始化方式

新仓库创建时使用 Tauri v2 React TypeScript 模板，或在当前空目录初始化：

```bash
pnpm create tauri-app
```

选择：

```txt
TypeScript / JavaScript
pnpm
React
TypeScript
```

然后接入 TailwindCSS，并迁入现有 UI。

### 7.2 必须安装的 Tauri 插件

```bash
pnpm tauri add dialog
pnpm tauri add shell
pnpm tauri add updater
pnpm tauri add process
```

用途：

| 插件 | 用途 |
|---|---|
| `dialog` | 用户手动选择照片目录 |
| `shell` | 启动 Node.js sidecar binary |
| `updater` | 检查、下载、安装签名更新包 |
| `process` | 更新安装完成后重启应用 |

### 7.3 `src-tauri/src/lib.rs`

只注册插件，不写业务规则。示意：

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running RAW Pair Cleaner Lite");
}
```

Codex 应按当前实际 Tauri v2 依赖生成可编译的代码；如插件初始化 API 有差异，以当前插件生成模板与官方文档为准。

---

## 8. Sidecar 方案

### 8.1 Sidecar 实现原则

Node Sidecar 是一个短生命周期 CLI 二进制：

```txt
启动一次 -> 执行一个任务 -> 输出结构化结果 -> 退出
```

禁止实现为：

```txt
- 常驻 Node HTTP 服务
- 监听 localhost 端口
- 依赖用户本机安装 Node.js
```

### 8.2 Sidecar 二进制打包

使用 Tauri 官方 Node Sidecar 指南采用的工具：

```bash
pnpm --dir sidecar add -D @yao-pkg/pkg
```

流程：

```txt
sidecar TypeScript 代码
  ↓
构建为 Node 可执行入口
  ↓
@yao-pkg/pkg 打包为自包含 binary
  ↓
按 Tauri target triple 重命名
  ↓
复制到 src-tauri/binaries/
  ↓
Tauri bundle 将 sidecar 一并打入安装包
```

### 8.3 目标 binary 名称

基础名称：

```txt
raw-pair-sidecar
```

Tauri 实际需要按 target triple staging，例如：

```txt
src-tauri/binaries/raw-pair-sidecar-aarch64-apple-darwin
src-tauri/binaries/raw-pair-sidecar-x86_64-apple-darwin
src-tauri/binaries/raw-pair-sidecar-x86_64-pc-windows-msvc.exe
src-tauri/binaries/raw-pair-sidecar-x86_64-unknown-linux-gnu
```

### 8.4 `tauri.conf.json` 外部二进制配置

```json
{
  "bundle": {
    "externalBin": [
      "binaries/raw-pair-sidecar"
    ]
  }
}
```

Tauri 构建时会基于当前 target triple 寻找对应的 staged binary。

### 8.5 Capability 配置

允许前端通过 shell plugin 执行指定 sidecar，不能开放任意外部命令。

`src-tauri/capabilities/default.json` 关键结构示意：

```json
{
  "identifier": "default",
  "description": "Default capabilities for RAW Pair Cleaner Lite",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "process:default",
    "updater:default",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "binaries/raw-pair-sidecar",
          "sidecar": true,
          "args": true
        }
      ]
    }
  ]
}
```

约束：

```txt
- 只允许执行 raw-pair-sidecar。
- 不允许执行任意 shell command。
- 如果插件实际生成的权限名与示例不同，使用 Tauri v2 当前插件生成的合法 permission 配置。
```

---

## 9. Sidecar 通信协议

### 9.1 协议原则

```txt
- 输入：命令参数 + JSON request 文件。
- 输出：stdout 中的 JSON Lines。
- stderr：仅输出调试错误文本。
- exit code 0：任务正常完成；任务中可包含部分业务失败。
- exit code 非 0：进程执行失败或请求协议失败。
```

不用把完整 JSON 直接塞入命令参数，以避免路径、长度和特殊字符问题。

### 9.2 Sidecar 命令

```bash
raw-pair-sidecar scan --request "/tmp/raw-pair/scan-request.json"
raw-pair-sidecar trash --request "/tmp/raw-pair/trash-request.json"
raw-pair-sidecar settings-get --request "/tmp/raw-pair/settings-get.json"
raw-pair-sidecar settings-save --request "/tmp/raw-pair/settings-save.json"
```

### 9.3 公共 envelope 类型

`shared/protocol.ts`：

```ts
export type SidecarCommand =
  | "scan"
  | "trash"
  | "settings-get"
  | "settings-save";

export type SidecarEventType =
  | "started"
  | "progress"
  | "result"
  | "warning"
  | "error";

export interface SidecarEvent<T = unknown> {
  protocolVersion: 1;
  command: SidecarCommand;
  taskId: string;
  event: SidecarEventType;
  timestamp: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    detail?: string;
  };
}
```

### 9.4 扫描请求

```ts
export type DeleteMode =
  | "jpg_as_source_delete_raw"
  | "raw_as_source_delete_jpg";

export interface ScanRequest {
  protocolVersion: 1;
  taskId: string;
  rootPath: string;
  deleteMode: DeleteMode;
  options: {
    recursive: boolean;
    includeHiddenFiles: boolean;
    ignoreCase: boolean;
  };
}
```

示例：

```json
{
  "protocolVersion": 1,
  "taskId": "scan_20260526_001",
  "rootPath": "/Users/user/Pictures/澳门",
  "deleteMode": "jpg_as_source_delete_raw",
  "options": {
    "recursive": true,
    "includeHiddenFiles": false,
    "ignoreCase": true
  }
}
```

### 9.5 扫描结果

```ts
export type MediaKind = "image" | "raw" | "sidecar" | "unknown";

export interface MediaFile {
  path: string;
  relativePath: string;
  name: string;
  ext: string;
  key: string;
  kind: MediaKind;
  size: number;
  modifiedAt: number;
}

export interface ScanResult {
  scanId: string;
  rootPath: string;
  deleteMode: DeleteMode;
  directoryMode: "separate_dirs" | "mixed_dir" | "manual" | "unknown";
  imageFiles: MediaFile[];
  rawFiles: MediaFile[];
  sidecarFiles: MediaFile[];
  matchedCount: number;
  conflicts: CompareConflict[];
  deleteCandidates: MediaFile[];
  totalDeleteSize: number;
  manifestPath: string;
}

export interface CompareConflict {
  key: string;
  reason: "duplicate_image" | "duplicate_raw" | "ambiguous_match";
  files: MediaFile[];
}
```

JSON Lines 输出示例：

```json
{"protocolVersion":1,"command":"scan","taskId":"scan_20260526_001","event":"started","timestamp":"2026-05-26T00:00:00.000Z","data":{"rootPath":"/Users/user/Pictures/澳门"}}
{"protocolVersion":1,"command":"scan","taskId":"scan_20260526_001","event":"progress","timestamp":"2026-05-26T00:00:00.100Z","data":{"scanned":100,"phase":"walking"}}
{"protocolVersion":1,"command":"scan","taskId":"scan_20260526_001","event":"result","timestamp":"2026-05-26T00:00:00.300Z","data":{"scanId":"scan_20260526_001","matchedCount":126,"deleteCandidates":[]}}
```

### 9.6 删除请求

删除请求不能只传任意路径。必须关联一次已完成扫描生成的 `scanId` 和 manifest。

```ts
export interface TrashRequest {
  protocolVersion: 1;
  taskId: string;
  scanId: string;
  rootPath: string;
  confirmed: true;
  selectedFiles: Array<{
    path: string;
    size: number;
  }>;
}
```

示例：

```json
{
  "protocolVersion": 1,
  "taskId": "trash_20260526_001",
  "scanId": "scan_20260526_001",
  "rootPath": "/Users/user/Pictures/澳门",
  "confirmed": true,
  "selectedFiles": [
    {
      "path": "/Users/user/Pictures/澳门/raw/DSC05330.ARW",
      "size": 38797312
    }
  ]
}
```

### 9.7 删除结果

```ts
export interface TrashResultItem {
  path: string;
  size: number;
  status: "moved_to_trash" | "failed";
  error?: string;
}

export interface TrashResult {
  taskId: string;
  scanId: string;
  total: number;
  successCount: number;
  failedCount: number;
  releasedSize: number;
  items: TrashResultItem[];
  logPath: string;
}
```

---

## 10. 业务规则迁移

### 10.1 文件扩展名

`shared/fileExtensions.ts` 应复用或迁移旧版本扩展名表。

#### JPG 类图片

```ts
export const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".heic",
  ".heif",
  ".hif",
  ".tif",
  ".tiff",
  ".webp",
  ".avif",
  ".bmp"
] as const;
```

#### RAW 类文件

```ts
export const RAW_EXTENSIONS = [
  ".crw",
  ".cr2",
  ".cr3",
  ".nef",
  ".nrw",
  ".arw",
  ".srf",
  ".sr2",
  ".arq",
  ".raf",
  ".rw2",
  ".raw",
  ".rwl",
  ".orf",
  ".pef",
  ".dng",
  ".3fr",
  ".fff",
  ".iiq",
  ".mef",
  ".x3f",
  ".dcr",
  ".kdc",
  ".mrw",
  ".erf",
  ".srw",
  ".gpr",
  ".mos",
  ".cap",
  ".eip",
  ".bay",
  ".r3d"
] as const;
```

#### 附属文件

```ts
export const SIDECAR_EXTENSIONS = [
  ".xmp",
  ".dop",
  ".cos",
  ".on1",
  ".pp3"
] as const;
```

### 10.2 匹配 key

```ts
import path from "node:path";

export function getFileKey(filePath: string): string {
  const filename = path.basename(filePath);
  const ext = path.extname(filename);
  return filename.slice(0, filename.length - ext.length).toLowerCase();
}
```

### 10.3 候选规则

```txt
模式：jpg_as_source_delete_raw
- 如果一个 RAW key 不存在唯一 JPG 匹配，则：
  - 没有 JPG：成为 RAW 删除候选；
  - JPG 多个或 RAW 多个：进入冲突，不成为候选。

模式：raw_as_source_delete_jpg
- 如果一个 IMAGE key 不存在唯一 RAW 匹配，则：
  - 没有 RAW：成为 IMAGE 删除候选；
  - JPG 多个或 RAW 多个：进入冲突，不成为候选。
```

### 10.4 删除 manifest

扫描完成时，Sidecar 必须写入本次候选 manifest 至应用缓存 / 数据目录：

```json
{
  "scanId": "scan_20260526_001",
  "rootPath": "/Users/user/Pictures/澳门",
  "deleteMode": "jpg_as_source_delete_raw",
  "createdAt": "2026-05-26T00:00:00.000Z",
  "candidates": [
    {
      "path": "/Users/user/Pictures/澳门/raw/DSC05330.ARW",
      "size": 38797312,
      "modifiedAt": 1748200000000
    }
  ]
}
```

执行 trash 前必须校验：

```txt
1. scanId 对应 manifest 存在。
2. 请求中的 rootPath 与 manifest 相同。
3. selectedFiles 是 manifest.candidates 的子集。
4. 文件当前仍然位于 rootPath 内，必须使用 realpath 防止路径逃逸。
5. 文件当前仍然存在。
6. 文件扩展名仍然属于本任务可删除类型。
7. 可选：size / modifiedAt 变化时警告并拒绝该文件，要求用户重新扫描。
```

---

## 11. 回收站删除实现策略

### 11.1 优先策略

优先在 Node Sidecar 中实现移动到系统回收站，保持主要维护逻辑在 Node.js。

要求：

```txt
- 选择可跨平台移动到回收站的 Node 依赖。
- 不直接使用 fs.unlink / fs.rm。
- 必须在 pkg 打包后的真实 sidecar binary 中验证，而不是只在 node dev 模式验证。
```

### 11.2 安全回退策略

如果 Node Sidecar 的回收站依赖在目标平台或 pkg 二进制中表现不稳定，不要降低为硬删除。

允许的回退方式是：

```txt
- 仅将 move-to-trash 系统动作改为一个极薄的 Tauri/Rust command；
- scan / compare / manifest / log / settings 仍保留 Node Sidecar；
- 前端与 Node 业务层接口保持不变。
```

### 11.3 删除测试矩阵

必须验证：

| 场景 | macOS | Windows | Linux |
|---|---:|---:|---:|
| 本地磁盘普通文件 | 必测 | 必测 | 计划支持时必测 |
| 中文目录 / 文件名 | 必测 | 必测 | 计划支持时必测 |
| 空格路径 | 必测 | 必测 | 计划支持时必测 |
| 多文件批量删除 | 必测 | 必测 | 计划支持时必测 |
| 删除失败返回 | 必测 | 必测 | 计划支持时必测 |
| 外置磁盘 | 必测 | 必测 | 明确策略 |
| NAS / 网络盘 | 明确支持或阻止策略 | 明确支持或阻止策略 | 明确支持或阻止策略 |

NAS / 网络盘未完成验证前，UI 应展示明显风险提示，或阻止执行删除。

---

## 12. 前端接入

### 12.1 Tauri 桌面能力门面

`src/lib/desktopApi.ts`：

```ts
import { open } from "@tauri-apps/plugin-dialog";
import type {
  ScanRequest,
  ScanResult,
  TrashRequest,
  TrashResult
} from "../../shared/protocol";

export async function selectDirectory(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false
  });

  return typeof selected === "string" ? selected : null;
}

export async function runScan(request: ScanRequest): Promise<ScanResult> {
  // 调用 sidecarClient，解析 JSON Lines 后返回 ScanResult。
  throw new Error("Implement with sidecarClient");
}

export async function moveToTrash(request: TrashRequest): Promise<TrashResult> {
  // 调用 sidecarClient，执行 trash command。
  throw new Error("Implement with sidecarClient");
}
```

说明：

```txt
- request 临时文件可通过 Tauri 文件写入能力或最小桥接生成。
- 不把任意 JSON 或完整用户路径拼成未经处理的 shell 命令字符串。
```

### 12.2 `sidecarClient.ts`

职责：

```txt
- 构造任务 ID。
- 写入 request JSON。
- 执行 Sidecar。
- 读取 stdout JSON Lines。
- 派发 progress 回调。
- 处理 exit code 与协议错误。
```

API：

```ts
export interface SidecarRunOptions<T> {
  command: "scan" | "trash" | "settings-get" | "settings-save";
  request: unknown;
  onProgress?: (data: unknown) => void;
}

export async function executeSidecarTask<T>(
  options: SidecarRunOptions<T>
): Promise<T>;
```

### 12.3 UI 页面复用

从 Electron 旧版迁移并保持：

```txt
HomePage
ScanResultPage
PendingDeletePage
SettingsPage
AboutPage
FileTree / FileTreeNode
ConfirmDialog
UpdateDialog
```

删除页面必须保留优化后的树状布局：

```txt
- 顶部统计摘要
- 工具栏：全选 / 展开全部 / 收起全部 / 搜索
- 左侧树状文件列表
- 右侧已选汇总卡
- 底部系统回收站安全提示
- 删除确认弹窗
```

---

## 13. 自动更新与更新签名

### 13.1 更新机制决策

新版本一律采用 Tauri 官方 Updater：

```txt
- 不迁移 Electron updateService。
- 不生成或替换 app.asar。
- 每次更新为完整 Tauri 应用更新产物。
- Node Sidecar 随应用更新包一起更新。
```

### 13.2 安装 Updater

```bash
pnpm tauri add updater
pnpm tauri add process
```

### 13.3 生成更新签名密钥

```bash
pnpm tauri signer generate -w ~/.tauri/raw-pair-cleaner-lite.key
```

密钥管理：

```txt
私钥：
- 用于构建时签名 updater artifacts。
- 禁止提交 Git。
- 写入 CI Secret：TAURI_SIGNING_PRIVATE_KEY。
- 密码写入 CI Secret：TAURI_SIGNING_PRIVATE_KEY_PASSWORD。
- 必须做离线备份；丢失后，已安装客户端无法验证以后发布的新更新。

公钥：
- 写入 tauri.conf.json。
- 可公开。
- 客户端使用公钥校验下载的更新包。
```

### 13.4 `tauri.conf.json` 更新配置

配置示意：

```json
{
  "productName": "RAW Pair Cleaner",
  "version": "0.1.0-beta.1",
  "identifier": "com.ywandy.rawpaircleaner.lite",
  "bundle": {
    "active": true,
    "externalBin": [
      "binaries/raw-pair-sidecar"
    ],
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY",
      "endpoints": [
        "https://download.example.com/raw-pair-cleaner-lite/stable/latest.json"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

约束：

```txt
- endpoint 正式发布前替换为真实 HTTPS 下载域名。
- Windows 安装模式优先使用 passive。
- 更新签名验证不可绕过。
```

### 13.5 静态 `latest.json`

正式分发可使用 COS / CDN 承载静态 JSON 与安装包。

```json
{
  "version": "1.0.1",
  "notes": "修复目录识别问题，并优化文件树展示。",
  "pub_date": "2026-05-26T00:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "必须填写对应 .sig 文件的内容，而不是 URL",
      "url": "https://download.example.com/raw-pair-cleaner-lite/releases/v1.0.1/macos-aarch64-update.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "必须填写对应 .sig 文件的内容，而不是 URL",
      "url": "https://download.example.com/raw-pair-cleaner-lite/releases/v1.0.1/macos-x86_64-update.tar.gz"
    },
    "windows-x86_64": {
      "signature": "必须填写对应 .sig 文件的内容，而不是 URL",
      "url": "https://download.example.com/raw-pair-cleaner-lite/releases/v1.0.1/windows-x86_64-update.zip"
    },
    "linux-x86_64": {
      "signature": "必须填写对应 .sig 文件的内容，而不是 URL",
      "url": "https://download.example.com/raw-pair-cleaner-lite/releases/v1.0.1/linux-x86_64-update.AppImage.tar.gz"
    }
  }
}
```

注意：

```txt
- JSON 中所有已声明平台的信息必须完整有效。
- signature 字段必须放入 `.sig` 文件实际文本内容。
- 具体更新 artifact 文件名以 Tauri 实际构建输出为准，脚本从构建产物中读取，不要凭示例硬编码。
```

### 13.6 更新 UI

设置页增加：

```txt
当前版本
检查更新
发现新版本弹窗
更新说明
下载进度
安装并重启
更新失败提示
```

前端调用示意：

```ts
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export async function downloadAndInstallUpdate(
  onProgress: (downloaded: number, total?: number) => void
) {
  const update = await check();
  if (!update) {
    return { available: false };
  }

  let downloaded = 0;
  let total: number | undefined;

  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? undefined;
      onProgress(downloaded, total);
    }

    if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress(downloaded, total);
    }
  });

  await relaunch();

  return {
    available: true,
    version: update.version
  };
}
```

---

## 14. macOS 分发策略

### 14.1 当前条件

当前不计划立即以付费 Apple Developer 身份完成正式签名与公证。

因此分发必须分为两个阶段。

### 14.2 内测阶段

#### 产物

```txt
DMG 为主
ZIP 可作为备用调试产物
```

#### Tauri 配置

没有 Apple authenticated identity 时，可对 macOS 使用 ad-hoc signing：

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "-"
    }
  }
}
```

#### 用户体验预期

```txt
- 用户通过浏览器下载 DMG 后，首次打开可能被 macOS Gatekeeper 阻止。
- 用户可能需要在「系统设置 -> 隐私与安全性」中手动允许打开。
- ad-hoc signing 不会消除该手动放行要求。
```

#### 分发范围

```txt
- 自己验证
- 朋友 / 小范围内测
- GitHub 预览发布
```

不得在无 Apple 正式签名与公证的阶段宣传为面向普通 Mac 用户的顺畅正式版本。

### 14.3 正式公开发布 Gate

若准备在官网 / COS 主推给普通摄影用户，macOS 版本必须补齐：

```txt
- Apple Developer Program
- Developer ID Application 代码签名
- Apple Notarization 公证
- DMG 产物验证
- Sidecar 随 App Bundle 正常签名与执行验证
- 自动更新后重新启动与 Sidecar 执行验证
```

注意：

```txt
Tauri Updater 的更新包签名只验证更新来源，不能替代 Apple Developer ID 签名与 Notarization。
```

---

## 15. 发布与 CI/CD

### 15.1 构建矩阵

首轮支持：

```txt
macOS arm64
macOS x64
Windows x64
```

Linux 是否对外发布，由回收站行为与用户需求验证后决定；可以先保留构建实验，不承诺正式支持。

### 15.2 GitHub Actions Pipeline

#### `verify.yml`

触发：

```txt
pull_request
push main
```

执行：

```txt
1. pnpm install --frozen-lockfile
2. pnpm typecheck
3. pnpm test
4. pnpm build:web
5. sidecar 单元测试
```

#### `release.yml`

触发：

```txt
push tag: v*
```

流程：

```txt
1. Checkout
2. 安装 Node / pnpm / Rust / 平台依赖
3. pnpm install --frozen-lockfile
4. 运行测试
5. 在当前 runner 上构建本平台 sidecar binary
6. 将 binary 重命名并 stage 到 src-tauri/binaries/
7. 注入 Tauri 更新私钥环境变量
8. 构建 Tauri 安装包与 updater artifacts
9. 上传 GitHub Release artifacts
10. 生成 / 合并 latest.json
11. 测试期：latest.json 可发布到 GitHub Release
12. 正式期：同步安装包、签名内容、latest.json 到 COS / CDN
```

### 15.3 CI Secrets

#### Tauri Updater 必需

```txt
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

#### 正式 COS / CDN 分发阶段

```txt
COS_SECRET_ID
COS_SECRET_KEY
COS_BUCKET
COS_REGION
COS_CDN_BASE_URL
```

#### macOS 正式签名 / 公证阶段

```txt
APPLE_CERTIFICATE
APPLE_CERTIFICATE_PASSWORD
APPLE_SIGNING_IDENTITY
APPLE_ID
APPLE_PASSWORD
APPLE_TEAM_ID
```

或使用 App Store Connect API 凭据路径。

---

## 16. 测试计划

### 16.1 测试夹具

建立以下测试目录：

```txt
tests/fixtures/
├── paired-basic/
│   ├── IMG_0001.jpg
│   ├── IMG_0001.CR3
│   ├── IMG_0002.jpg
│   └── IMG_0002.CR3
├── jpg-source-delete-raw/
│   ├── IMG_0001.jpg
│   ├── IMG_0001.CR3
│   └── IMG_9999.CR3
├── raw-source-delete-image/
│   ├── IMG_0001.jpg
│   ├── IMG_0001.CR3
│   └── IMG_9999.jpg
├── conflicts/
│   ├── IMG_0001.jpg
│   ├── IMG_0001.jpeg
│   └── IMG_0001.CR3
├── sidecars/
│   ├── IMG_0001.CR3
│   ├── IMG_0001.xmp
│   └── IMG_0001.jpg
└── unicode-and-spaces/
    └── 澳门 鸡笼顶/
        ├── DSC05330.JPG
        └── DSC05330.ARW
```

大规模 fixture 不提交真实大文件，可通过测试脚本生成空文件或小文件：

```txt
10,000 个模拟文件
多层目录
中文路径
空格路径
扩展名大小写混合
```

### 16.2 单元测试

必须覆盖：

```txt
- 扩展名分类
- key 归一化
- JPG 为准删除 RAW
- RAW 为准删除 JPG
- 重复 key 冲突
- sidecar 默认不删除
- candidate manifest 子集校验
- 路径逃逸校验
- modifiedAt / size 变化后的拒绝删除策略
```

### 16.3 集成测试

必须覆盖：

```txt
- Sidecar scan 命令输出合法 JSON Lines
- Tauri 调用 Sidecar 并渲染结果
- 选择目录与拖拽目录
- 删除确认 UI
- 回收站删除真实文件
- 删除日志生成
```

### 16.4 更新测试

测试流程：

```txt
1. 构建并安装 0.1.0-beta.1。
2. 发布签名的 0.1.0-beta.2 updater artifacts。
3. 客户端检测到更新。
4. 下载显示进度。
5. 安装并重启成功。
6. 新版本 Sidecar 也同步更新并可执行。
7. 手动篡改下载的更新产物，校验必须失败。
```

### 16.5 macOS 安装测试

内测阶段：

```txt
- DMG 可以打开。
- 应用可以拖入 Applications。
- 手动放行后正常启动。
- Sidecar 可以成功扫描。
- Sidecar 可以将测试文件移入废纸篓。
- Tauri updater 更新后仍可启动与执行 sidecar。
```

正式阶段追加：

```txt
- Developer ID 签名验证。
- Notarization 验证。
- 浏览器下载后首次打开没有未知开发者阻断式提示。
```

---

## 17. 实施阶段与 PR 拆分

### PR-00：基线与验收标准

内容：

```txt
- 记录 Electron 当前安装包大小。
- 准备测试 fixtures。
- 记录旧版扫描 / 匹配预期结果。
- 建立 release-gates.md。
```

验收：

```txt
有一份可供 Tauri 结果对比的基线文档。
```

### PR-01：初始化 Tauri 新仓库

内容：

```txt
- Tauri v2 + React + TypeScript + Vite。
- TailwindCSS。
- pnpm workspace。
- 新 identifier。
- 初始图标与窗口配置。
```

验收：

```bash
pnpm install
pnpm tauri dev
```

可启动空应用。

### PR-02：迁移 UI

内容：

```txt
- 迁入 HomePage / ScanResultPage / PendingDeletePage / SettingsPage / AboutPage。
- 迁入树状删除 UI。
- 替换 Electron API 为暂时 mock desktopApi。
```

验收：

```txt
所有核心页面可以切换与展示 mock 数据。
```

### PR-03：Node Sidecar CLI 与协议

内容：

```txt
- 建立 sidecar workspace。
- 建立 shared protocol。
- 支持 scan / trash / settings-get / settings-save command shell。
- JSON Lines 输出框架。
- 单元测试框架。
```

验收：

```txt
Sidecar 能接收 request JSON 并输出协议化结果。
```

### PR-04：迁移扫描、匹配与 manifest

内容：

```txt
- 文件扫描。
- 文件分类。
- 目录模式识别。
- 匹配与冲突检测。
- 候选 manifest 写入与验证模块。
- 测试夹具回归。
```

验收：

```txt
Sidecar 扫描测试目录结果与 Electron 旧版预期一致。
```

### PR-05：Sidecar Binary + Tauri 接入 PoC

内容：

```txt
- @yao-pkg/pkg 构建。
- target triple staging。
- Tauri externalBin。
- shell capability。
- 前端真实选择目录和扫描。
- 构建第一个目标平台安装包。
- 输出体积对比报告。
```

验收 / Gate 1：

```txt
若包体与稳定性满足目标，继续 PR-06；
否则停止完整迁移并复盘方案。
```

### PR-06：安全删除与日志

内容：

```txt
- 回收站依赖验证。
- trash request 校验。
- manifest 子集校验。
- realpath 路径校验。
- 日志。
- UI 删除流程打通。
```

验收：

```txt
真实测试文件只能被移到系统回收站，不存在硬删除代码路径。
```

### PR-07：Updater 与签名更新

内容：

```txt
- Tauri updater/process 插件。
- 签名密钥配置。
- 更新 UI。
- latest.json 测试发布。
- beta.1 -> beta.2 真实升级测试。
```

验收：

```txt
签名更新成功；篡改更新产物无法安装。
```

### PR-08：多平台构建与内测发布

内容：

```txt
- macOS arm64 / x64。
- Windows x64。
- Linux 实验构建可选。
- GitHub Release。
- macOS ad-hoc DMG 内测安装说明。
```

验收：

```txt
目标平台真实安装、扫描、删除、更新链路均已记录验证结论。
```

### PR-09：正式分发能力（条件具备后）

内容：

```txt
- COS / CDN。
- 官网下载链接。
- Apple Developer ID 签名。
- Apple Notarization。
- 正式 DMG。
- 更新域名切换到生产 CDN。
```

验收：

```txt
满足普通用户公开推广标准。
```

---

## 18. 实施工期估算

| 阶段 | 预计工作量 |
|---|---:|
| PR-00 基线与 fixtures | 0.5 天 |
| PR-01 初始化项目 | 0.5 - 1 天 |
| PR-02 迁移 UI | 1 天 |
| PR-03 Sidecar CLI 与协议 | 1 天 |
| PR-04 扫描 / 匹配 / manifest | 1.5 - 2 天 |
| PR-05 Sidecar 打包与 Tauri PoC | 1.5 - 2 天 |
| PR-06 回收站安全删除与日志 | 1.5 - 2 天 |
| PR-07 Updater 与签名更新 | 1.5 - 2 天 |
| PR-08 多平台内测构建 | 1 - 2 天 |
| PR-09 正式分发能力 | 条件具备后 1 - 2 天 |

里程碑：

```txt
可判断 Sidecar 方案是否值得继续：约 5 - 7 个开发日
可供小范围内测：约 9 - 12 个开发日
可供普通用户正式推广：内测完成后，再补 Apple 签名、公证和生产下载链路
```

---

## 19. Codex 第一轮执行任务

在新仓库目录中执行以下任务，完成后停下并报告结果，不要一轮直接写完所有功能。

### 第一轮目标：完成可运行骨架 + Sidecar Hello PoC

```txt
1. 初始化 Tauri v2 + React + TypeScript + Vite + TailwindCSS 项目。
2. 初始化 pnpm workspace，并建立 sidecar/ 子项目。
3. 配置新应用 identifier：com.ywandy.rawpaircleaner.lite。
4. 接入 dialog、shell、updater、process 插件基础依赖。
5. 建立本文档要求的基础目录结构。
6. sidecar 实现 hello 命令：
   - 接收一个字符串参数。
   - stdout 返回 JSON。
7. 使用 @yao-pkg/pkg 将 sidecar 编译成当前平台 binary。
8. 按 target triple 将 binary stage 到 src-tauri/binaries/。
9. 配置 tauri bundle.externalBin 和 shell capability。
10. React 首页放置一个仅开发可见的「测试 Sidecar」按钮。
11. 点击后调用 sidecar 并显示返回结果。
12. 确保 pnpm tauri dev 能运行。
13. 确保当前平台 pnpm build 能产生 Tauri 安装产物。
14. 输出：
   - 当前项目目录结构；
   - 构建命令；
   - 当前安装产物路径和体积；
   - 下一轮应迁移哪些 UI / 业务模块。
```

### 第一轮禁止事项

```txt
- 不实现真实删除。
- 不实现自动更新发布。
- 不迁移所有 Electron 服务。
- 不为了临时跑通放开任意 shell 权限。
```

---

## 20. 后续 Codex 执行顺序

在第一轮验证通过后，按顺序逐轮执行：

```txt
第二轮：迁入 React UI 与 mock 数据页面。
第三轮：迁移 shared/types、fileExtensions、scan 与 compare。
第四轮：打通真实目录扫描与树状候选展示。
第五轮：实现 manifest 与安全回收站删除。
第六轮：实现日志、设置与异常提示。
第七轮：接入 Tauri Updater 和签名测试更新。
第八轮：完成多平台构建与 DMG 内测分发。
```

每一轮要求：

```txt
- 先阅读本文档。
- 只完成当前轮目标。
- 完成后运行类型检查和测试。
- 输出修改文件清单、运行命令、验收结果和遗留问题。
```

---

## 21. 发布前最终验收清单

### 产品行为

```txt
[ ] 两种清理模式结果与 Electron 稳定版一致
[ ] 冲突文件不会自动进入候选
[ ] 附属文件默认不删除
[ ] 树状复核页面交互完整
[ ] 删除前二次确认完整
```

### 安全链路

```txt
[ ] 代码库不存在针对用户文件的硬删除实现
[ ] trash 请求必须关联扫描 manifest
[ ] 非候选文件路径无法被删除任务执行
[ ] 路径逃逸被拒绝
[ ] 回收站删除失败可见
[ ] 删除日志可追踪
```

### 轻量化

```txt
[ ] 已记录 Electron 基线安装包大小
[ ] 已记录 Tauri + Sidecar 安装包大小
[ ] 达到预设体积门槛
[ ] 冷启动与扫描性能没有不可接受退化
```

### 更新

```txt
[ ] Updater 签名密钥已生成并离线备份
[ ] 私钥只存在于安全存储 / CI Secret
[ ] latest.json 格式合法
[ ] beta.1 -> beta.2 升级成功
[ ] 篡改更新包无法安装
[ ] Sidecar 随更新同步替换成功
```

### macOS 分发

```txt
[ ] 内测 DMG 安装流程已经实际验证
[ ] 内测阶段明确告知 Gatekeeper 手动放行要求
[ ] 准备公开推广前，已完成 Developer ID 与 Notarization，或明确不推广 macOS 正式版
```

---

## 22. 官方资料参考

实现时以官方最新文档为准，尤其不要凭旧版 Tauri 配置猜测权限或插件字段：

- Tauri v2 — Node.js as a sidecar  
  `https://v2.tauri.app/learn/sidecar-nodejs/`
- Tauri v2 — Sidecar / External Binary  
  `https://v2.tauri.app/develop/sidecar/`
- Tauri v2 — Updater Plugin  
  `https://v2.tauri.app/plugin/updater/`
- Tauri v2 — macOS Code Signing  
  `https://v2.tauri.app/distribute/sign/macos/`
- 当前 Electron 稳定版参考仓库  
  `https://github.com/ywandy/jpgDelRaw-Desktop`

---

## 23. 最终交付目标

完成本计划后，新仓库应交付：

```txt
- 独立运行的 Tauri v2 桌面应用
- React / TailwindCSS 的 RAW Pair Cleaner UI
- 被打包进应用的 Node.js Sidecar
- JPG / RAW 扫描、匹配、候选生成
- 安全的系统回收站删除
- JSON 删除日志
- 签名自动更新能力
- macOS DMG 内测产物
- Windows 安装产物
- 包体对比与发布验收报告
```

最终产品架构：

```txt
RAW Pair Cleaner Lite
= React + TypeScript + TailwindCSS
+ Tauri v2
+ Node.js Sidecar
+ Tauri Signed Updater
+ DMG / Windows Installer 分发
```
