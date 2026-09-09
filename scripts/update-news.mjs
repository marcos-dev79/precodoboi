#!/usr/bin/env node
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pesquisarNoticias } from "../js/fetch-news.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "data", "noticias.json");

async function main() {
  console.log("Buscando notícias (Canal Rural + Embrapa)...");
  const data = await pesquisarNoticias(5);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(data, null, 2) + "\n", "utf8");

  console.log(`Salvo em ${out}`);
  console.log(`Canal Rural (${data.canal_rural.noticias.length}):`);
  for (const n of data.canal_rural.noticias) {
    console.log(`  · [${n.relevancia}] ${n.title}`);
  }
  console.log(`Embrapa (${data.embrapa.noticias.length}):`);
  for (const n of data.embrapa.noticias) {
    console.log(`  · ${n.title}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
