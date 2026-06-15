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
- `englog daily --no-git` 在非 Git 场景生成空事件和日报骨架。
- `englog daily --sync` 在干净工作区中执行 pull、采集、渲染、commit 和 push。
- `englog render daily` 基于已有事件重渲染日报自动区，并保留人工区。
- `englog status` 查看今天事件、日报、人工区标记和 Git 同步状态。
- `config`、`git`、`journal`、`storage`、`time` 等核心模块边界。
- 构建、测试、类型检查和开发运行脚本。

周期总结、AI 分析、搜索与可视化仍在后续里程碑中。

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
englog daily --date 2026-06-15 --sync
englog render daily --date 2026-06-15
englog status --date 2026-06-15
```

`englog daily --sync` 适合在日志仓库已经配置好 Git remote/upstream 后使用。它要求工作区干净；如果存在未提交改动，会先停止并提示你 commit、stash 或清理后再同步，避免把人工修改和自动日报混在同一个提交里。

`englog status` 会给出一个 `next action`，用于判断当前应该运行 `englog daily`、`englog daily --sync`、`git push`，还是先处理本地未提交内容。

默认输出路径：

```text
data/events/{date}/{eventId}.json
journals/daily/{date}.md
```

日报由 `templates/daily.md` 提供初始结构。再次执行 `daily` 或 `render daily` 时，CLI 只替换 `<!-- englog:auto:start -->` 与 `<!-- englog:auto:end -->` 之间的自动区，保留 `<!-- englog:manual:start -->` 与 `<!-- englog:manual:end -->` 之间的人工记录。

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
