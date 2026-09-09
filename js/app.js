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

function render(dados) {
  dadosAtuais = dados;

  el.mediaArroba.textContent = formatMoney(dados.media_nacional.preco_arroba);

  const quando = parseData(dados.atualizado_em);
  el.status.textContent = quando
    ? `Última atualização: ${dataHora.format(quando)}`
    : "Sem data de atualização";

  el.fonte.textContent = [
    dados.fonte,
    ...(dados.notas || []),
  ]
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
          : `<span class="badge badge-estimado">estimado</span>`;
      return `<tr>
        <td>${e.nome}</td>
        <td>${e.uf}</td>
        <td class="num">${formatMoney(e.preco_arroba)}</td>
        <td>${badge}</td>
      </tr>`;
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

async function carregarJsonArquivo() {
  const res = await fetch(`data/prices.json?t=${Date.now()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Não foi possível ler data/prices.json");
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
  const local = lerLocal();
  let arquivo = null;
  try {
    arquivo = await carregarJsonArquivo();
  } catch (err) {
    console.warn(err);
  }

  const dados = escolherMaisRecente(local, arquivo);
  if (!dados) {
    el.status.textContent = "Nenhum dado encontrado. Atualize para pesquisar.";
    el.btn.hidden = false;
    return;
  }
  render(dados);
}

async function atualizarEmBackground() {
  el.btn.disabled = true;
  el.btn.hidden = true;
  el.msg.hidden = false;

  try {
    const dados = await pesquisarPrecos();
    salvarLocal(dados);
    render(dados);
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
