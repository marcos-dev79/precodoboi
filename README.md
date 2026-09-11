# Preço do Boi

Site estático em **https://precodoboi.me** com o preço médio da **arroba do gado** por estado, o **preço do bezerro** (CEPEA/MS) e notícias de pecuária. Os dados ficam em `data/prices.json`, `data/bezerros.json` e `data/noticias.json`, atualizados automaticamente via **GitHub Actions**.

## Pré-requisitos

- Conta no [GitHub](https://github.com)
- [Git](https://git-scm.com/) instalado
- [Node.js 24+](https://nodejs.org/) (só para rodar localmente ou forçar uma atualização manual)

## Rodar localmente

```bash
git clone <url-do-seu-repositorio>.git
cd precodoboi
npm run serve
```

Abra `http://localhost:4173`.

Para regenerar preços e notícias:

```bash
npm run update            # preços + bezerros + notícias + histórico + SEO
npm run update:prices
npm run update:bezerros
npm run update:news
npm run update:historico  # média mensal CEPEA (12 meses)
npm run update:seo
```

## Publicar no GitHub

Na pasta do projeto:

```bash
git init
git add .
git commit -m "feat: site Preço do Boi"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

Substitua `SEU_USUARIO` e `SEU_REPO` pelos nomes reais.

> Se o repositório já existir no GitHub, use a URL dele no `git remote add origin`.

## Ativar o GitHub Pages

> **Importante:** o workflow de deploy só funciona **depois** de ativar o Pages. Sem isso, o Action falha com `Get Pages site failed` / `Not Found`.

O deploy está em [`.github/workflows/pages.yml`](.github/workflows/pages.yml): a cada push em `main`/`master` (ou execução manual), o site sobe no Pages.

1. No GitHub, abra o repositório → **Settings** → **Pages**.
2. Em **Build and deployment** → **Source**, escolha **GitHub Actions** (não “Deploy from a branch”).
3. Salve / confirme. Isso cria o site Pages no repositório.
4. Vá em **Actions** → **Deploy GitHub Pages** → **Run workflow** (branch `main`).
5. Na primeira vez, o ambiente `github-pages` pode pedir aprovação: **Settings → Environments → github-pages** (ou o banner no próprio job) → aprove.
6. Quando terminar, a URL aparece em **Settings → Pages**.

### Domínio customizado (Cloudflare + GitHub Pages)

O site usa **https://precodoboi.me** (arquivo [`CNAME`](CNAME) na raiz).

No GitHub → **Settings → Pages → Custom domain**: informe `precodoboi.me` e aguarde o DNS/HTTPS.

Na Cloudflare (DNS), o padrão usual com Pages é:

| Tipo | Nome | Conteúdo |
|------|------|----------|
| CNAME | `@` (ou A/ALIAS conforme o plano) | `marcos-dev79.github.io` |
| CNAME | `www` | `marcos-dev79.github.io` |

Com proxy Cloudflare (nuvem laranja), SSL em **Full** (não Flexible). Se o apex não aceitar CNAME, use os A records oficiais do GitHub Pages.

Canônica, Open Graph, `robots.txt` e `sitemap.xml` apontam para `https://precodoboi.me/`.

### Erro comum: `Get Pages site failed` / `Not Found`

Significa que o Pages ainda não existe no repositório. Faça o passo 2 acima (Source = **GitHub Actions**) e rode o workflow de novo. O Action **não** consegue criar o site sozinho com o `GITHUB_TOKEN`.

## SEO

O site já inclui:

- título e description focados em “preço do boi / arroba do gado”
- Open Graph e Twitter Cards
- JSON-LD (`WebSite`, `WebPage`, `Dataset`) atualizado no `npm run update`
- `robots.txt` e `sitemap.xml`
- domínio canônico `https://precodoboi.me/`

Para indexar mais rápido: no [Google Search Console](https://search.google.com/search-console), adicione a propriedade `https://precodoboi.me` e envie o sitemap `https://precodoboi.me/sitemap.xml`.

## Action de atualização de preços

O workflow [`.github/workflows/update-prices.yml`](.github/workflows/update-prices.yml):

- roda **todo dia às 12:00 UTC** (`cron: "0 12 * * *"`);
- também pode ser disparado **manualmente**;
- executa `npm run update` (arroba, bezerro, notícias, histórico e SEO);
- faz commit e push de `data/prices.json`, `data/bezerros.json` e `data/noticias.json` se houver mudança;
- dispara o **Deploy GitHub Pages** em seguida (push com `GITHUB_TOKEN` sozinho não republica o site).

O [`.github/workflows/pages.yml`](.github/workflows/pages.yml) também tem cron próprio (**12:30 UTC**) como rede de segurança diária, além de rodar em push humano e via `workflow_dispatch`.

### Como “gerar” / ativar o Action

Os arquivos de workflow já estão no repositório. Depois do primeiro `git push`:

1. Abra **Actions** no repositório.
2. Confirme que aparecem:
   - **Deploy GitHub Pages**
   - **Atualizar preços**
3. Se o GitHub pedir permissão para workflows em repositório novo, aceite (**I understand my workflows, go ahead and enable them**).

### Rodar a atualização na mão

1. **Actions** → **Atualizar preços**.
2. **Run workflow** → escolha a branch `main` → **Run workflow**.
3. Aguarde o job verde. Em seguida o deploy do Pages deve rodar sozinho.

### Permissões necessárias

O workflow de preços precisa gravar no repositório (`contents: write`). Em repositórios novos isso já costuma funcionar com o `GITHUB_TOKEN`.

Se o commit do bot falhar por permissão:

1. **Settings** → **Actions** → **General**.
2. Em **Workflow permissions**, selecione **Read and write permissions**.
3. Salve e rode o workflow de novo.

### Branch protegida

Se `main` estiver protegida e bloquear push do `github-actions[bot]`, libere o bot nas regras da branch ou rode `npm run update` localmente e faça o commit você mesmo.

## Comportamento no site

| Situação | O que acontece |
|----------|----------------|
| JSON com menos de 24h | Só exibe os preços |
| JSON com mais de 24h | Mostra o botão **Atualizar Dados** |
| Clique em atualizar | Busca na API em background, mostra **Atualizando...**, salva no `localStorage` |

O botão no Pages atualiza a tela do visitante; o JSON “oficial” do repositório continua sendo o gerado pelo Action (ou por `npm run update`).

Para testar o botão com dados frescos: abra `/?stale`.

## Estrutura útil

```text
.github/workflows/
  pages.yml           # deploy no GitHub Pages
  update-prices.yml   # atualiza prices, noticias, historico, SEO
data/prices.json
data/bezerros.json
data/noticias.json
data/historico.json
scripts/update-all.mjs
scripts/update-prices.mjs
scripts/update-bezerros.mjs
scripts/update-news.mjs
scripts/update-historico.mjs
scripts/update-seo.mjs
js/fetch-prices.js
js/fetch-bezerros.js
js/fetch-news.js
js/fetch-historico.js
index.html
```

## Fonte dos dados

- **Preços (arroba):** [AgroDoc AI](https://agrodocai.com.br/api-docs) (CEPEA/ESALQ e praças). UFs sem praça usam estimativa regional. CC-BY-4.0 — atribuição AgroDoc AI.
- **Bezerro:** Indicador do Bezerro CEPEA/ESALQ (MS), R$/cabeça, via AgroDoc (`bezerro_ms`) em `data/bezerros.json`.
- **Histórico:** médias mensais do Indicador do boi gordo [CEPEA/ESALQ](https://www.cepea.org.br/br/indicador/boi-gordo.aspx) (últimos 12 meses) em `data/historico.json`.
- **Notícias:** cache em `data/noticias.json`:
  - [Canal Rural · Pecuária](https://www.canalrural.com.br/pecuaria/feed/) (RSS), top 5 por relevância
  - [Embrapa · notícias](https://www.embrapa.br/noticias-rss) (lista pública; a página é HTML, não XML), 5 mais recentes
