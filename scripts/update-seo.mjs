#!/usr/bin/env node
/**
 * Atualiza meta description e JSON-LD com a média nacional atual.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://precodoboi.me";

function brl(n) {
  return Number(n).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function replaceBlock(html, name, inner) {
  const re = new RegExp(
    `<!-- SEO:${name}:START -->[\\s\\S]*?<!-- SEO:${name}:END -->`,
    "m",
  );
  if (!re.test(html)) throw new Error(`Bloco SEO:${name} não encontrado`);
  return html.replace(
    re,
    `<!-- SEO:${name}:START -->\n${inner}\n    <!-- SEO:${name}:END -->`,
  );
}

async function main() {
  const prices = JSON.parse(
    await readFile(join(root, "data", "prices.json"), "utf8"),
  );
  const media = prices.media_nacional?.preco_arroba;
  const quando = prices.atualizado_em
    ? new Date(prices.atualizado_em).toLocaleString("pt-BR")
    : "";
  const mediaTxt = media != null ? brl(media) : "";

  const desc =
    media != null
      ? `Preço da arroba do boi hoje: média Brasil ${mediaTxt}. Consulte a cotação do gado (boi gordo) por estado e notícias da pecuária. Atualizado em ${quando}.`
      : `Consulte o preço da arroba do boi (gado) por estado no Brasil, média nacional atualizada e notícias da pecuária.`;

  let html = await readFile(join(root, "index.html"), "utf8");

  // Garante URLs canônicas no domínio atual (evita github.io residual)
  html = html
    .replaceAll("https://marcos-dev79.github.io/precodoboi", SITE)
    .replace(
      /(<link\s+rel="canonical"\s+href=")[^"]+(")/,
      `$1${SITE}/$2`,
    )
    .replace(
      /(<meta\s+property="og:url"\s+content=")[^"]+(")/,
      `$1${SITE}/$2`,
    )
    .replace(
      /(<meta\s+property="og:image"\s+content=")[^"]+(")/,
      `$1${SITE}/assets/gado-silhueta.png$2`,
    )
    .replace(
      /(<meta\s+name="twitter:image"\s+content=")[^"]+(")/,
      `$1${SITE}/assets/gado-silhueta.png$2`,
    );

  html = replaceBlock(
    html,
    "DESC",
    `    <meta\n      name="description"\n      content=${JSON.stringify(desc)}\n    />`,
  );
  html = replaceBlock(
    html,
    "OGDESC",
    `    <meta\n      property="og:description"\n      content=${JSON.stringify(desc)}\n    />`,
  );
  html = replaceBlock(
    html,
    "TWDESC",
    `    <meta\n      name="twitter:description"\n      content=${JSON.stringify(desc)}\n    />`,
  );

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        name: "Preço do Boi",
        url: `${SITE}/`,
        description:
          "Portal com o preço da arroba do boi por estado no Brasil e notícias da pecuária.",
        inLanguage: "pt-BR",
      },
      {
        "@type": "WebPage",
        "@id": `${SITE}/#webpage`,
        url: `${SITE}/`,
        name: "Preço da arroba do boi por estado",
        isPartOf: { "@id": `${SITE}/#website` },
        about: ["preço do boi", "arroba do gado", "boi gordo", "pecuária"],
        inLanguage: "pt-BR",
        dateModified: prices.atualizado_em || undefined,
      },
      {
        "@type": "Dataset",
        name: "Cotação da arroba do boi por estado",
        description:
          "Preços médios da arroba do gado (boi gordo) por unidade federativa do Brasil.",
        url: `${SITE}/`,
        keywords: ["preço do boi", "arroba", "boi gordo", "pecuária", "CEPEA"],
        creator: { "@type": "Organization", name: "Preço do Boi" },
        license: "https://creativecommons.org/licenses/by/4.0/",
        dateModified: prices.atualizado_em || undefined,
        variableMeasured:
          media != null
            ? {
                "@type": "PropertyValue",
                name: "Média nacional da arroba do boi",
                value: media,
                unitText: "BRL per arroba",
              }
            : undefined,
      },
    ],
  };

  html = replaceBlock(
    html,
    "SCHEMA",
    `    <script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n    </script>`,
  );

  await writeFile(join(root, "index.html"), html, "utf8");
  console.log("SEO atualizado:", mediaTxt || "(sem média)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
