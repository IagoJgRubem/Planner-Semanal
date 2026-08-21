# Validação de impressão A4

## Resultado automatizado

O mecanismo de impressão do Chromium 151 gerou `validacao-a4-uma-folha.pdf` a partir de `/planner.html` após a blindagem do `@media print`.

| Verificação | Resultado |
| --- | --- |
| Formato do PDF | A4 paisagem, 841,92 × 594,96 pt |
| Número de páginas | 1 |
| Grade semanal | Sete dias completos e dezoito horários na mesma página |
| Faixa de revisão | Presente ao pé da folha, sem página adicional |
| Fragmentação | Bloqueada em página, grade e cartões de revisão |

A inspeção visual do PDF confirmou que não há corte de colunas ou conteúdo deslocado para uma segunda página. O CSS restringe `html`, `body`, `.workspace`, `.planner-page` e `.planner-content` à área imprimível de 281 × 194 mm e aplica `break-inside: avoid-page`/`page-break-inside: avoid` aos blocos estruturais.

## Limite da automação

O PDF valida o mecanismo de impressão do Chromium; não controla opções manuais que o usuário possa alterar no diálogo nativo, como escala, margens personalizadas ou cabeçalhos e rodapés. Para preservar este resultado no diálogo do sistema, mantenha **A4**, **paisagem**, **escala padrão** e cabeçalhos/rodapés desativados.
