# engineering-journal

`engineering-journal` 是一个面向工程师的个人工程日志 CLI 工具。

它的目标是把每日 Git 提交、代码变化、技术判断、验证方式和个人反思沉淀成长期可复盘的工程记录。

CLI 命令名为 `englog`。

## 当前状态

当前项目已经完成最小日报闭环的主体能力：

- TypeScript + Node.js 工程配置。
- `englog` CLI 入口。
- `englog init` 初始化日志目录、默认模板、配置文件和本地缓存忽略规则。
- `englog daily` 采集指定日期的 Git 提交，写入 append-only 事件 JSON，并生成日报 Markdown。
- `englog daily --include-diff` 可在显式授权下采集受控 commit patch，供事件追溯和 AI 分析使用。
- `englog daily --no-git` 在非 Git 场景生成空事件和日报骨架。
- `englog daily --sync` 在干净工作区中执行 pull、采集、渲染、commit 和 push。
- `englog render daily` 基于已有事件重渲染日报自动区，并保留人工区。
- `englog status` 查看今天事件、日报、人工区标记和 Git 同步状态。
- `englog weekly/monthly/quarterly/half-year/yearly` 基于低一层日志生成周期总结，并提示缺失来源。
- `englog render weekly/monthly/quarterly/half-year/yearly` 重渲染周期总结自动区，并保留人工区。
- 可选 OpenAI-compatible API 分析接口，将模型返回的结构化结果写入事件 `analysis` 字段。
- `englog analyze daily` 可对指定日期已有事件重新运行 AI 分析，支持 `--dry-run` 预览且不落盘。
- `englog search` 可直接检索事件 JSON 与各周期 Markdown，定位日期、文件和标签。
- `englog stats` 可按月份和标签聚合事件、提交、文件、测试、风险、项目和标签分布。
- `config`、`git`、`journal`、`storage`、`time` 等核心模块边界。
- 构建、测试、类型检查和开发运行脚本。

Dashboard 可视化仍在后续里程碑中。

## 环境要求

- Node.js 20 或更高版本。
- npm.

## 安装

```bash
npm install
```

## 开发

从源码运行 CLI：

```bash
npm run dev -- --help
```

构建：

```bash
npm run build
```

运行测试：

```bash
npm test
```

运行类型检查：

```bash
npm run lint
```

构建后运行编译产物：

```bash
./dist/cli.js --help
```

## CLI

```bash
englog --help
```

当前可用命令：

```bash
englog init
englog daily --date 2026-06-15
englog daily --date 2026-06-15 --repo /path/to/repo
englog daily --date 2026-06-15 --no-git
englog daily --date 2026-06-15 --include-diff
englog daily --date 2026-06-15 --sync
englog render daily --date 2026-06-15
englog weekly --week 2026-W25
englog monthly --month 2026-06
englog quarterly --quarter 2026-Q2
englog half-year --period 2026-H1
englog yearly --year 2026
englog render weekly --week 2026-W25
englog analyze daily --date 2026-06-15 --dry-run
englog analyze daily --date 2026-06-15
englog search auth middleware
englog stats --month 2026-06
englog stats --tag auth
englog status --date 2026-06-15
```

`englog daily --sync` 适合在日志仓库已经配置好 Git remote/upstream 后使用。它要求工作区干净；如果存在未提交改动，会先停止并提示你 commit、stash 或清理后再同步，避免把人工修改和自动日报混在同一个提交里。

`englog status` 会给出一个 `next action`，用于判断当前应该运行 `englog daily`、`englog daily --sync`、`git push`，还是先处理本地未提交内容。

## 推荐操作流程

### 首次初始化

在准备存放工程日志的目录中初始化：

```bash
englog init
```

建议把这个目录作为一个私有 Git 仓库使用，方便多设备同步和长期备份：

```bash
git init
git add .
git commit -m "Initialize engineering journal"
git remote add origin <your-private-repo-url>
git push -u origin HEAD
```

如果日常记录的是另一个代码仓库，可以在 `englog.config.json` 中设置：

```json
{
  "journalRoot": ".",
  "defaultRepo": "/path/to/your/project"
}
```

### 每日记录

一天结束时先查看状态：

```bash
englog status
```

普通使用建议先运行：

```bash
englog daily
```

这会采集当天 Git commit，写入 append-only 事件 JSON，并生成或更新 `journals/daily/{date}.md`。生成后打开当天日报，在人工区补充：

- 为什么做这些改动。
- 哪些判断是关键取舍。
- 如何验证结果可信。
- 明天最值得继续推进什么。

如果只是想补一篇没有 Git commit 的日志：

```bash
englog daily --no-git
```

### 多设备同步

日志仓库已经配置 remote/upstream 后，推荐日常使用：

```bash
englog daily --sync
```

它会执行 pull、采集、渲染、commit 和 push。执行前需要工作区干净；如果你刚刚手动编辑过日报，先提交或暂存这些改动，再运行同步流程。

### AI 与 diff 增强

AI 分析默认关闭。启用 AI 后，`englog daily` 会把 commit 元信息、文件变化和统计信息发送给配置的 OpenAI-compatible 服务，分析结果写入事件 `analysis` 字段。

如果希望 AI 基于真实代码变化做更具体的复盘，可以显式开启受控 diff 采集：

