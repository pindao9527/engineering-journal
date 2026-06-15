import { readFile } from "node:fs/promises";
import path from "node:path";

export async function readTemplate(root: string, fileName: string): Promise<string | undefined> {
  try {
    return await readFile(path.join(root, "templates", fileName), "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
