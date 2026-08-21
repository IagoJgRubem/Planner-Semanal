# Avaliação de usabilidade móvel

## Achados confirmados

| Área | Observação na prévia de 390 px | Impacto |
|---|---|---|
| Grade semanal | A coluna do dia selecionado permanece na sua posição original de desktop porque os elementos recebem `grid-column` inline. Isso preserva colunas intermediárias vazias no celular. | A atividade fica comprimida e a largura útil é desperdiçada. |
| Acima da dobra | Toolbar, status, detalhes administrativos e os quatro atalhos de preenchimento rápido aparecem antes das abas dos dias. | A consulta da rotina exige rolagem adicional. |
| Bloco de tarefa | Duração e checkbox dividem a extremidade direita do cartão em área limitada. | Há ambiguidade visual e tátil. |
| Captura rápida | O texto editável sobrepõe a pauta de fundo em largura reduzida. | A seção perde alinhamento editorial. |

## Direção da correção

No limite móvel, a grade deve passar a duas colunas efetivas — horário e dia ativo — com sobrescrita das posições inline. Os controles auxiliares serão recolhidos em detalhes fechados e reposicionados depois da grade. Duração e marcação receberão áreas independentes; a área de captura rápida passará a uma composição vertical sem sobreposição de pauta.

## Resultado da correção

Em 390 px, a grade passou a ocupar duas colunas reais: a régua de horário reduzida e o dia ativo com toda a largura restante. As abas dos dias aparecem logo após o cabeçalho, enquanto toolbar, modelos, ferramentas e preenchimento rápido foram reunidos na gaveta fechada **Ferramentas e preenchimento**, posicionada depois da grade. O checkbox foi mantido no canto superior direito e a duração foi deslocada para o canto inferior esquerdo quando ambos coexistem. A captura rápida agora usa um campo próprio, sem a pauta atravessar o texto.

A prévia desktop também foi verificada em 1280 px. A grade de sete dias, os controles superiores e o arranjo editorial A4 permanecem inalterados.

## Segunda revisão: arquitetura de informação

A navegação móvel foi reorganizada para três zonas. O topo conserva somente identidade, mês, semana e prioridades; a grade inicia imediatamente com as abas de dia e mantém o dia ativo em toda a largura útil; e a ação global passou a uma barra inferior fixa com **Prévia A4**, **Tema**, **Foco** e **Menu**. O menu abre um diálogo compacto com opções secundárias, preenchimento rápido e ferramentas avançadas, sem inserir blocos extensos no fluxo da rotina.

As capturas em 390 px confirmaram a barra inferior no viewport, sem cobrir o cabeçalho, e a página completa confirmou que a rotina não é mais interrompida por controles entre a grade e a revisão. Os badges de duração foram uniformizados no canto inferior esquerdo, preservando o checkbox no canto superior direito.

O botão **Menu** foi validado no navegador: o diálogo de ferramentas existe, abre corretamente e o service worker atualizado mantém somente o cache `planner-operacional-semanal-v15` ativo.

## Terceira revisão: acabamento de grade e área segura

Após ampliar a coluna de horário para **4,25 rem**, o cabeçalho do dia e as células horárias passaram a compartilhar a mesma fronteira visual, sem cortar o rótulo **Horário**. A página completa em 390 px alcança o fim da revisão, do checklist e da captura rápida; a barra inferior recebe espaço reservado pelo conteúdo e não encobre esses elementos. Os badges de duração agora são posicionados de forma absoluta no canto inferior esquerdo do cartão, sem dividir a linha principal da tarefa.

O diálogo móvel passou a usar no máximo 80% da altura dinâmica do viewport, com rolagem interna contida. Os controles de modelos receberam caixas de toque consistentes e o painel avançado não repete **Tema**. No celular, o JSON cru e a restauração textual foram ocultados do diálogo: permanecem as ações compactas para copiar o backup e restaurar por arquivo.

## Quarta revisão: pré-visualização A4

A folha clonada agora remove o estado de dia móvel, impõe a coluna de cada cabeçalho e slot com prioridade e mantém a área de conferência rolável nos dois eixos. No navegador, a prévia aberta apresentou **7 cabeçalhos e 126 slots**, todos visíveis; a barra inferior ficou oculta durante esse estado. A folha mantém largura mínima de 281 mm e altura de 194 mm, preservando a prancha A4 paisagem em qualquer viewport.

