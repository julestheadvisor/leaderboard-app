import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";
import { setTimeout as wait } from "node:timers/promises";

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const host = readArg("--host", "127.0.0.1");
const port = Number(readArg("--port", process.env.PORT ?? "3000"));
const intervalMs = Number(readArg("--interval", "1000"));
const closedChecks = Number(readArg("--closed-checks", "2"));

if (!Number.isInteger(port) || port <= 0) {
  console.error("Port must be a positive integer.");
  process.exit(1);
}

function canConnect() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    function settle(result) {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(result);
    }

    socket.setTimeout(750);
    socket.once("connect", () => settle(true));
    socket.once("timeout", () => settle(false));
    socket.once("error", () => settle(false));
    socket.connect(port, host);
  });
}

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

console.log(`Watching ${host}:${port}. Cleanup will run after the port opens and later closes.`);

while (!(await canConnect())) {
  await wait(intervalMs);
}

console.log(`${host}:${port} is open. Waiting for it to close.`);

let consecutiveClosed = 0;
while (consecutiveClosed < closedChecks) {
  if (await canConnect()) {
    consecutiveClosed = 0;
  } else {
    consecutiveClosed += 1;
  }

  if (consecutiveClosed < closedChecks) {
    await wait(intervalMs);
  }
}

console.log(`${host}:${port} is closed. Running generated-file cleanup.`);
const exitCode = await run(process.execPath, ["scripts/clean-generated.mjs"]);
process.exit(exitCode);
