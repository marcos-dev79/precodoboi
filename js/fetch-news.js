/**
 * Busca notícias de pecuária (Canal Rural RSS) e Embrapa,
 * ranqueia / seleciona top N e devolve JSON para cache local.
 *
 * Nota: https://www.embrapa.br/noticias-rss é uma página HTML com lista
 * de notícias (não XML RSS). Extraímos os itens dessa lista.
 */

const FEED_CANAL_RURAL = "https://www.canalrural.com.br/pecuaria/feed/";
const FEED_EMBRAPA = "https://www.embrapa.br/noticias-rss";

const KEYWORDS = [
  { re: /\bboi\s+gordo\b/i, w: 6 },
  { re: /\barroba\b/i, w: 6 },
  { re: /\bpecu[aá]ria\b/i, w: 5 },
  { re: /\bgado\b/i, w: 4 },
  { re: /\bbovin/i, w: 4 },
  { re: /\bbezerro\b/i, w: 3 },
  { re: /\bconfinamento\b/i, w: 3 },
  { re: /\bcarne\b/i, w: 3 },
  { re: /\bexporta/i, w: 2 },
  { re: /\bcota[cç][aã]o/i, w: 2 },
  { re: /\bmercado\b/i, w: 1 },
];

const UA = { "User-Agent": "PrecoDoBoi/1.0 (+https://github.com)" };

function stripHtml(html = "") {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractImage(html = "") {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1] || null;
}

function extractTag(block, tag) {
  const cdata = block.match(
    new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i"),
  );
  if (cdata) return cdata[1].trim();
  const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return plain ? plain[1].trim() : "";
}

function parseRssItems(xml, fonte) {
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  return blocks.map((block) => {
    const title = stripHtml(extractTag(block, "title"));
    const link = stripHtml(extractTag(block, "link"));
    const pubDate = extractTag(block, "pubDate");
    const descriptionRaw = extractTag(block, "description");
    const contentRaw = extractTag(block, "content:encoded") || descriptionRaw;
    const image =
      extractImage(contentRaw) || extractImage(descriptionRaw) || null;
    const summary = stripHtml(descriptionRaw).slice(0, 220);
    const publishedAt = pubDate ? new Date(pubDate).toISOString() : null;

    return { title, link, summary, image, publishedAt, fonte };
  });
}

function scoreItem(item) {
  const text = `${item.title} ${item.summary || ""}`;
  let score = 0;
  for (const { re, w } of KEYWORDS) {
    if (re.test(text)) score += w;
  }
  if (item.publishedAt) {
    const ageH = (Date.now() - new Date(item.publishedAt).getTime()) / 36e5;
    if (ageH <= 24) score += 3;
    else if (ageH <= 48) score += 1;
  }
  return score;
}

function rankTop(items, limite) {
  return items
    .filter((i) => i.title && i.link)
    .map((i) => ({ ...i, relevancia: scoreItem(i) }))
    .sort((a, b) => {
      if (b.relevancia !== a.relevancia) return b.relevancia - a.relevancia;
      const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return tb - ta;
    })
    .slice(0, limite);
}

function absolutizeEmbrapaUrl(src) {
  if (!src) return null;
  const clean = src.replace(/&amp;/g, "&").trim();
  if (clean.startsWith("//")) return `https:${clean}`;
  if (clean.startsWith("/")) return `https://www.embrapa.br${clean}`;
  return clean;
}

function parseEmbrapaHtml(html) {
  const parts = html.split('<li class="embp-latest-news_item">').slice(1);
  const items = [];

  for (const part of parts) {
    const block = part.slice(0, 8000);
    const dateM = block.match(/(\d{2}\/\d{2}\/\d{4})/);
    const linkM = block.match(
      /<a href="(\/busca-de-noticias\/[^"]+|\/noticias\/[^"]+)">\s*([\s\S]*?)\s*<\/a>/,
    );
    if (!linkM) continue;

    const title = stripHtml(linkM[2]);
    let link = linkM[1];
    if (link.startsWith("/")) link = `https://www.embrapa.br${link}`;

    let publishedAt = null;
    if (dateM) {
      const [dd, mm, yyyy] = dateM[1].split("/");
      publishedAt = new Date(`${yyyy}-${mm}-${dd}T12:00:00.000Z`).toISOString();
    }

    const tagsBlock = block.match(/<ul>\s*((?:<li>[\s\S]*?<\/li>\s*)+)<\/ul>/);
    const tags = tagsBlock
      ? [...tagsBlock[1].matchAll(/<li>\s*([^<]+?)\s*<\/li>/g)].map((m) =>
          stripHtml(m[1]),
        )
      : [];

    const imgM =
      block.match(
        /embp-latest-news_item-thumbnail[^>]*\ssrc=["']([^"']+)["']/i,
      ) ||
      block.match(
        /src=["']([^"']+)["'][^>]*embp-latest-news_item-thumbnail/i,
      ) ||
      block.match(
        /<img[^>]+class=["'][^"']*embp-latest-news_item-thumbnail[^"']*["'][^>]*>/i,
      );

    let image = null;
    if (imgM) {
      if (imgM[1]) {
        image = absolutizeEmbrapaUrl(imgM[1]);
      } else {
        const src = imgM[0].match(/src=["']([^"']+)["']/i);
        image = absolutizeEmbrapaUrl(src?.[1]);
      }
    }

    items.push({
      title,
      link,
      summary: tags.length ? tags.join(" · ") : "",
      image,
      publishedAt,
      fonte: "Embrapa",
      tags,
    });
  }

  return items;
}

async function enrichEmbrapaImage(item) {
  if (item.image) return item;
  try {
    const html = await fetchText(item.link);
    const og =
      html.match(
        /property=["']og:image["']\s+content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /content=["']([^"']+)["']\s+property=["']og:image["']/i,
      );
    const image = absolutizeEmbrapaUrl(og?.[1]);
    return image ? { ...item, image } : item;
  } catch {
    return item;
  }
}

async function fetchText(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`Falha ao buscar ${url} (${res.status})`);
  return res.text();
}

async function buscarCanalRural(limite) {
  const xml = await fetchText(FEED_CANAL_RURAL);
  const items = rankTop(parseRssItems(xml, "Canal Rural"), limite);
  return {
    fonte: "Canal Rural · RSS pecuária",
    feed: FEED_CANAL_RURAL,
    noticias: items,
  };
}

async function buscarEmbrapa(limite) {
  const html = await fetchText(FEED_EMBRAPA);
  const base = parseEmbrapaHtml(html)
    .filter((i) => i.title && i.link)
    .slice(0, limite);

  const items = [];
  for (const item of base) {
    const enriched = await enrichEmbrapaImage(item);
    items.push({ ...enriched, relevancia: scoreItem(enriched) });
  }

  return {
    fonte: "Embrapa · notícias",
    feed: FEED_EMBRAPA,
    noticias: items,
  };
}

/**
 * Pesquisa notícias das duas fontes e monta o payload do JSON.
 * @param {number} [limite=5]
 */
export async function pesquisarNoticias(limite = 5) {
  const [canalRural, embrapa] = await Promise.all([
    buscarCanalRural(limite),
    buscarEmbrapa(limite),
  ]);

  return {
    atualizado_em: new Date().toISOString(),
    canal_rural: canalRural,
    embrapa,
    // compatível com leitores antigos
    noticias: canalRural.noticias,
    fonte: canalRural.fonte,
    feed: canalRural.feed,
  };
}
