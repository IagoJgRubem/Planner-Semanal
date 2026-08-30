// Carregado dinamicamente via import() apenas quando a aba Métricas é
// ativada, evitando pesar o carregamento inicial da página principal.

export async function loadMetricsEnhancements() {
  // Ponto de integração para relatórios avançados (consolidados mensal/anual),
  // sem acoplar o bundle inicial. As factories capacity-reports e metrics
  // já expõem controlladores prontos para serem compostos aqui quando ativados.

  return {
    loaded: true,
    label: "Métricas avançadas disponíveis",
  };
}