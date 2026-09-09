import { pesquisarPrecos } from "./fetch-prices.js";

const STORAGE_KEY = "precodoboi:prices";
const MS_24H = 24 * 60 * 60 * 1000;

const el = {
  status: document.getElementById("status-atualizacao"),
  btn: document.getElementById("btn-atualizar"),
  msg: document.getElementById("msg-atualizando"),
  mediaArroba: document.getElementById("media-arroba"),
  fonte: document.getElementById("fonte"),
  lista: document.getElementById("lista-estados"),
  filtro: document.getElementById("filtro"),
  noticiasGrid: document.getElementById("noticias-grid"),
  noticiasFonte: document.getElementById("noticias-fonte"),
};

let dadosAtuais = null;

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

function renderPrecos(dados) {
  dadosAtuais = dados;

  el.mediaArroba.textContent = formatMoney(dados.media_nacional.preco_arroba);

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
  if (!payload?.noticias?.length) {
    el.noticiasGrid.innerHTML =
      `<p class="meta">Nenhuma notícia disponível no momento.</p>`;
    return;
  }

  const quando = parseData(payload.atualizado_em);
  el.noticiasFonte.textContent = quando
    ? `${payload.fonte} · ${dataHora.format(quando)}`
    : payload.fonte || "";

  el.noticiasGrid.innerHTML = payload.noticias
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
  const [precosLocal, precosArquivo, noticias] = await Promise.all([
    Promise.resolve(lerLocal()),
    carregarJson("data/prices.json").catch((err) => {
      console.warn(err);
      return null;
    }),
    carregarJson("data/noticias.json").catch((err) => {
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
