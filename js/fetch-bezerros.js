/**
 * Cotação do bezerro (Indicador CEPEA/ESALQ · MS) via AgroDoc.
 * Unidade: R$ por cabeça (não arroba).
 */

const API = "https://agrodocai.com.br/api/v1/cotacao";

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Pesquisa a cotação do bezerro e monta o payload do JSON.
 * Opcionalmente usa a referência do boi gordo já carregada para a relação de troca.
 * @param {{ referencia_cepea_sp?: number }} [opts]
 */
export async function pesquisarBezerros(opts = {}) {
  const res = await fetch(API);
  if (!res.ok) throw new Error(`Falha na API (${res.status})`);
  const base = await res.json();

  const preco = Number(base.bezerro_ms);
  if (!Number.isFinite(preco)) {
    throw new Error("Cotação do bezerro inválida");
  }

  const boiSp = Number(
    opts.referencia_cepea_sp ?? base.boi_gordo_cepea_sp,
  );
  let relacao = null;
  if (Number.isFinite(boiSp) && boiSp > 0) {
    const arrobasPorBezerro = round2(preco / boiSp);
    const bezerrosPorBoi20 = round2((boiSp * 20) / preco);
    relacao = {
      referencia_boi_gordo_sp: boiSp,
      arrobas_por_bezerro: arrobasPorBezerro,
      bezerros_por_boi_20_arrobas: bezerrosPorBoi20,
    };
  }

  return {
    atualizado_em: new Date().toISOString(),
    fonte: base.fonte || "CEPEA/ESALQ · AgroDoc AI",
    licenca: base.license || "CC-BY-4.0 · atribuição AgroDoc AI",
    indicador: {
      nome: "Indicador do Bezerro CEPEA/ESALQ",
      praca: "Mato Grosso do Sul",
      uf: "MS",
      preco_cabeca: round2(preco),
      unidade: "cabeça",
      origem: "api",
    },
    relacao_troca: relacao,
    notas: [
      "Valor por cabeça (descontado o prazo de pagamento), referência MS — não confundir com R$/@ do boi gordo.",
    ],
  };
}
