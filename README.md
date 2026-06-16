# engineering-journal

`engineering-journal` 是一个个人工程日志 CLI。命令名是 `englog`。

它的目标是把指定日期的 Git 提交、代码变化、工程判断、验证方式和个人反思，沉淀成长期可复盘、可检索、可汇总的工程记录。

核心思路：

- 自动收集当天 Git commit、变更文件和增删行。
- 可扫描多个本地 Git 仓库，并默认覆盖所有本地可见分支。
- 默认排除 merge commits，避免把合并别人代码的提交写进个人日报。
- 可按 author email 只保留自己的提交。
- 可选接入 OpenAI-compatible API，从提交和受控 diff 中提炼价值、风险、测试信号和标签。
- 日报、周报、月报等 Markdown 可重复渲染，但人工记录区会保留。

## 快速开始

### 安装与构建

```bash
npm install
npm run build
npm link
```

查看命令：

```bash
englog --help
```

### 初始化日志仓库

在准备存放工程日志的目录中执行：

```bash
englog init
```

建议把这个目录作为私有 Git 仓库同步和备份：

```bash
git init
git add .
git commit -m "Initialize engineering journal"
git remote add origin <your-private-repo-url>
git push -u origin HEAD
```

### 配置扫描范围

编辑日志目录中的 `englog.config.json`。这里的 `"journalRoot": "."` 表示日志写入当前日志目录，也就是这个配置文件所在目录：

```json
{
  "journalRoot": ".",
  "scanRoots": ["/Users/you/workspace"],
  "git": {
    "includeAllBranches": true,
    "includeMergeCommits": false,
    "authorEmails": ["you@example.com"],
    "excludeCommitMessages": [
      "^chore\\(release\\):",
      "^Release "
    ]
  }
}
```

生成指定日期日报：

```bash
englog daily --date 2026-06-15
```

`englog` 会在 `scanRoots` 下发现 Git 仓库，收集指定日期的提交，然后写入：

```text
{journalRoot}/data/events/2026-06-15/{eventId}.json
{journalRoot}/journals/daily/2026-06-15.md
```

如果 `journalRoot` 是 `"."`，这些文件就会出现在 `englog.config.json` 所在目录下。

## 配置模型

### `journalRoot`

日志写入目录。它只决定 `data/`、`journals/`、`templates/` 放在哪里，不决定扫描哪些 Git 仓库。

```json
{
  "journalRoot": "/Users/you/engineering-notes"
}
```

如果不配置，默认是 `englog.config.json` 所在目录。

### `scanRoots`

Git 仓库发现范围。它表示“从哪些目录下面找 Git 仓库”，不是绑定某一个仓库。

```json
{
  "scanRoots": ["/Users/you/workspace"]
}
```

如果 `scanRoots` 中的目录本身是 Git 仓库，会扫描该仓库；如果它下面有多个 Git 仓库，会递归发现。扫描会跳过 `node_modules`、`dist`、`build`、`coverage`、`.cache` 等常见重目录。

如果没有配置 `scanRoots`，`englog daily` 默认采集当前命令所在的 Git 仓库。

### 单仓库临时采集

`--repo` 用于临时只采集一个仓库，会绕过 `scanRoots`：

```bash
englog daily --date 2026-06-15 --repo /path/to/project
```

### 多分支

默认配置：

```json
{
  "git": {
    "includeAllBranches": true
  }
}
```

这会使用所有本地可见分支中的 commit，而不是只看当前分支。这样一个项目中 `main`、`feature/*`、`fix/*` 上同一天的提交都能进入日报。

同一个 commit 如果被多个分支引用，只记录一次。

### Merge Commit

默认配置：

```json
{
  "git": {
    "includeMergeCommits": false
  }
}
```

默认排除 merge commits，避免把“合并别人代码”的提交当作你的工程产出。需要记录 merge commit 时再改成 `true`。

### 作者过滤

强烈建议配置 `authorEmails`：

```json
{
  "git": {
    "authorEmails": ["you@example.com", "you@company.com"]
  }
}
```

配置后只收集 author email 命中的提交。没有配置时，会收集扫描到的仓库中指定日期的所有提交。

### 提交信息过滤

可以用正则排除 release、自动化提交等低价值提交：

```json
{
  "git": {
    "excludeCommitMessages": [
      "^chore\\(release\\):",
      "^Release "
    ]
  }
}
```

这些规则会按正则匹配 commit message，大小写不敏感。

## 日常使用

### 查看状态

```bash
englog status
englog status --date 2026-06-15
```

状态会显示当天事件、日报是否存在、人工区标记是否正常、日志仓库 Git 状态和建议下一步动作。

### 生成日报

```bash
englog daily
englog daily --date 2026-06-15
```

日报生成流程：

1. 发现或读取 Git 仓库。
2. 按日期收集 commit。
3. 按作者、merge、message 规则过滤。
4. 写入 append-only 事件 JSON。
5. 合并当天所有事件。
6. 渲染日报 Markdown。

如果只是想补一篇没有 Git commit 的日志：

```bash
englog daily --date 2026-06-15 --no-git
```

### 人工区

日报中自动区由 `englog` 管理，人工区由你维护：

```text
<!-- englog:auto:start -->
...
<!-- englog:auto:end -->

<!-- englog:manual:start -->
...
<!-- englog:manual:end -->
```

