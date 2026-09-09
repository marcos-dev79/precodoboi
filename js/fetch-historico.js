/**
 * Extrai histórico mensal da arroba (CEPEA/ESALQ) a partir da
 * página pública do indicador do boi gordo.
 */

export const CEPEA_BOI_URL =
  "https://www.cepea.org.br/br/indicador/boi-gordo.aspx";

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

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: "https://www.cepea.org.br/",
  "Upgrade-Insecure-Requests": "1",
};

function parseMesLabel(label) {
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

function montarPayload(pontos, fonte = "CEPEA/ESALQ · Indicador do boi gordo (média mensal à vista)") {
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
    fonte,
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

function parseSerieFromHtml(html, meses) {
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

  if (!pontos.length) throw new Error("Nenhum ponto mensal válido no CEPEA");
  pontos.sort((a, b) => a.competencia.localeCompare(b.competencia));
  return pontos;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: HEADERS,
    redirect: "follow",
  });
  if (!res.ok) {
    const err = new Error(`Falha ao buscar CEPEA (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const html = await res.text();
  if (/just a moment|cf-browser-verification|access denied|403 forbidden/i.test(html) && !/valor_array\[1\]/.test(html)) {
    const err = new Error("CEPEA bloqueou o acesso (WAF/Cloudflare)");
    err.status = 403;
    throw err;
  }
  return html;
}

/**
 * @param {number} [meses=12]
 */
export async function pesquisarHistorico(meses = 12) {
  const urls = [
    CEPEA_BOI_URL,
    "https://www.cepea.org.br/br/indicador/series/boi-gordo.aspx?id=2",
  ];

  let lastErr;
  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      const pontos = parseSerieFromHtml(html, meses);
      return montarPayload(pontos);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Falha ao buscar histórico CEPEA");
}

/**
 * Atualiza o mês corrente no histórico existente com a referência CEPEA/SP
 * (útil quando o site do CEPEA bloqueia o runner).
 */
export function mesclarMesCorrente(historico, precoCepeaSp) {
  if (!historico?.serie?.length || !Number.isFinite(Number(precoCepeaSp))) {
    return null;
  }

  const agora = new Date();
  const competencia = `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, "0")}`;
  const nomes = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const label = `${nomes[agora.getUTCMonth()]}/${String(agora.getUTCFullYear()).slice(-2)}`;
  const preco = Math.round(Number(precoCepeaSp) * 100) / 100;

  const serie = [...historico.serie];
  const idx = serie.findIndex((p) => p.competencia === competencia);
  if (idx >= 0) {
    serie[idx] = { ...serie[idx], preco_arroba: preco, label };
  } else {
    serie.push({ competencia, label, preco_arroba: preco });
  }

  serie.sort((a, b) => a.competencia.localeCompare(b.competencia));
  const ultimos = serie.slice(-12);

  return montarPayload(
    ultimos,
    `${historico.fonte || "CEPEA/ESALQ"} · mês corrente via AgroDoc (fallback)`,
  );
}
