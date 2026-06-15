import assert from "node:assert/strict";
import test from "node:test";
import { createProgram } from "../dist/cli.js";

test("creates the englog CLI program", () => {
  const program = createProgram();

  assert.equal(program.name(), "englog");
  assert.match(program.helpInformation(), /daily/);
  assert.match(program.helpInformation(), /render/);
});
