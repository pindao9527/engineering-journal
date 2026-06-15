# engineering-journal

`engineering-journal` 是一个面向工程师的个人工程日志 CLI 工具。

它的目标是把每日 Git 提交、代码变化、技术判断、验证方式和个人反思沉淀成长期可复盘的工程记录。

CLI 命令名为 `englog`。

## 当前状态

当前项目已经完成基础脚手架：

- TypeScript + Node.js 工程配置。
- `englog` CLI 入口。
- `init`、`daily`、`render daily` 命令骨架。
- `config`、`git`、`journal`、`storage`、`time` 等核心模块边界。
- 构建、测试、类型检查和开发运行脚本。

当前命令仍是占位实现，后续会继续补齐日志初始化、Git 采集、事件 JSON 写入和 Markdown 渲染能力。

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

当前可用命令骨架：

```bash
englog init
englog daily
englog render daily
```

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
