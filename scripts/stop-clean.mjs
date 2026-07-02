import { spawn } from "node:child_process";
import process from "node:process";

const portArgIndex = process.argv.indexOf("--port");
const port =
  portArgIndex >= 0 && process.argv[portArgIndex + 1]
    ? Number(process.argv[portArgIndex + 1])
    : 3000;

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: "inherit",
      windowsHide: true,
    });

    child.on("close", (code) => resolve(code ?? 0));
  });
}

async function stopWindowsPort() {
  const command = [
    "$owners = @(Get-NetTCPConnection",
    `-LocalPort ${port}`,
    "-ErrorAction SilentlyContinue",
    "| Select-Object -ExpandProperty OwningProcess -Unique);",
    "foreach ($owner in $owners) {",
    "if ($owner) { Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue }",
    "}",
  ].join(" ");

  return run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command]);
}

async function stopUnixPort() {
  const command = `command -v lsof >/dev/null 2>&1 && lsof -ti tcp:${port} | xargs -r kill`;
  return run("sh", ["-c", command]);
}

if (!Number.isInteger(port) || port <= 0) {
  console.error("Port must be a positive integer.");
  process.exit(1);
}

console.log(`Stopping any dev server on port ${port}.`);
const stopCode = process.platform === "win32" ? await stopWindowsPort() : await stopUnixPort();

if (stopCode !== 0) {
  console.warn("Port stop command reported a non-zero exit. Cleanup will still run.");
}

await new Promise((resolve) => setTimeout(resolve, 500));
await run(process.execPath, ["scripts/clean-generated.mjs"]);
