/**
 * Busca cotações do boi gordo (AgroDoc / CEPEA) e estima preços por UF.
 * Funciona no browser (CORS liberado) e no Node.
 */

export const ESTADOS = [
  { uf: "AC", nome: "Acre", regiao: "Norte" },
  { uf: "AL", nome: "Alagoas", regiao: "Nordeste" },
  { uf: "AP", nome: "Amapá", regiao: "Norte" },
  { uf: "AM", nome: "Amazonas", regiao: "Norte" },
  { uf: "BA", nome: "Bahia", regiao: "Nordeste" },
  { uf: "CE", nome: "Ceará", regiao: "Nordeste" },
  { uf: "DF", nome: "Distrito Federal", regiao: "Centro-Oeste" },
  { uf: "ES", nome: "Espírito Santo", regiao: "Sudeste" },
  { uf: "GO", nome: "Goiás", regiao: "Centro-Oeste" },
  { uf: "MA", nome: "Maranhão", regiao: "Nordeste" },
  { uf: "MT", nome: "Mato Grosso", regiao: "Centro-Oeste" },
  { uf: "MS", nome: "Mato Grosso do Sul", regiao: "Centro-Oeste" },
  { uf: "MG", nome: "Minas Gerais", regiao: "Sudeste" },
  { uf: "PA", nome: "Pará", regiao: "Norte" },
  { uf: "PB", nome: "Paraíba", regiao: "Nordeste" },
  { uf: "PR", nome: "Paraná", regiao: "Sul" },
  { uf: "PE", nome: "Pernambuco", regiao: "Nordeste" },
  { uf: "PI", nome: "Piauí", regiao: "Nordeste" },
  { uf: "RJ", nome: "Rio de Janeiro", regiao: "Sudeste" },
  { uf: "RN", nome: "Rio Grande do Norte", regiao: "Nordeste" },
  { uf: "RS", nome: "Rio Grande do Sul", regiao: "Sul" },
  { uf: "RO", nome: "Rondônia", regiao: "Norte" },
  { uf: "RR", nome: "Roraima", regiao: "Norte" },
  { uf: "SC", nome: "Santa Catarina", regiao: "Sul" },
  { uf: "SP", nome: "São Paulo", regiao: "Sudeste" },
  { uf: "SE", nome: "Sergipe", regiao: "Nordeste" },
  { uf: "TO", nome: "Tocantins", regiao: "Norte" },
];

/** UFs com praça física na AgroDoc (confirmadas). */
export const UFS_COM_PRACA = ["SP", "MS", "MT", "GO", "MG", "PR", "PA", "TO", "RO"];

/**
 * Fator vs CEPEA/SP para UFs sem praça na API.
 * Baseado em diferenciais típicos de mercado.
 */
const FATOR_ESTIMADO = {
  AC: 0.93,
  AL: 0.94,
  AP: 0.92,
  AM: 0.93,
  BA: 0.96,
  CE: 0.94,
  DF: 0.97,
  ES: 0.99,
  MA: 0.94,
  PB: 0.94,
  PE: 0.95,
  PI: 0.93,
  RJ: 1.01,
  RN: 0.94,
  RR: 0.91,
  RS: 0.98,
  SC: 0.99,
  SE: 0.94,
};

const API = "https://agrodocai.com.br/api/v1/cotacao";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function fetchCotacao(uf) {
  const url = uf ? `${API}?uf=${uf}` : API;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha na API (${res.status})`);
  return res.json();
}

/**
 * Pesquisa preços de todos os estados.
 * @param {(done: number, total: number) => void} [onProgress]
 */
export async function pesquisarPrecos(onProgress) {
  const base = await fetchCotacao();
  const cepeaSp = Number(base.boi_gordo_cepea_sp);
  if (!Number.isFinite(cepeaSp)) throw new Error("Cotação CEPEA inválida");

  const porUf = new Map();
  const total = UFS_COM_PRACA.length;
  let done = 0;

  for (const uf of UFS_COM_PRACA) {
    await sleep(350);
    const data = await fetchCotacao(uf);
    const fisica = data.boi_gordo_uf;
    if (fisica?.preco != null) {
      porUf.set(uf, {
        preco_arroba: Number(fisica.preco),
        praca: fisica.praca || uf,
        origem: "api",
      });
    }
    done += 1;
    onProgress?.(done, total);
  }

  const estados = ESTADOS.map((e) => {
    const api = porUf.get(e.uf);
    let precoArroba;
    let origem;
    let praca;

    if (api) {
      precoArroba = api.preco_arroba;
      origem = "api";
      praca = api.praca;
    } else {
      const fator = FATOR_ESTIMADO[e.uf] ?? 0.95;
      precoArroba = round2(cepeaSp * fator);
      origem = "estimado";
      praca = `estimativa regional (${e.regiao})`;
    }

    return {
      uf: e.uf,
      nome: e.nome,
      regiao: e.regiao,
      preco_arroba: precoArroba,
      origem,
      praca,
    };
  });

  const mediaArroba =
    estados.reduce((s, e) => s + e.preco_arroba, 0) / estados.length;

  return {
    atualizado_em: new Date().toISOString(),
    fonte: base.fonte || "CEPEA/ESALQ · AgroDoc AI",
    licenca: base.license || "CC-BY-4.0 · atribuição AgroDoc AI",
    referencia_cepea_sp: cepeaSp,
    media_nacional: {
      preco_arroba: round2(mediaArroba),
    },
    estados: estados.sort((a, b) => b.preco_arroba - a.preco_arroba),
    notas: [
      "Arroba: preço físico da praça quando disponível na AgroDoc; demais UFs estimadas por diferencial regional sobre CEPEA/SP.",
    ],
  };
}
