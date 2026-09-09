/**
 * Extrai histórico mensal da arroba (CEPEA/ESALQ) a partir da
 * página pública do indicador do boi gordo.
 */

const CEPEA_BOI_URL = "https://www.cepea.org.br/br/indicador/boi-gordo.aspx";

const MESES = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

const UA = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

function parseMesLabel(label) {
  // "Setembro/26" | "Março/25"
  const original = String(label).trim();
  const m = original
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .match(/^([a-z]+)\/(\d{2})$/i);
  if (!m) return null;
  const mes = MESES[m[1].toLowerCase()];
  if (!mes) return null;
  const ano = 2000 + Number(m[2]);
  return {
    ano,
    mes,
    competencia: `${ano}-${String(mes).padStart(2, "0")}`,
    label: original,
  };
}

function extractFirstMatch(html, re) {
  const m = html.match(re);
  if (!m) return null;
  try {
    return JSON.parse(m[1].replace(/'/g, '"'));
  } catch {
    return null;
  }
}

/**
 * @param {number} [meses=12]
 */
export async function pesquisarHistorico(meses = 12) {
  const res = await fetch(CEPEA_BOI_URL, { headers: UA });
  if (!res.ok) throw new Error(`Falha ao buscar CEPEA (${res.status})`);
  const html = await res.text();

  // Labels mensais (canvas_data[1]) e valores (primeiro valor_array[1] = à vista)
  const labels = extractFirstMatch(
    html,
    /canvas_data\[1\]\s*=\s*(\[[^\]]+\])/,
  );
  const valoresMatch = html.match(/valor_array\[1\]\s*=\s*(\[[^\]]+\])/);
  if (!labels?.length || !valoresMatch) {
    throw new Error("Série mensal CEPEA não encontrada na página");
  }

  let valores;
  try {
    valores = JSON.parse(valoresMatch[1]);
  } catch {
    throw new Error("Não foi possível ler valores mensais do CEPEA");
  }

  const n = Math.min(labels.length, valores.length, meses);
  const pontos = [];

  for (let i = 0; i < n; i++) {
    const meta = parseMesLabel(labels[i]);
    const preco = Number(valores[i]);
    if (!meta || !Number.isFinite(preco)) continue;
    pontos.push({
      competencia: meta.competencia,
      label: meta.label,
      preco_arroba: Math.round(preco * 100) / 100,
    });
  }

  // Cronológico (antigo → recente) para gráfico
  pontos.sort((a, b) => a.competencia.localeCompare(b.competencia));

  const precos = pontos.map((p) => p.preco_arroba);
  const min = Math.min(...precos);
  const max = Math.max(...precos);
  const ultimo = pontos[pontos.length - 1];
  const primeiro = pontos[0];
  const variacao =
    primeiro && ultimo
      ? Math.round(((ultimo.preco_arroba / primeiro.preco_arroba - 1) * 10000)) /
        100
      : null;

  return {
    atualizado_em: new Date().toISOString(),
    fonte: "CEPEA/ESALQ · Indicador do boi gordo (média mensal à vista)",
    feed: CEPEA_BOI_URL,
    periodo_meses: pontos.length,
    resumo: {
      minimo: min,
      maximo: max,
      variacao_periodo_pct: variacao,
    },
    serie: pontos,
  };
}
