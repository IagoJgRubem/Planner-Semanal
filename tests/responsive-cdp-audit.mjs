const debugUrl = process.env.CDP_URL || "http://127.0.0.1:9222";
const plannerUrl = process.env.PLANNER_URL || "http://127.0.0.1:3000/planner.html";
const viewports = (process.env.AUDIT_VIEWPORTS || "320,375,420").split(",").map(Number);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function connect() {
  const pages = await (await fetch(`${debugUrl}/json/list`)).json();
  const page = pages.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
  if (!page) throw new Error("Nenhuma página do Chromium está disponível. Inicie Chromium com --remote-debugging-port=9222.");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    const callback = pending.get(message.id);
    if (!callback) return;
    pending.delete(message.id);
    message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result);
  });
  return {
    send(method, params = {}) {
      const id = ++sequence;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close() { socket.close(); },
  };
}

const measure = `(() => {
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const targets = [...document.querySelectorAll(".mobile-bottom-bar button, .mobile-day-tabs button")]
    .filter(visible)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { label: element.textContent.trim(), width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)) };
    });
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    overflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth, document.body.scrollWidth - window.innerWidth),
    targets,
    undersizedTargets: targets.filter((target) => target.width < 44 || target.height < 44),
    mobileBarPresent: Boolean(document.querySelector(".mobile-bottom-bar")),
  };
})()`;

const client = await connect();
try {
  await client.send("Page.enable");
  const results = [];
  for (const width of viewports) {
    await client.send("Emulation.setDeviceMetricsOverride", { width, height: 812, deviceScaleFactor: 1, mobile: true, screenWidth: width, screenHeight: 812 });
    await client.send("Page.navigate", { url: plannerUrl });
    await sleep(900);
    const response = await client.send("Runtime.evaluate", { expression: measure, returnByValue: true });
    results.push(response.result.value);
  }
  console.log(JSON.stringify({ plannerUrl, results }, null, 2));
} finally {
  client.close();
}
