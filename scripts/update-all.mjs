#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, "scripts", script)], {
      stdio: "inherit",
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${script} saiu com ${code}`)),
    );
  });
}

await run("update-prices.mjs");
await run("update-bezerros.mjs");
await run("update-news.mjs");
await run("update-historico.mjs");
await run("update-seo.mjs");

