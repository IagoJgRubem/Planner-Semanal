export function createFocusController({ elements, getCurrentBlock, playChime, status }) {
  const { overlay, activeBlock, clock, startButton, enterButton } = elements;
  let intervalId = null;
  let remainingSeconds = 25 * 60;

  function updateClock() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    clock.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function start() {
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalId = null;
      startButton.textContent = "Continuar";
      return;
    }
    startButton.textContent = "Pausar";
    intervalId = window.setInterval(() => {
      remainingSeconds -= 1;
      updateClock();
      if (remainingSeconds <= 0) {
        window.clearInterval(intervalId);
        intervalId = null;
        remainingSeconds = 5 * 60;
        startButton.textContent = "Iniciar pausa";
        playChime();
        activeBlock.textContent = "Pausa breve";
        status("Ciclo concluído. Faça uma pausa breve.");
        updateClock();
      }
    }, 1000);
  }

  function enter() {
    const { active, next } = getCurrentBlock();
    activeBlock.textContent = active ? active.text : next ? `Preparar: ${next.text}` : "Organize o próximo bloco.";
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-focus-mode");
    updateClock();
    startButton.focus();
  }

  function exit() {
    window.clearInterval(intervalId);
    intervalId = null;
    startButton.textContent = "Iniciar";
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-focus-mode");
    enterButton.focus();
  }

  function reset() {
    window.clearInterval(intervalId);
    intervalId = null;
    remainingSeconds = 25 * 60;
    startButton.textContent = "Iniciar";
    updateClock();
  }

  return { start, enter, exit, reset };
}
