# Rubrica objetiva de qualidade

## Escopo e ambiente controlado

Esta rubrica usa critérios passa/falha para o Planner PWA estático. O Lighthouse deve ser executado em um navegador, perfil sem extensões, rede e servidor local explicitamente registrados; sem esse controle, uma meta numérica não é comparável. A saída de impressão exige duas evidências: inspeção de layout automatizada e confirmação manual no diálogo nativo do sistema.

| Pilar | Critério de aceite | Estado atual | Evidência |
| --- | --- | --- | --- |
| Layout móvel | Overflow horizontal involuntário igual a 0 px entre 320 px e 420 px | **Aprovado** | Medição CDP em 320, 375 e 420 px. |
| Ergonomia de toque | Abas de dias e Bottom Bar com pelo menos 44 × 44 px | **Aprovado** | Menor alvo medido: 44 × 44 px. |
| Performance | Lighthouse Performance, PWA e Acessibilidade maiores ou iguais a 95 | **Não medido** | Requer execução controlada de Lighthouse. |
| Estabilidade visual | CLS igual a 0,00 durante o carregamento | **Não medido** | Requer traço de Performance no navegador. |
| Confiabilidade offline | Assets essenciais retornam do cache sem erro em modo Offline | **Parcial** | Service worker e lista de assets são testados; falta teste de rede offline forçada. |
| Integridade de dados | Sem perda após escrita, recarga, exportação e restauração | **Parcial** | Há regressões de backup e persistência; falta um cenário de ponta a ponta único. |
| Saída gráfica | Uma folha A4 paisagem sem corte ou segunda página | **Aprovado no Chromium** | PDF A4 gerado em uma página; diálogo nativo exige manter as opções documentadas. |

## Medição móvel executada

| Viewport | Overflow | Menor aba de dia | Menor botão da Bottom Bar | Resultado |
| --- | ---: | ---: | ---: | --- |
| 320 × 812 px | 0 px | 44 × 44 px | 67,31 × 44 px | Aprovado |
| 375 × 812 px | 0 px | 46,70 × 44 px | 81,06 × 44 px | Aprovado |
| 420 × 812 px | 0 px | 53,14 × 44 px | 92,31 × 44 px | Aprovado |

Os dados brutos estão em [rubrica-mobile-medicoes.json](./rubrica-mobile-medicoes.json). A medição usou Chromium 151 em modo headless, CDP local, escala de dispositivo 1 e a rota `/planner.html` servida localmente. Essa medição é determinística para overflow e geometria, mas não substitui uma auditoria de Lighthouse nem uma impressão real.

## Resultado da execução

A execução de `pnpm audit:responsive` confirmou os três critérios de layout móvel da rubrica: overflow horizontal de 0 px, 11 alvos interativos visíveis por viewport e nenhum alvo abaixo de 44 × 44 px. Não houve desvio de layout a corrigir nessa medição. A suíte `pnpm test` também passou com 14 testes. Os critérios ainda marcados como parciais ou não medidos não foram promovidos indevidamente a aprovados.

## Reprodução

1. Inicie a prévia local com `pnpm dev`.
2. Inicie Chromium com `--headless=new --remote-debugging-port=9222`.
3. Execute `pnpm audit:responsive > docs/rubrica-mobile-medicoes.json`.

O auditor falha se não encontrar uma página Chromium exposta pelo CDP. Ele mede overflow do documento e os alvos visíveis em `.mobile-day-tabs` e `.mobile-bottom-bar`.
