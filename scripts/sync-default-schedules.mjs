import { cpSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";

const sourceDir = resolve(process.cwd(), "schedules/defaults");
const targetDir = resolve(process.cwd(), "public/schedules/defaults");

mkdirSync(targetDir, { recursive: true });

const sourceFiles = readdirSync(sourceDir).filter((name) => name.endsWith(".json"));
const sourceSet = new Set(sourceFiles);

for (const name of sourceFiles) {
  cpSync(join(sourceDir, name), join(targetDir, name));
}

for (const name of readdirSync(targetDir)) {
  if (!name.endsWith(".json")) continue;
  if (!sourceSet.has(name)) unlinkSync(join(targetDir, name));
}
