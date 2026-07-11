# CLI Proxy API 管理中心

用于管理与故障排查 **CLI Proxy API** 的单文件 Web UI（React + TypeScript），通过 **Management API** 完成配置、凭据、日志与统计等管理操作。

[English](README.md)

> **分叉说明。** 本仓库是 [Z-M-Huang](https://github.com/Z-M-Huang) 维护的 [router-for-me/Cli-Proxy-API-Management-Center](https://github.com/router-for-me/Cli-Proxy-API-Management-Center) 分叉。它保留上游当前的提供商工作台与插件界面，同时为配套的 [Z-M-Huang/CLIProxyAPI](https://github.com/Z-M-Huang/CLIProxyAPI) 后端新增**提示词规则**、持久化**使用统计/请求历史**和可配置的提供商 Header 默认值。

**主项目**: https://github.com/Z-M-Huang/CLIProxyAPI  
**上游**: https://github.com/router-for-me/CLIProxyAPI  
**最低版本要求**: ≥ 7.1.0（推荐使用最新分叉版本）

从6.0.19版本开始，Web UI 随主程序一起提供；服务运行后，通过 API 端口上的"/management.html"访问它。

## 这是什么（以及不是什么）

- 本仓库只包含 Web 管理界面本身，通过 CLI Proxy API 的 **Management API**（`/v0/management`）读取/修改配置、上传凭据、查看日志与使用统计。
- 它 **不是** 代理本体，不参与流量转发。

## 快速开始

### 方式 A：使用 CLI Proxy API 自带的 Web UI（推荐）

1. 启动 CLI Proxy API 服务。
2. 打开：`http://<host>:<api_port>/management.html`
3. 输入 **管理密钥** 并连接。

页面会根据当前地址自动推断 API 地址，也支持手动修改。

### 方式 B：开发调试

```bash
bun install --frozen-lockfile
bun run dev
```

打开 `http://localhost:5173`，然后连接到你的 CLI Proxy API 后端实例。

### 方式 C：构建单文件 HTML

```bash
bun install --frozen-lockfile
bun run build
```

- 构建产物：`dist/index.html`（资源已全部内联）。
- 在 CLI Proxy API 的发布流程里会重命名为 `management.html`。
- 本地预览：`bun run preview`

提示：直接用 `file://` 打开 `dist/index.html` 可能遇到浏览器 CORS 限制；更稳妥的方式是用预览/静态服务器打开。

## 连接说明

### API 地址怎么填

以下格式均可，Web UI 会自动归一化：

- `localhost:8317`
- `http://192.168.1.10:8317`
- `https://example.com:8317`
- `http://example.com:8317/v0/management`（也可填写，后缀会被自动去除）

### 管理密钥（注意：不是 API Keys）

管理密钥会以如下方式随请求发送：

- `Authorization: Bearer <MANAGEMENT_KEY>`（默认）

这与 Web UI 中"API Keys"页面管理的 `api-keys` 不同：后者是代理对外接口（如 OpenAI 兼容接口）给客户端使用的鉴权 key。

### 远程管理

当你从非 localhost 的浏览器访问时，需要在后端配置中启用 `remote-management.allow-remote`。完整鉴权规则与限制请参考后端文档和 `config.example.yaml`。

## 功能一览（按页面对应）

- **仪表盘**：连接状态、服务版本/构建时间、关键数量概览、可用模型概览。
- **配置面板**：可视化编辑常用 `config.yaml` 字段、代理 `api-keys`、提供商 Header 默认值与插件设置；源码模式支持 YAML 高亮、搜索和保存前差异预览。
- **AI 提供商**：
  - 上游提供商工作台统一管理 Gemini、Codex、Claude、Vertex、OpenAI 兼容以及受支持的合作提供商资源。
  - 提供商侧栏按能力管理 Key、Header、代理、模型别名、排除模型、模型发现和连通性测试。
- **认证文件**：上传/下载/删除 JSON 凭据，筛选/搜索/分页，标记 runtime-only；查看单个凭据可用模型（依赖后端支持）；管理 OAuth 排除模型（支持 `*` 通配符）；配置 OAuth 模型别名映射。
- **提示规则**：向出站系统提示或最近一条自然语言用户消息注入常驻文本，或通过 RE2 正则剥离不需要的样板内容。规则按模型通配符与来源格式过滤，在协议翻译之前生效，跨请求保持幂等。锚点（Marker）可选：填写时作为定位点（Position 相对于锚点），留空时按目标边界追加或前置。
- **OAuth**：启动并监控 Codex、Claude、Antigravity、Kimi 与 xAI/Grok 流程；支持导入 Vertex JSON 凭据和 iFlow Cookie。
- **配额管理**：查看 Claude、Antigravity、Codex、Kimi、xAI/Grok 等受支持提供商的配额。
- **插件 / 插件商店**：启用已安装插件、编辑插件资源并发现兼容版本。
- **使用统计**：按小时/天图表、按 API 与按模型统计、缓存/推理 Token 拆分、RPM/TPM 时间窗、可选本地保存的模型价格用于费用估算。
- **日志**：增量拉取日志、自动刷新、搜索、隐藏管理端流量、清空日志；下载请求错误日志文件。
- **系统信息**：快捷链接、版本检查、请求日志控制、本地登录信息清理，以及分组展示 `/v1/models`。

## 技术栈

- React 19 + TypeScript 6.0
- Vite 8（单文件构建）
- Zustand（状态管理）
- Axios（HTTP 客户端）
- react-router-dom v7（HashRouter）
- Motion（动效）
- CodeMirror 6（YAML 编辑器）
- SCSS Modules（样式）
- i18next（国际化）

## 多语言支持

目前支持四种语言：

- 英文 (en)
- 简体中文 (zh-CN)
- 繁体中文 (zh-TW)
- 俄文 (ru)

界面语言会根据浏览器设置自动切换，也可在登录页或顶部语言菜单手动切换。

## 浏览器兼容性

- 构建目标：`ES2020`
- 支持 Chrome、Firefox、Safari、Edge 等现代浏览器
- 支持移动端响应式布局，可通过手机/平板访问

## 构建与发布说明

- 使用 Vite 输出 **单文件 HTML**（`dist/index.html`），资源全部内联（`vite-plugin-singlefile`）。
- 打 `zmh-vX.Y.Z` 标签会触发 `.github/workflows/release.yml`，发布 `dist/management.html`。`zmh-v` 前缀用于避开上游的标签空间。
- 系统信息页显示的 UI 版本在构建期注入（优先使用环境变量 `VERSION`，否则使用 git tag / `package.json`）。

## 安全提示

- 管理密钥会存入浏览器 `localStorage`，并使用轻量混淆格式（`enc::v1::...`）避免明文；仍应视为敏感信息。
- 建议使用独立浏览器配置/设备进行管理；开启远程管理时请谨慎评估暴露面。

## 常见问题

- **无法连接 / 401**：确认 API 地址与管理密钥；远程访问可能需要服务端开启远程管理。
- **反复输错密钥**：服务端可能对远程 IP 进行临时封禁。
- **日志页面不显示**：需要在“配置面板”里开启“写入日志文件”，导航项才会出现。
- **功能提示不支持**：多为后端版本较旧或接口未启用/不存在（如：认证文件模型列表、排除模型、日志相关接口）。
- **OpenAI 提供商测试失败**：测试在浏览器侧执行，会受网络与 CORS 影响；这里失败不一定代表服务端不可用。

## 开发命令

```bash
bun run dev        # 启动开发服务器
bun run build      # tsc + Vite 构建
bun run preview    # 本地预览 dist
bun run test       # Bun 测试套件
bun run lint       # ESLint（warnings 视为失败）
bun run verify     # 测试 + lint + 构建
bun run format     # Prettier
bun run type-check # tsc --noEmit
```

## 贡献

请参阅 [CONTRIBUTING.md](./CONTRIBUTING.md)，其中包含本分叉的分支模型、上游同步流程、定制范围和发布流程。PR 提交到本仓库的 `dev` 分支；请附上复现步骤、相关 UI 截图和 `bun run verify` 结果。

## 许可证

MIT
