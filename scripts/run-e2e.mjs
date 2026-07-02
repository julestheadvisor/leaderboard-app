import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";

const port = process.env.PORT ?? "3000";
const baseUrl = `http://localhost:${port}`;

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "localhost", "--port", port],
  {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port },
    stdio: "inherit",
    windowsHide: true,
  },
);

async function waitForServer() {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // The server is still booting.
    }

    await wait(500);
  }

  throw new Error(`Timed out waiting for ${baseUrl}`);
}

function runPlaywright() {
  return new Promise((resolve) => {
    const testProcess = spawn(
      process.execPath,
      ["node_modules/@playwright/test/cli.js", "test", "--reporter=list"],
      {
        cwd: process.cwd(),
        env: { ...process.env, PLAYWRIGHT_BASE_URL: baseUrl },
        stdio: "inherit",
        windowsHide: true,
      },
    );

    testProcess.on("exit", (code) => resolve(code ?? 1));
  });
}

function stopServer() {
  if (!server.pid || server.killed) {
    return Promise.resolve();
  }

  if (process.platform === "win32") {
    return new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });

      killer.on("exit", resolve);
    });
  }

  server.kill("SIGTERM");
  return Promise.resolve();
}

try {
  await waitForServer();
  const exitCode = await runPlaywright();
  await stopServer();
  process.exit(exitCode);
} catch (error) {
  console.error(error);
  await stopServer();
  process.exit(1);
}