再次运行 `daily` 或 `render` 时，只会替换自动区，人工区会保留。

### 同步日志仓库

日志仓库配置好 remote/upstream 后可以使用：

```bash
englog daily --sync
```

它会执行：

1. 检查日志仓库工作区是否干净。
2. `git pull --rebase`
3. 采集并渲染日报。
4. commit 生成的日志文件。
5. push 到远端。

如果工作区有未提交改动，命令会停止，避免把人工修改和自动生成内容混在一起提交。

## AI 分析

AI 分析默认关闭。启用后，`englog daily` 会把 commit 元信息、文件变化、统计信息以及可选 diff 发送给配置的 OpenAI-compatible 服务，并把模型返回的结构化结果写入事件 `analysis` 字段。

示例：

```json
{
  "analysis": {
    "enabled": true,
    "provider": "openai-compatible",
    "api": "responses",
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-5.5",
    "apiKey": "your-api-key"
  }
}
```

说明：

- `apiKey` 只从 JSON 配置读取。
- `api` 默认是 `responses`，请求 `{baseUrl}/responses`。
- 也可以配置 `"api": "chat-completions"`，请求 `{baseUrl}/chat/completions`。
- `baseUrl` 可以是 OpenAI 官方 `/v1` 地址，也可以是兼容服务地址。
- 不配置 `apiKey` 或配置为空时，不发送鉴权头。
- `temperature` 只有在 JSON 中显式配置时才会发送。

已有事件可以重新分析：

```bash
englog analyze daily --date 2026-06-15 --dry-run
englog analyze daily --date 2026-06-15
```

`--dry-run` 只打印将写入的结果，不修改事件 JSON 或日报。去掉 `--dry-run` 后会更新事件 `analysis` 字段，并重渲染日报自动区。

## Diff 采集与隐私

默认不采集代码 patch。

显式开启：

```bash
englog daily --date 2026-06-15 --include-diff
```

或配置默认开启：

```json
{
  "git": {
    "collectDiff": true
  }
}
```

diff 采集只读取已提交 commit 的 patch，不读取 unstaged 或 uncommitted 工作区内容。

可以配置边界：

```json
{
  "git": {
    "collectDiff": false,
    "maxDiffChars": 30000,
    "maxFileDiffChars": 8000,
    "exclude": [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "openspec/**",
      ".openspec/**",
      "*.lock",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      ".env*",
      "*.pem",
      "*.key",
      "*.crt",
      "*.p12",
      "*.png",
      "*.jpg",
      "*.jpeg",
      "*.gif",
      "*.webp",
      "*.pdf",
      "*.zip",
      "*.tar",
      "*.gz"
    ]
  }
}
```

开启 diff 且启用 AI 时，受控 patch 会进入模型输入。事件 JSON 会记录 diff 是否启用、排除文件和是否截断。开启前请确认排除规则覆盖敏感文件。

## 周期复盘

日报生成后，可以向上汇总：

```bash
englog weekly --week 2026-W25
englog monthly --month 2026-06
englog quarterly --quarter 2026-Q2
englog half-year --period 2026-H1
englog yearly --year 2026
```

也可以重渲染已有周期总结：

```bash
englog render weekly --week 2026-W25
englog render monthly --month 2026-06
englog render quarterly --quarter 2026-Q2
englog render half-year --period 2026-H1
englog render yearly --year 2026
```

周期总结基于低一层日志生成：

```text
daily -> weekly -> monthly -> quarterly -> half-year -> yearly
```

缺少日报或周报时，CLI 会在总结中列出缺失来源，并提示应该先补哪些命令。

## 检索与统计

搜索事件 JSON 和 Markdown：

```bash
englog search auth middleware
```

统计月份、标签、项目、提交、文件、测试和风险：

```bash
englog stats --month 2026-06
englog stats --tag auth
```

## 命令速查

```bash
englog init
englog status
englog status --date 2026-06-15

englog daily
englog daily --date 2026-06-15
englog daily --date 2026-06-15 --repo /path/to/repo
englog daily --date 2026-06-15 --no-git
englog daily --date 2026-06-15 --include-diff
englog daily --date 2026-06-15 --sync

englog render daily --date 2026-06-15
englog analyze daily --date 2026-06-15 --dry-run
englog analyze daily --date 2026-06-15

englog weekly --week 2026-W25
englog monthly --month 2026-06
englog quarterly --quarter 2026-Q2
englog half-year --period 2026-H1
englog yearly --year 2026

englog search auth middleware
englog stats --month 2026-06
englog stats --tag auth
```

## 文件结构

默认输出：

```text
englog.config.json
data/events/{date}/{eventId}.json
journals/daily/{date}.md
journals/weekly/{yyyy-Www}.md
journals/monthly/{yyyy-MM}.md
journals/quarterly/{yyyy-Qn}.md
journals/half-year/{yyyy-Hn}.md
journals/yearly/{yyyy}.md
templates/daily.md
templates/weekly.md
templates/monthly.md
templates/quarterly.md
templates/half-year.md
templates/yearly.md
```

事件 JSON 是 append-only。日报和周期总结可以由事件或低层日志重渲染。

## 开发

环境要求：

- Node.js 20 或更高版本
- npm

常用命令：

```bash
npm install
npm run dev -- --help
npm run build
npm test
npm run lint
./dist/cli.js --help
```

项目结构：

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
