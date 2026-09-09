import { pesquisarPrecos } from "./fetch-prices.js";

const STORAGE_KEY = "precodoboi:prices";
const MS_24H = 24 * 60 * 60 * 1000;

const el = {
  status: document.getElementById("status-atualizacao"),
  btn: document.getElementById("btn-atualizar"),
  msg: document.getElementById("msg-atualizando"),
  pracaLabel: document.getElementById("praca-label"),
  pracaPreco: document.getElementById("praca-preco"),
  fonte: document.getElementById("fonte"),
  lista: document.getElementById("lista-estados"),
  filtro: document.getElementById("filtro"),
  noticiasGrid: document.getElementById("noticias-grid"),
  noticiasFonte: document.getElementById("noticias-fonte"),
  embrapaLista: document.getElementById("embrapa-lista"),
  embrapaFonte: document.getElementById("embrapa-fonte"),
  historicoFonte: document.getElementById("historico-fonte"),
  historicoResumo: document.getElementById("historico-resumo"),
  historicoChart: document.getElementById("historico-chart"),
  historicoLista: document.getElementById("historico-lista"),
  histMin: document.getElementById("hist-min"),
  histMax: document.getElementById("hist-max"),
  histVar: document.getElementById("hist-var"),
};

let dadosAtuais = null;
let pracasRotacao = [];
let pracaTimer = null;
let pracaIndex = -1;

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const dataCurta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function parseData(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function forcarStale() {
  return new URLSearchParams(location.search).has("stale");
}

function estaDesatualizado(iso) {
  if (forcarStale()) return true;
  const d = parseData(iso);
  if (!d) return true;
  return Date.now() - d.getTime() > MS_24H;
}

function formatMoney(n) {
  return brl.format(n);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mostrarPraca(item) {
  if (!item || !el.pracaLabel || !el.pracaPreco) return;
  el.pracaLabel.textContent = item.nome || item.praca || item.uf || "Praça";
  el.pracaPreco.textContent = formatMoney(item.preco_arroba);
  el.pracaPreco.classList.remove("is-switching");
  // force reflow for animation restart
  void el.pracaPreco.offsetWidth;
  el.pracaLabel.classList.remove("is-switching");
  void el.pracaLabel.offsetWidth;
  el.pracaLabel.classList.add("is-switching");
  el.pracaPreco.classList.add("is-switching");
}

function iniciarRotacaoPracas(estados) {
  const pracas = (estados || []).filter((e) => e.origem === "api");
  if (pracaTimer) {
    clearInterval(pracaTimer);
    pracaTimer = null;
  }

  if (!pracas.length) {
    pracasRotacao = [];
    pracaIndex = -1;
    if (el.pracaLabel) el.pracaLabel.textContent = "Praça";
    if (el.pracaPreco) el.pracaPreco.textContent = "—";
    return;
  }

  pracasRotacao = shuffle(pracas);
  pracaIndex = 0;
  mostrarPraca(pracasRotacao[pracaIndex]);

  if (pracasRotacao.length < 2) return;

  pracaTimer = setInterval(() => {
    pracaIndex = (pracaIndex + 1) % pracasRotacao.length;
    // reshuffle when cycle completes so order keeps changing
    if (pracaIndex === 0) {
      pracasRotacao = shuffle(pracasRotacao);
    }
    mostrarPraca(pracasRotacao[pracaIndex]);
  }, 3000);
}

function renderPrecos(dados) {
  dadosAtuais = dados;

  iniciarRotacaoPracas(dados.estados);

  const quando = parseData(dados.atualizado_em);
  el.status.textContent = quando
    ? `Cotações: ${dataHora.format(quando)}`
    : "Sem data de atualização";

  el.fonte.textContent = [dados.fonte, ...(dados.notas || [])]
    .filter(Boolean)
    .join(" · ");

  const stale = estaDesatualizado(dados.atualizado_em);
  el.btn.hidden = !stale || el.btn.disabled;

  pintarLista(el.filtro.value);
}

function pintarLista(filtro = "") {
  if (!dadosAtuais) return;

  const q = filtro.trim().toLowerCase();
  const rows = dadosAtuais.estados
    .filter((e) => {
      if (!q) return true;
      return (
        e.nome.toLowerCase().includes(q) ||
        e.uf.toLowerCase().includes(q) ||
        e.regiao.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.preco_arroba - a.preco_arroba);

  el.lista.innerHTML = rows
    .map((e) => {
      const badge =
        e.origem === "api"
          ? `<span class="badge badge-api">praça</span>`
          : `<span class="badge badge-estimado">est.</span>`;
      return `<tr>
        <td>${e.nome} <small>${e.uf}</small></td>
        <td class="num">${formatMoney(e.preco_arroba)}</td>
        <td>${badge}</td>
      </tr>`;
    })
    .join("");
}

function renderNoticias(payload) {
  const canal = payload?.canal_rural?.noticias?.length
    ? payload.canal_rural
    : payload?.noticias?.length
      ? { fonte: payload.fonte, noticias: payload.noticias }
      : null;

  if (!canal?.noticias?.length) {
    el.noticiasGrid.innerHTML =
      `<p class="meta">Nenhuma notícia disponível no momento.</p>`;
  } else {
    const quando = parseData(payload.atualizado_em);
    el.noticiasFonte.textContent = quando
      ? `${canal.fonte} · cache ${dataHora.format(quando)}`
      : canal.fonte || "";

    el.noticiasGrid.innerHTML = canal.noticias
      .map((n, i) => {
        const destaque = i === 0 ? " noticia-destaque" : "";
        const media = n.image
          ? `<img class="noticia-media" src="${n.image}" alt="" loading="${i === 0 ? "eager" : "lazy"}" />`
          : `<div class="noticia-media" role="presentation"></div>`;
        const quandoN = parseData(n.publishedAt);
        const tempo = quandoN
          ? `<time datetime="${n.publishedAt}">${dataCurta.format(quandoN)}</time>`
          : "";
        const resumo =
          i === 0 && n.summary
            ? `<p>${n.summary}${n.summary.length >= 220 ? "…" : ""}</p>`
            : "";

        return `<a class="noticia${destaque}" href="${n.link}" target="_blank" rel="noopener noreferrer">
        ${media}
        <p class="noticia-kicker">${n.fonte || "Pecuária"}</p>
        <h3>${n.title}</h3>
        ${resumo}
        ${tempo}
      </a>`;
      })
      .join("");
  }

  renderEmbrapa(payload);
}

function renderEmbrapa(payload) {
  const bloco = payload?.embrapa;
  const lista = bloco?.noticias || [];

  if (!lista.length) {
    el.embrapaLista.innerHTML =
      `<p class="meta">Nenhuma notícia da Embrapa no cache.</p>`;
    el.embrapaFonte.textContent = "";
    return;
  }

  const quando = parseData(payload.atualizado_em);
  el.embrapaFonte.textContent = quando
    ? `${bloco.fonte} · cache ${dataHora.format(quando)}`
    : bloco.fonte || "";

  el.embrapaLista.innerHTML = lista
    .map((n, i) => {
      const media = n.image
        ? `<img class="noticia-media" src="${n.image}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
        : `<div class="noticia-media" role="presentation"></div>`;
      const quandoN = parseData(n.publishedAt);
      const tempo = quandoN
        ? `<time datetime="${n.publishedAt}">${dataCurta.format(quandoN)}</time>`
        : "";
      const tags = n.summary ? `<p>${n.summary}</p>` : "";

      return `<a class="noticia embrapa-tile" href="${n.link}" target="_blank" rel="noopener noreferrer">
        ${media}
        <p class="noticia-kicker">${n.fonte || "Embrapa"}</p>
        <h3>${n.title}</h3>
        ${tags}
        ${tempo}
      </a>`;
    })
    .join("");
}

function renderHistorico(payload) {
  const serie = payload?.serie || [];
  if (!serie.length) {
    el.historicoChart.innerHTML =
      `<p class="meta">Histórico indisponível no momento.</p>`;
    el.historicoLista.innerHTML = "";
    el.historicoResumo.hidden = true;
    return;
  }

  const quando = parseData(payload.atualizado_em);
  el.historicoFonte.textContent = quando
    ? `${payload.fonte} · cache ${dataHora.format(quando)}`
    : payload.fonte || "";

  const resumo = payload.resumo || {};
  el.historicoResumo.hidden = false;
  el.histMin.textContent = formatMoney(resumo.minimo ?? Math.min(...serie.map((s) => s.preco_arroba)));
  el.histMax.textContent = formatMoney(resumo.maximo ?? Math.max(...serie.map((s) => s.preco_arroba)));

  const variacao = resumo.variacao_periodo_pct;
  if (variacao == null || Number.isNaN(variacao)) {
    el.histVar.textContent = "—";
    el.histVar.className = "";
  } else {
    const sinal = variacao > 0 ? "+" : "";
    el.histVar.textContent = `${sinal}${variacao.toLocaleString("pt-BR")}%`;
    el.histVar.className = variacao >= 0 ? "alta" : "baixa";
  }

  el.historicoChart.innerHTML = montarSvgHistorico(serie);
  el.historicoLista.innerHTML = [...serie]
    .reverse()
    .map(
      (p) => `<tr>
        <td>${p.label}</td>
        <td class="num">${formatMoney(p.preco_arroba)}</td>
      </tr>`,
    )
    .join("");
}

function montarSvgHistorico(serie) {
  const w = 720;
  const h = 260;
  const pad = { t: 18, r: 16, b: 42, l: 52 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const vals = serie.map((s) => s.preco_arroba);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const yMin = min - span * 0.08;
  const yMax = max + span * 0.08;

  const xAt = (i) =>
    pad.l + (serie.length === 1 ? iw / 2 : (i / (serie.length - 1)) * iw);
  const yAt = (v) => pad.t + ((yMax - v) / (yMax - yMin)) * ih;

  const points = serie.map((s, i) => `${xAt(i)},${yAt(s.preco_arroba)}`);
  const line = points.join(" ");
  const area = `${pad.l},${pad.t + ih} ${line} ${xAt(serie.length - 1)},${pad.t + ih}`;

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const yLabels = yTicks
    .map((v) => {
      const y = yAt(v);
      return `<text class="label-y" x="${pad.l - 8}" y="${y + 4}" text-anchor="end">${formatMoney(v)}</text>
        <line class="axis" x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" />`;
    })
    .join("");

  const xLabels = serie
    .map((s, i) => {
      if (serie.length > 8 && i % 2 !== 0 && i !== serie.length - 1) return "";
      return `<text class="label-x" x="${xAt(i)}" y="${h - 12}" text-anchor="middle">${s.label}</text>`;
    })
    .join("");

  const dots = serie
    .map(
      (s, i) =>
        `<circle class="dot" cx="${xAt(i)}" cy="${yAt(s.preco_arroba)}" r="3.5">
          <title>${s.label}: ${formatMoney(s.preco_arroba)}</title>
        </circle>`,
    )
    .join("");

  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Gráfico da média mensal da arroba nos últimos 12 meses">
    ${yLabels}
    <polygon class="area" points="${area}" />
    <polyline class="line" points="${line}" />
    ${dots}
    ${xLabels}
  </svg>`;
}

function lerLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function salvarLocal(dados) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
}

async function carregarJson(path) {
  const res = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Falha ao ler ${path}`);
  return res.json();
}

function escolherMaisRecente(a, b) {
  if (!a) return b;
  if (!b) return a;
  const ta = parseData(a.atualizado_em)?.getTime() ?? 0;
  const tb = parseData(b.atualizado_em)?.getTime() ?? 0;
  return tb >= ta ? b : a;
}

async function carregarInicial() {
  const [precosLocal, precosArquivo, noticias, historico] = await Promise.all([
    Promise.resolve(lerLocal()),
    carregarJson("data/prices.json").catch((err) => {
      console.warn(err);
      return null;
    }),
    carregarJson("data/noticias.json").catch((err) => {
      console.warn(err);
      return null;
    }),
    carregarJson("data/historico.json").catch((err) => {
      console.warn(err);
      return null;
    }),
  ]);

  const dados = escolherMaisRecente(precosLocal, precosArquivo);
  if (!dados) {
    el.status.textContent = "Nenhum dado encontrado. Atualize para pesquisar.";
    el.btn.hidden = false;
  } else {
    renderPrecos(dados);
  }

  renderNoticias(noticias);
  renderHistorico(historico);
}

async function atualizarEmBackground() {
  el.btn.disabled = true;
  el.btn.hidden = true;
  el.msg.hidden = false;

  try {
    const dados = await pesquisarPrecos();
    salvarLocal(dados);
    renderPrecos(dados);
  } catch (err) {
    console.error(err);
    el.status.textContent =
      "Falha ao atualizar. Tente de novo em alguns minutos.";
    if (dadosAtuais && estaDesatualizado(dadosAtuais.atualizado_em)) {
      el.btn.hidden = false;
    }
  } finally {
    el.btn.disabled = false;
    el.msg.hidden = true;
    if (dadosAtuais && estaDesatualizado(dadosAtuais.atualizado_em)) {
      el.btn.hidden = false;
    }
  }
}

el.btn.addEventListener("click", () => {
  void atualizarEmBackground();
});

el.filtro.addEventListener("input", () => {
  pintarLista(el.filtro.value);
});

void carregarInicial();
