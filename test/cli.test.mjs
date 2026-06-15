import assert from "node:assert/strict";
import { access, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test, { mock } from "node:test";
import { createProgram } from "../dist/cli.js";
import { runDaily } from "../dist/commands/daily.js";

const cliPath = path.resolve("dist", "cli.js");

test("creates the englog CLI program", () => {
  const program = createProgram();

  assert.equal(program.name(), "englog");
  assert.match(program.helpInformation(), /daily/);
  assert.match(program.helpInformation(), /weekly/);
  assert.match(program.helpInformation(), /render/);
  assert.match(program.helpInformation(), /status/);
});

test("initializes journal structure without overwriting templates", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "englog-init-"));
  runCli(["init"], cwd);

  await assertFileExists(path.join(cwd, "englog.config.json"));
  await assertFileExists(path.join(cwd, "templates", "daily.md"));
  await assertFileExists(path.join(cwd, "templates", "weekly.md"));
  await assertFileExists(path.join(cwd, "journals", "daily"));
  await assertFileExists(path.join(cwd, "journals", "weekly"));

  const dailyTemplate = path.join(cwd, "templates", "daily.md");
  await writeFile(dailyTemplate, "custom template\n", "utf8");
  runCli(["init"], cwd);

  assert.equal(await readFile(dailyTemplate, "utf8"), "custom template\n");
  assert.match(await readFile(path.join(cwd, "templates", "weekly.md"), "utf8"), /englog:auto:start/);
  assert.match(await readFile(path.join(cwd, ".gitignore"), "utf8"), /\.cache\//);
});

test("daily --no-git writes append-only events and preserves manual journal text", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "englog-daily-"));
  runCli(["init"], cwd);
  await writeFile(
    path.join(cwd, "templates", "daily.md"),
    [
      "# Custom Daily {{date}}",
      "",
      "template marker",
      "",
      "<!-- englog:auto:start -->",
      "<!-- englog:auto:end -->",
      "",
      "<!-- englog:manual:start -->",
      "## Manual From Template",
      "",
      "<!-- englog:manual:end -->",
      ""
    ].join("\n"),
    "utf8"
  );
  runCli(["daily", "--date", "2026-06-15", "--no-git"], cwd);

  const eventDirectory = path.join(cwd, "data", "events", "2026-06-15");
  const journalPath = path.join(cwd, "journals", "daily", "2026-06-15.md");
  await assertFileExists(eventDirectory);

  const firstJournal = await readFile(journalPath, "utf8");
  assert.match(firstJournal, /# Custom Daily 2026-06-15/);
  assert.match(firstJournal, /template marker/);
  assert.match(firstJournal, /## Manual From Template/);
  assert.match(firstJournal, /## 今日提交/);
  assert.match(firstJournal, /暂无提交/);

  const editedJournal = firstJournal.replace("## Manual From Template\n", "## Manual From Template\n\n保留这段人工记录。\n");
  await writeFile(journalPath, editedJournal, "utf8");
  runCli(["render", "daily", "--date", "2026-06-15"], cwd);

  const renderedAgain = await readFile(journalPath, "utf8");
  assert.match(renderedAgain, /保留这段人工记录/);

  runCli(["daily", "--date", "2026-06-15", "--no-git"], cwd);
  const eventFiles = await readdir(eventDirectory);
  assert.equal(eventFiles.filter((file) => file.endsWith(".json")).length, 2);
});

test("daily collects commits from a Git repository", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "englog-git-"));
  runCommand("git", ["init"], cwd);
  runCommand("git", ["config", "user.name", "Test Engineer"], cwd);
  runCommand("git", ["config", "user.email", "test@example.com"], cwd);
  await writeFile(path.join(cwd, "feature.ts"), "export const feature = true;\n", "utf8");
  runCommand("git", ["add", "feature.ts"], cwd);
  runCommand("git", ["commit", "-m", "Add feature marker"], cwd, {
    GIT_AUTHOR_DATE: "2026-06-15T10:00:00+08:00",
    GIT_COMMITTER_DATE: "2026-06-15T10:00:00+08:00"
  });

  runCli(["init"], cwd);
  runCli(["daily", "--date", "2026-06-15"], cwd);

  const eventDirectory = path.join(cwd, "data", "events", "2026-06-15");
  const eventFiles = (await readdir(eventDirectory)).filter((file) => file.endsWith(".json"));
  assert.equal(eventFiles.length, 1);

  const event = JSON.parse(await readFile(path.join(eventDirectory, eventFiles[0]), "utf8"));
  assert.equal(event.commits.length, 1);
  assert.equal(event.commits[0].message, "Add feature marker");
  assert.deepEqual(event.changedFiles, ["feature.ts"]);
  assert.equal(event.diffStats.insertions, 1);

  const journal = await readFile(path.join(cwd, "journals", "daily", "2026-06-15.md"), "utf8");
  assert.match(journal, /Add feature marker/);
  assert.match(journal, /feature\.ts/);
});

