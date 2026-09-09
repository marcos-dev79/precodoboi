#!/usr/bin/env node
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  pesquisarHistorico,
  mesclarMesCorrente,
} from "../js/fetch-historico.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "data", "historico.json");
const pricesPath = join(root, "data", "prices.json");

async function existe(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function salvar(data) {
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`Salvo em ${out} (${data.serie.length} meses)`);
  for (const p of data.serie) {
    console.log(`  ${p.competencia}  R$ ${p.preco_arroba}`);
  }
}

async function fallbackLocal(motivo) {
  console.warn(`Aviso: ${motivo}`);

  if (!(await existe(out))) {
    throw new Error(
      "Sem histórico local para fallback. Rode update:historico em um ambiente com acesso ao CEPEA.",
    );
  }

  const atual = JSON.parse(await readFile(out, "utf8"));
  let prices = null;
  if (await existe(pricesPath)) {
    prices = JSON.parse(await readFile(pricesPath, "utf8"));
  }

  const mesclado = mesclarMesCorrente(
    atual,
    prices?.referencia_cepea_sp ?? prices?.media_nacional?.preco_arroba,
  );

  if (mesclado) {
    console.warn(
      "Mantendo série anterior e atualizando o mês corrente via preços AgroDoc/CEPEA.",
    );
    await salvar(mesclado);
    return;
  }

  console.warn("Mantendo historico.json anterior sem alterações.");
}

async function main() {
  console.log("Buscando histórico CEPEA (12 meses)...");
  try {
    const data = await pesquisarHistorico(12);
    await salvar(data);
  } catch (err) {
    await fallbackLocal(err.message || String(err));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