## Quinta revisão: proporção física e rolagem lateral

As abas móveis são ocultadas no clone e os quadrados de marcação recuperam o tamanho físico de 3,5 mm, medido no navegador como aproximadamente 13,22 px. A folha clonada manteve largura de 1.062 px (281 mm), enquanto o palco usa `overflow-x: scroll`; em um celular, cuja largura é inferior a essa medida, a navegação lateral fica disponível para conferir todos os dias sem deformar a prancha.

## Sexta revisão: continuidade e leitura lateral

O clone passou a preservar as continuações ocultas. A validação mostrou as três continuações de trabalho como `display: none` e o cartão principal de segunda-feira com `grid-row: 9 / span 4` e duração consolidada de `240m`. A folha mantém `max-width: none`, os badges permanecem em posição absoluta e o palco expõe rolagem horizontal automática. Uma sombra curta na borda direita da área de conferência indica discretamente que há conteúdo lateral disponível no celular.

## Sétima revisão: barra de ferramentas desktop

Em telas a partir de 921 px, a barra agora distribui os grupos por flexbox com quebra controlada: ações principais, estado operacional, modelos e ferramentas preservam larguras mínimas adequadas. Os controles de modelos, categorias e utilitários usam linhas horizontais com botões de mesma altura, borda e tipografia; `Registrar semana` segue o mesmo padrão. O campo de backup JSON bruto foi retirado da área superior do desktop. Em 390 px, o modo móvel manteve a grade por dia e a barra inferior fixa sem herdar essas regras.

## Oitava revisão: verificação técnica

Os critérios verificáveis da revisão foram confirmados: o HTML tem entrada externa de módulo, o modal reutilizável substitui diálogos nativos nos fluxos de agenda e metas, a barra inferior recebe área segura, a prévia A4 preserva dimensões físicas e a toolbar desktop usa composição própria. O projeto contém 28 módulos ES nativos e cache offline v21. O acompanhamento já era fechado por padrão; abaixo de 400 px, os controles de jornada passam a duas colunas, o calendário mensal reduz altura e a disponibilidade anual usa duas colunas compactas. A nota de `85%+` não é tratada como métrica factual, pois não há escala, benchmark ou protocolo de pontuação definido.

## Nona revisão: auditoria de conteúdo repetido

O documento repetido descreve corretamente a maior parte da arquitetura, mas está desatualizado em dois pontos: o cache atual é **v21**, não v20, e o detalhe residual de densidade abaixo de 400 px já foi tratado na revisão anterior. A suíte atual passou em 14 testes. Não foi aplicada mudança funcional adicional porque não havia novo defeito técnico no anexo repetido.

## Décima revisão: simulação estreita

As capturas de página completa em 320 px e 375 px não mostraram corte horizontal, sobreposição ou invasão da barra inferior. A grade de um dia, revisão, checklist, regra noturna e captura rápida permanecem legíveis; **Acompanhamento semanal e metas mensais** segue fechado por padrão ao fim do fluxo. A abertura e a densidade interna são protegidas pelas regras específicas abaixo de 400 px e por testes de regressão estrutural; não há uma quebra visual observável no estado recolhido.

Com o Acompanhamento aberto, as capturas em 320 px e 375 px também não mostraram corte horizontal ou controles sobrepostos. O problema residual é de extensão: os doze mini-calendários de disponibilidade anual deixam o painel excessivamente longo. A correção adequada é limitar apenas essa coleção a uma área de rolagem vertical interna em telas estreitas, sem ocultar meses nem reduzir os controles a tamanhos ilegíveis.

Após aplicar o limite interno de 46 rem, a captura em 320 px confirmou que a sequência anual deixa de empurrar indefinidamente os painéis seguintes. Os meses continuam disponíveis no mesmo painel por rolagem interna, e o Acompanhamento foi restaurado ao estado fechado padrão.

O contêiner anual agora tem uma sombra interna no limite inferior e uma barra de rolagem fina personalizada onde o navegador a suporta. A validação em 320 px confirmou que o indicativo não cobre títulos, dias ou controles dos mini-calendários.
