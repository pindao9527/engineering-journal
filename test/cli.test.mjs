import assert from "node:assert/strict";
import { access, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createProgram } from "../dist/cli.js";

const cliPath = path.resolve("dist", "cli.js");

test("creates the englog CLI program", () => {
  const program = createProgram();

  assert.equal(program.name(), "englog");
  assert.match(program.helpInformation(), /daily/);
  assert.match(program.helpInformation(), /render/);
});

test("initializes journal structure without overwriting templates", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "englog-init-"));
  runCli(["init"], cwd);

  await assertFileExists(path.join(cwd, "englog.config.json"));
  await assertFileExists(path.join(cwd, "templates", "daily.md"));
  await assertFileExists(path.join(cwd, "journals", "daily"));

  const dailyTemplate = path.join(cwd, "templates", "daily.md");
  await writeFile(dailyTemplate, "custom template\n", "utf8");
  runCli(["init"], cwd);

  assert.equal(await readFile(dailyTemplate, "utf8"), "custom template\n");
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
