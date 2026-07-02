import { spawn } from "node:child_process";
import process from "node:process";

let shuttingDown = false;

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: options.stdio ?? "inherit",
      windowsHide: true,
    });

    child.on("close", (code) => resolve(code ?? 0));
  });
}

async function cleanIgnoredFiles() {
  const code = await run(process.execPath, ["scripts/clean-generated.mjs"]);
  if (code !== 0) {
    console.error("Cleanup failed. Run `npm run clean:generated:dry` to inspect what remains.");
    process.exitCode = code;
  }
}

const next = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", ...process.argv.slice(2)],
  {
    shell: false,
    stdio: "inherit",
    windowsHide: true,
  },
);

function stopNext() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  if (!next.killed) {
    next.kill("SIGINT");
  }
}

process.on("SIGINT", stopNext);
process.on("SIGTERM", stopNext);

next.on("close", async (code) => {
  await cleanIgnoredFiles();
  process.exit(code ?? 0);
});