test("daily in a non-Git directory prints a friendly error", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "englog-not-git-"));
  runCli(["init"], cwd);

  const result = spawnSync(process.execPath, [cliPath, "daily", "--date", "2026-06-15"], {
    cwd,
    encoding: "utf8"
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /englog: Cannot inspect Git repository/);
  assert.doesNotMatch(result.stderr, /at async|Node\.js/);
});

test("daily can enrich event analysis through an OpenAI-compatible API", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "englog-ai-"));
  runCli(["init"], cwd);
  const previousCwd = process.cwd();
  const requests = [];
  const fetchMock = mock.method(globalThis, "fetch", async (url, init) => {
    requests.push({
      url: String(url),
      body: JSON.parse(String(init.body))
    });

    return new Response(
      JSON.stringify({
        output_text: JSON.stringify(analysis)
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" }
      }
    );
  });
  const analysis = {
    summary: ["AI 归纳：生成日报骨架。"],
    valuableChanges: ["将提交事实转成可复盘记录。"],
    technicalHighlights: ["使用 OpenAI 兼容接口填充 analysis 字段。"],
    decisions: ["分析结果写入事件 JSON，Markdown 仍由本地渲染。"],
    risks: ["需要人工复核模型输出。"],
    tests: ["通过本地兼容接口集成测试验证。"],
    aiAssistedParts: ["模型生成自动分析字段。"],
    humanReviewNotes: ["人工保留 manual 区域。"]
  };

  try {
    await writeFile(
      path.join(cwd, "englog.config.json"),
      `${JSON.stringify(
        {
          journalRoot: ".",
          defaultRepo: ".",
          analysis: {
            enabled: true,
            provider: "openai-compatible",
            api: "responses",
            baseUrl: "https://ops-ai-gateway.yc345.tv/v1",
            model: "gpt-5.5"
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    process.chdir(cwd);
    await runDaily({ date: "2026-06-15", git: false });

    const eventDirectory = path.join(cwd, "data", "events", "2026-06-15");
    const eventFiles = (await readdir(eventDirectory)).filter((file) => file.endsWith(".json"));
    const event = JSON.parse(await readFile(path.join(eventDirectory, eventFiles[0]), "utf8"));
    assert.deepEqual(event.analysis.summary, ["AI 归纳：生成日报骨架。"]);
    assert.deepEqual(requests[0].body.model, "gpt-5.5");
    assert.equal(requests[0].url, "https://ops-ai-gateway.yc345.tv/v1/responses");
    assert.equal(typeof requests[0].body.input, "string");

    const journal = await readFile(path.join(cwd, "journals", "daily", "2026-06-15.md"), "utf8");
    assert.match(journal, /AI 归纳：生成日报骨架/);
  } finally {
    fetchMock.mock.restore();
    process.chdir(previousCwd);
  }
});

test("status shows journal and Git sync state", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "englog-status-"));
  runCommand("git", ["init"], cwd);
  runCommand("git", ["config", "user.name", "Test Engineer"], cwd);
  runCommand("git", ["config", "user.email", "test@example.com"], cwd);
  runCli(["init"], cwd);
  runCli(["daily", "--date", "2026-06-15", "--no-git"], cwd);

  const output = runCli(["status", "--date", "2026-06-15"], cwd);

  assert.match(output, /date: 2026-06-15/);
  assert.match(output, /events: 1/);
  assert.match(output, /daily journal: yes/);
  assert.match(output, /manual markers: ok/);
  assert.match(output, /worktree: dirty/);
  assert.match(output, /unpushed commits: unknown \(no upstream\)/);
  assert.match(output, /next action: review and commit or stash local changes/);
});

test("daily --sync commits and pushes generated journal files", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "englog-sync-work-"));
  const remote = await mkdtemp(path.join(os.tmpdir(), "englog-sync-remote-"));

  runCommand("git", ["init", "--bare"], remote);
  runCommand("git", ["init"], cwd);
  runCommand("git", ["config", "user.name", "Test Engineer"], cwd);
  runCommand("git", ["config", "user.email", "test@example.com"], cwd);
  runCli(["init"], cwd);
  runCommand("git", ["add", "."], cwd);
  runCommand("git", ["commit", "-m", "Initialize journal"], cwd, {
    GIT_AUTHOR_DATE: "2026-06-14T10:00:00+08:00",
    GIT_COMMITTER_DATE: "2026-06-14T10:00:00+08:00"
  });
  runCommand("git", ["remote", "add", "origin", remote], cwd);
  runCommand("git", ["push", "-u", "origin", "HEAD"], cwd);

  await writeFile(path.join(cwd, "feature.ts"), "export const synced = true;\n", "utf8");
  runCommand("git", ["add", "feature.ts"], cwd);
  runCommand("git", ["commit", "-m", "Add synced feature"], cwd, {
    GIT_AUTHOR_DATE: "2026-06-15T10:00:00+08:00",
    GIT_COMMITTER_DATE: "2026-06-15T10:00:00+08:00"
  });

  const output = runCli(["daily", "--date", "2026-06-15", "--sync"], cwd);

  assert.match(output, /commit: created/);
  assert.match(output, /push: done/);
  assert.equal(runCommand("git", ["status", "--porcelain"], cwd), "");
  assert.equal(runCommand("git", ["rev-list", "--count", "@{u}..HEAD"], cwd).trim(), "0");

  const journal = await readFile(path.join(cwd, "journals", "daily", "2026-06-15.md"), "utf8");
  assert.match(journal, /Add synced feature/);
  assert.match(journal, /feature\.ts/);
});

test("daily --sync refuses to mix with uncommitted worktree changes", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "englog-sync-dirty-"));
  runCommand("git", ["init"], cwd);
  runCommand("git", ["config", "user.name", "Test Engineer"], cwd);
  runCommand("git", ["config", "user.email", "test@example.com"], cwd);
  runCli(["init"], cwd);
  runCommand("git", ["add", "."], cwd);
  runCommand("git", ["commit", "-m", "Initialize journal"], cwd);

  await writeFile(path.join(cwd, "notes.md"), "uncommitted note\n", "utf8");

  const result = spawnSync(process.execPath, [cliPath, "daily", "--date", "2026-06-15", "--sync"], {
    cwd,
    encoding: "utf8"
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot sync because the journal repository has uncommitted changes/);
  assert.match(result.stderr, /notes\.md/);
  assert.match(result.stderr, /Commit, stash, or discard those changes/);
});

test("weekly summary uses daily journals, reports missing days, and preserves manual text", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "englog-weekly-"));
  runCli(["init"], cwd);
  runCli(["daily", "--date", "2026-06-15", "--no-git"], cwd);

  const output = runCli(["weekly", "--week", "2026-W25"], cwd);
  assert.match(output, /journals\/weekly\/2026-W25\.md/);

  const weeklyPath = path.join(cwd, "journals", "weekly", "2026-W25.md");
  const firstWeekly = await readFile(weeklyPath, "utf8");
  assert.match(firstWeekly, /# Weekly Engineering Journal 2026-W25/);
  assert.match(firstWeekly, /## 本周完成/);
  assert.match(firstWeekly, /2026-06-15/);
  assert.match(firstWeekly, /缺失来源：2026-06-16, 2026-06-17, 2026-06-18, 2026-06-19, 2026-06-20, 2026-06-21/);
  assert.match(firstWeekly, /run englog daily for the missing dates first/);

  const editedWeekly = firstWeekly.replace("## 人工记录\n", "## 人工记录\n\n保留本周复盘。\n");
  await writeFile(weeklyPath, editedWeekly, "utf8");
  runCli(["render", "weekly", "--week", "2026-W25"], cwd);

  const renderedAgain = await readFile(weeklyPath, "utf8");
  assert.match(renderedAgain, /保留本周复盘/);
});

test("monthly summary is generated from weekly summaries", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "englog-monthly-"));
  runCli(["init"], cwd);
  runCli(["daily", "--date", "2026-06-15", "--no-git"], cwd);
  runCli(["weekly", "--week", "2026-W25"], cwd);
  runCli(["monthly", "--month", "2026-06"], cwd);

  const monthly = await readFile(path.join(cwd, "journals", "monthly", "2026-06.md"), "utf8");
  assert.match(monthly, /# Monthly Engineering Journal 2026-06/);
  assert.match(monthly, /## 阶段完成/);
  assert.match(monthly, /2026-W25/);
  assert.match(monthly, /run englog weekly for the missing weeks first/);
});

function runCli(args, cwd) {
  return runCommand(process.execPath, [cliPath, ...args], cwd);
}

function runCommand(command, args, cwd, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      ...env
    },
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

async function assertFileExists(filePath) {
  await access(filePath);
}
