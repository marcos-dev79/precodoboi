#!/usr/bin/env node
import { writeFile, mkdir, readFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pesquisarBezerros } from "../js/fetch-bezerros.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "data", "bezerros.json");
const pricesPath = join(root, "data", "prices.json");

async function main() {
  console.log("Pesquisando preço do bezerro...");

  let referencia;
  try {
    await access(pricesPath);
    const prices = JSON.parse(await readFile(pricesPath, "utf8"));
    referencia = prices.referencia_cepea_sp;
  } catch {
    /* opcional */
  }

  const data = await pesquisarBezerros({
    referencia_cepea_sp: referencia,
  });

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(data, null, 2) + "\n", "utf8");

  console.log(`Salvo em ${out}`);
  console.log(
    `Bezerro MS: R$ ${data.indicador.preco_cabeca}/cabeça`,
  );
  if (data.relacao_troca) {
    console.log(
      `Relação: 1 bezerro ≈ ${data.relacao_troca.arrobas_por_bezerro} @ · boi 20@ ≈ ${data.relacao_troca.bezerros_por_boi_20_arrobas} bezerros`,
    );
  }
  console.log(`Atualizado em: ${data.atualizado_em}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
