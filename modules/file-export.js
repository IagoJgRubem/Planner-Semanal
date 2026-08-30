export function downloadFile(content, filename, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeXml(value) {
  return String(value || "").replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[character]));
}

export function buildPlannerSvg({ days, times, entriesForDay }) {
  const width = 1440;
  const height = 2000;
  const cellWidth = 170;
  const startX = 160;
  const startY = 210;
  const cellHeight = 70;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fffefa"/><style>text{font-family:Arial,sans-serif;fill:#141414}.small{font-size:14px;fill:#475569}.head{font-size:18px;font-weight:700}.task{font-size:14px;font-weight:600}</style><text x="80" y="85" class="head">PLANNER OPERACIONAL SEMANAL</text>`];
  days.forEach((day, index) => parts.push(`<text x="${startX + index * cellWidth + 8}" y="${startY - 18}" class="small">${escapeXml(day.label.toUpperCase())}</text>`));
  times.forEach((time, row) => {
    const y = startY + row * cellHeight;
    parts.push(`<text x="82" y="${y + 30}" class="small">${time}</text>`);
    days.forEach((day, column) => {
      const x = startX + column * cellWidth;
      parts.push(`<rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" fill="#fffefa" stroke="#d7d4cd"/>`);
    });
  });
  days.forEach((day, column) => {
    entriesForDay(day.key).forEach((entry) => {
      const row = times.indexOf(entry.time);
      const x = startX + column * cellWidth;
      const y = startY + row * cellHeight;
      const heightForEntry = Math.max(cellHeight, Math.round((entry.duration / 60) * cellHeight));
      const fill = entry.base.includes("work") ? "#f1f5f9" : entry.base.includes("personal") ? "#eef8f1" : "#fffefa";
      parts.push(`<rect x="${x + 1}" y="${y + 1}" width="${cellWidth - 2}" height="${heightForEntry - 2}" fill="${fill}" stroke="#9ca3af"/><text x="${x + 8}" y="${y + 30}" class="task">${escapeXml(entry.text)}</text><text x="${x + 8}" y="${y + 52}" class="small">${entry.duration} min</text>`);
    });
  });
  return parts.concat("</svg>").join("");
}

function escapeIcsText(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatIcsDate(date, time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours || 0, minutes || 0);
  return `${eventDate.getFullYear()}${String(eventDate.getMonth() + 1).padStart(2, "0")}${String(eventDate.getDate()).padStart(2, "0")}T${String(eventDate.getHours()).padStart(2, "0")}${String(eventDate.getMinutes()).padStart(2, "0")}00`;
}

export function buildRoutineIcs({ monday, days, entriesForDay }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const events = [];
  days.forEach((day, offset) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + offset);
    entriesForDay(day.key).forEach((entry) => {
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), ...String(entry.time).split(":").map(Number));
      end.setMinutes(end.getMinutes() + entry.duration);
      events.push(["BEGIN:VEVENT", `UID:planner-${day.key}-${entry.time.replace(":", "")}-${Date.now()}@local`, `DTSTAMP:${stamp}`, `DTSTART:${formatIcsDate(date, entry.time)}`, `DTEND:${formatIcsDate(end, `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`)}`, `SUMMARY:${escapeIcsText(entry.text)}`, "DESCRIPTION:Exportado do Planner Operacional Semanal.", "END:VEVENT"].join("\r\n"));
    });
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Planner Operacional Semanal//PT-BR", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
}
