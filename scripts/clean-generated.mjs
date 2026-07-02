import { spawn } from "node:child_process";
import process from "node:process";

const dryRun = process.argv.includes("--dry-run");
const mode = dryRun ? "-ndX" : "-fdX";

console.log(`${dryRun ? "Previewing" : "Removing"} ignored generated files with git clean ${mode} .`);

const clean = spawn("git", ["clean", mode, "."], {
  shell: false,
  stdio: "inherit",
  windowsHide: true,
});

clean.on("close", (code) => {
  process.exit(code ?? 0);
});
