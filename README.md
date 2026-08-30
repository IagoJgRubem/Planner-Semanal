# Planner Semanal

PWA estático para planejar rotina semanal, prioridades, agenda diária, metas mensais, capacidade de tempo e impressão A4 em paisagem. O projeto usa HTML declarativo, CSS e módulos ES nativos; não depende de React, servidor, banco de dados ou API externa.

## Recursos

| Área | Implementação |
| --- | --- |
| Persistência | Dados textuais no `localStorage`; áudio de revisão no IndexedDB. |
| Offline | Service worker com cache de documento, módulos, fontes e ícones. |
| Impressão | Uma folha A4 paisagem com pré-visualização e regras anti-fragmentação. |
| Backup | Exportação, cópia e restauração de JSON textual. O áudio não integra o backup. |
| Responsividade | Grade por dia e barra de ações para celular; prancha completa para desktop e impressão. |
| Qualidade | Regressões nativas, auditoria de overflow/alvos de toque e documentação de rubrica. |

## Executar localmente

O PWA é publicado como arquivos estáticos. Para pré-visualização local, use Node.js 22+ e pnpm:

```bash
pnpm install
pnpm dev
```

Abra `http://localhost:3000/`. Não há variáveis de ambiente, banco de dados ou credenciais exigidas por esta versão.

## Verificação

```bash
pnpm test
```

Para reproduzir a auditoria de viewport, inicie Chromium com depuração remota na porta 9222 e execute:

```bash
pnpm audit:responsive > docs/rubrica-mobile-medicoes.json
```

Consulte `docs/rubrica-qualidade.md` e `docs/validacao-impressao-a4.md` para os critérios, limites e resultados mais recentes.

## Publicar no GitHub Pages

1. Crie um repositório **vazio** no GitHub, sem README, `.gitignore` ou licença inicializados pela interface.
2. Envie os arquivos deste diretório à branch `main`.
3. Em **Settings → Pages**, escolha **GitHub Actions** como origem de publicação. Essa seleção só é necessária uma vez.
4. A cada `push` para `main`, o workflow `.github/workflows/deploy.yml` executa a suíte nativa de 14 regressões e, somente se ela for aprovada, publica o artefato estático no GitHub Pages. Pull requests executam apenas os testes.
5. Mantenha os caminhos relativos existentes (`./`), necessários para executar também em subdiretórios como `https://usuario.github.io/planner/`.

O arquivo `.nojekyll` já está presente para evitar processamento Jekyll. Não envie `node_modules`, `.env`, logs, certificados ou chaves; essas classes de arquivos já constam no `.gitignore`.

## Segurança e privacidade

Este PWA não contém chaves de API, segredos de servidor, integração de mensagens ou tráfego de dados pessoais para serviços externos. Antes de enviar atualizações, execute a checklist em `docs/github-release-checklist.md`. Ative **2FA**, **Secret Scanning**, **Dependabot alerts** e proteção da branch principal diretamente nas configurações do GitHub.

## Licença

Defina uma licença antes de tornar o repositório público. Se o código for apenas para uso privado, mantenha o repositório privado e não adicione uma licença permissiva por padrão.