```bash
englog daily --include-diff
```

这只读取已提交 commit 的 patch，不读取未提交工作区内容。开启前建议确认 `git.exclude` 已覆盖 lockfile、构建产物、环境变量文件、证书密钥等敏感路径。

已有事件需要重新分析时，先 dry-run 查看结果：

```bash
englog analyze daily --date 2026-06-15 --dry-run
```

确认可以接受后再写回并重渲染日报：

```bash
englog analyze daily --date 2026-06-15
```

### 周期复盘

建议每周末生成周报：

```bash
englog weekly
```

每月或阶段结束时继续向上汇总：

```bash
englog monthly
englog quarterly
englog half-year
englog yearly
```

周期总结会优先基于低一层日志生成。缺少日报或周报时，CLI 会在总结中列出缺失来源，并提示应该先补哪些命令。

### 检索与统计

想回看某个主题时使用搜索：

```bash
englog search auth middleware
```

想看一段时间内主要工程主题、测试信号或风险记录时使用统计：

```bash
englog stats --month 2026-06
englog stats --tag auth
```

一个比较稳的日常节奏是：每天 `status -> daily -> 人工补充 -> sync`，每周 `weekly`，每月 `monthly + stats`。这样自动记录负责事实，人工区负责判断，周期总结负责把碎片变成可复盘的脉络。

## AI 分析配置

AI 分析默认关闭。需要接入 OpenAI 兼容接口时，在 `englog.config.json` 中启用：

```json
{
  "defaultRepo": ".",
  "analysis": {
    "enabled": true,
    "provider": "openai-compatible",
    "api": "responses",
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-5.5",
    "apiKey": "your-api-key",
    "temperature": 0.2
  }
}
```

`journalRoot` 是日志写入目标目录，可以写在 `englog.config.json` 中，例如 `"journalRoot": "./my-journal"`；如果不配置，默认就是当前配置文件所在文件夹。

## Diff 采集与隐私

代码 diff 采集默认关闭。只有在运行 `englog daily --include-diff`，或在配置中显式设置 `git.collectDiff: true` 时，CLI 才会读取已提交 commit 的 patch；不会读取 unstaged 或 uncommitted 工作区内容。

可以在 `englog.config.json` 中调整采集边界：

```json
{
  "git": {
    "collectDiff": false,
    "maxDiffChars": 30000,
    "maxFileDiffChars": 8000,
    "exclude": [
      "*.lock",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "dist/**",
      "build/**",
      ".env*",
      "*.pem",
      "*.key"
    ]
  }
}
```

开启后，受限 diff 会写入事件 JSON 的 commit `diff` 字段，事件顶层也会记录 `diffCollection` 元信息，包括最大字符数、被排除文件和是否截断。默认排除 lockfile、构建产物、依赖目录、环境变量文件、证书密钥和常见二进制文件。若 AI 分析也已启用，这些受控 diff 会作为分析输入发送给你配置的 OpenAI-compatible 服务。

`api` 默认使用 `responses`，会请求 `{baseUrl}/responses`；如需兼容旧服务，也可以设置为 `chat-completions`，请求 `{baseUrl}/chat/completions`。`baseUrl` 可以是 OpenAI 兼容服务的 `/v1` 根地址，也可以直接是完整的 `/responses` 或 `/chat/completions` 地址。本地兼容服务也可以使用类似 `http://localhost:11434/v1` 的地址。配置 `apiKey` 时，CLI 会从 JSON 中读取密钥并发送 Bearer token；不配置或为空时不会发送鉴权头。

启用后，`englog daily` 和 `englog daily --sync` 会在写入事件 JSON 前调用一次兼容接口，要求模型返回严格 JSON，并填充：

```text
summary
valuableChanges
technicalHighlights
decisions
risks
tests
aiAssistedParts
humanReviewNotes
tags
```

其中 `tags` 会写入事件顶层 `tags` 字段，并在日报“采集信息”里展示；其他字段写入事件 `analysis`。

已有事件也可以重新分析：

```bash
englog analyze daily --date 2026-06-15 --dry-run
englog analyze daily --date 2026-06-15
```

`--dry-run` 会打印将写入的分析结果，不修改事件 JSON 或日报。去掉 `--dry-run` 后，CLI 会更新当天事件的 `analysis` 字段，并重渲染对应日报自动区，人工区仍会保留。

默认输出路径：

```text
data/events/{date}/{eventId}.json
journals/daily/{date}.md
journals/weekly/{yyyy-Www}.md
journals/monthly/{yyyy-MM}.md
journals/quarterly/{yyyy-Qn}.md
journals/half-year/{yyyy-Hn}.md
journals/yearly/{yyyy}.md
```

日报由 `templates/daily.md` 提供初始结构，周期总结由对应的 `templates/{period}.md` 提供初始结构。再次执行生成或 `render` 命令时，CLI 只替换 `<!-- englog:auto:start -->` 与 `<!-- englog:auto:end -->` 之间的自动区，保留 `<!-- englog:manual:start -->` 与 `<!-- englog:manual:end -->` 之间的人工记录。

本地开发时，可以直接运行构建产物：

```bash
./dist/cli.js --help
```

## 项目结构

```text
src/
  cli.ts
  commands/
  config/
  git/
  journal/
  storage/
  time/
test/
docs/
```
