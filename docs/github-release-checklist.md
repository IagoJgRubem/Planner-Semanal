# Checklist de envio ao GitHub

## Antes do primeiro push

| Controle | Ação | Aplicação neste PWA |
| --- | --- | --- |
| Arquivos ignorados | Confirme `git status --ignored` e revise `.gitignore`. | Obrigatório. `.env`, chaves, logs, `node_modules` e artefatos locais são excluídos. |
| Segredos | Execute uma busca de tokens e chaves antes de commitar. | Obrigatório, embora o PWA não use credenciais. |
| Documentação | Leia `README.md` e atualize versão, cache e comandos se necessário. | Obrigatório. |
| Testes | Execute `pnpm test`. | Obrigatório. |
| Responsividade | Execute `pnpm audit:responsive` quando o Chromium CDP estiver disponível. | Recomendado para alterações de interface. |
| Impressão | Gere uma prévia/PDF e confirme uma página A4 paisagem. | Obrigatório quando CSS de impressão mudar. |

## Configurações no GitHub

Ative **2FA** na conta e use uma chave SSH ou PAT com escopo mínimo no terminal. Em repositórios públicos, habilite Secret Scanning, Dependabot alerts e proteção da branch `main`; exija pull requests e revisão quando houver colaboradores.

Não há segredo a migrar neste repositório. Se uma credencial for adicionada no futuro, use um arquivo `.env` local ignorado e configure o segredo de produção no provedor de hospedagem. Não use `git-filter-repo` preventivamente: ele só é necessário se um segredo já tiver sido enviado ao histórico; nesse caso, revogue a credencial primeiro e reescreva o histórico depois.

## Comandos sugeridos

```bash
git status
git diff --check
pnpm test
git add .
git commit -m "Prepare static PWA for GitHub"
git remote add origin git@github.com:USUARIO/REPOSITORIO.git
git branch -M main
git push -u origin main
```

Depois do push, abra **Settings → Pages** para escolher a origem de publicação. Não inclua `node_modules`, arquivos `.env`, logs, certificados, chaves privadas ou o PDF local de validação da impressão.
