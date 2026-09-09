#!/usr/bin/env node
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pesquisarPrecos } from "../js/fetch-prices.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "data", "prices.json");

async function main() {
  console.log("Pesquisando preços por estado...");
  const data = await pesquisarPrecos((done, total) => {
    process.stdout.write(`\r  praças: ${done}/${total}`);
  });
  console.log("\n");

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(data, null, 2) + "\n", "utf8");

  console.log(`Salvo em ${out}`);
  console.log(
    `Média nacional: R$ ${data.media_nacional.preco_arroba}/@`,
  );
  console.log(`Atualizado em: ${data.atualizado_em}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
