#!/usr/bin/env node
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pesquisarHistorico } from "../js/fetch-historico.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "data", "historico.json");

async function main() {
  console.log("Buscando histórico CEPEA (12 meses)...");
  const data = await pesquisarHistorico(12);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`Salvo em ${out} (${data.serie.length} meses)`);
  for (const p of data.serie) {
    console.log(`  ${p.competencia}  R$ ${p.preco_arroba}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
