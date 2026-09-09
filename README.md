# Preço do Boi

Site estático com o preço médio da **arroba do gado** por estado brasileiro. Os dados ficam em `data/prices.json` e podem ser atualizados pelo navegador (botão após 24h) ou automaticamente via **GitHub Actions**.

## Pré-requisitos

- Conta no [GitHub](https://github.com)
- [Git](https://git-scm.com/) instalado
- [Node.js 20+](https://nodejs.org/) (só para rodar localmente ou forçar uma atualização manual)

## Rodar localmente

```bash
git clone <url-do-seu-repositorio>.git
cd precodoboi
npm run serve
```

Abra `http://localhost:4173`.

Para regenerar o JSON na máquina:

```bash
npm run update
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

O deploy está em [`.github/workflows/pages.yml`](.github/workflows/pages.yml): a cada push em `main`/`master` (ou execução manual), o site sobe no Pages.

1. No GitHub, abra o repositório → **Settings** → **Pages**.
2. Em **Build and deployment** → **Source**, escolha **GitHub Actions**.
3. Vá em **Actions** e, se o workflow **Deploy GitHub Pages** estiver aguardando aprovação na primeira vez, clique em **Run workflow** ou aprove o job.
4. Quando terminar, a URL aparece em **Settings → Pages** (algo como `https://SEU_USUARIO.github.io/SEU_REPO/`).

### Se o site abrir em subpasta (`/SEU_REPO/`)

Os caminhos do projeto são relativos (`css/`, `js/`, `data/`), então funciona tanto na raiz quanto em subpasta do Pages. Não é preciso configurar `base` especial.

## Action de atualização de preços

O workflow [`.github/workflows/update-prices.yml`](.github/workflows/update-prices.yml):

- roda **todo dia às 12:00 UTC** (`cron: "0 12 * * *"`);
- também pode ser disparado **manualmente**;
- executa `npm run update`;
- faz commit e push de `data/prices.json` se houver mudança.

O push do JSON dispara de novo o workflow de Pages, republicando o site com os preços novos.

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
  update-prices.yml   # atualiza data/prices.json
data/prices.json      # preços + data da última atualização
scripts/update-prices.mjs
js/fetch-prices.js    # lógica de busca (browser e Node)
index.html
```

## Fonte dos dados

Cotações via [AgroDoc AI](https://agrodocai.com.br/api-docs) (CEPEA/ESALQ e praças). UFs sem praça na API usam estimativa regional. Licença dos dados da API: CC-BY-4.0 — atribuição AgroDoc AI.
