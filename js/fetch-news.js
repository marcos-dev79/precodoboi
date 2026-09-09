/**
 * Busca notícias de pecuária via RSS do Canal Rural,
 * ranqueia por relevância e devolve as top N.
 */

const FEED_URL = "https://www.canalrural.com.br/pecuaria/feed/";

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

function stripHtml(html = "") {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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

function parseRssItems(xml) {
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  return blocks.map((block) => {
    const title = stripHtml(extractTag(block, "title"));
    const link = stripHtml(extractTag(block, "link"));
    const pubDate = extractTag(block, "pubDate");
    const descriptionRaw = extractTag(block, "description");
    const contentRaw =
      extractTag(block, "content:encoded") || descriptionRaw;
    const image =
      extractImage(contentRaw) ||
      extractImage(descriptionRaw) ||
      null;
    const summary = stripHtml(descriptionRaw).slice(0, 220);
    const publishedAt = pubDate ? new Date(pubDate).toISOString() : null;

    return { title, link, summary, image, publishedAt, fonte: "Canal Rural" };
  });
}

function scoreItem(item) {
  const text = `${item.title} ${item.summary}`;
  let score = 0;
  for (const { re, w } of KEYWORDS) {
    if (re.test(text)) score += w;
  }
  // leve boost por frescor (últimas 48h)
  if (item.publishedAt) {
    const ageH = (Date.now() - new Date(item.publishedAt).getTime()) / 36e5;
    if (ageH <= 24) score += 3;
    else if (ageH <= 48) score += 1;
  }
  return score;
}

export async function pesquisarNoticias(limite = 5) {
  const res = await fetch(FEED_URL, {
    headers: { "User-Agent": "PrecoDoBoi/1.0 (+https://github.com)" },
  });
  if (!res.ok) throw new Error(`Falha no RSS (${res.status})`);
  const xml = await res.text();
  const items = parseRssItems(xml)
    .filter((i) => i.title && i.link)
    .map((i) => ({ ...i, relevancia: scoreItem(i) }))
    .sort((a, b) => {
      if (b.relevancia !== a.relevancia) return b.relevancia - a.relevancia;
      const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return tb - ta;
    })
    .slice(0, limite);

  return {
    atualizado_em: new Date().toISOString(),
    fonte: "Canal Rural · RSS pecuária",
    feed: FEED_URL,
    noticias: items,
  };
}
