export function weekValueForDate(date = new Date()) {
  const reference = new Date(date);
  reference.setHours(0, 0, 0, 0);
  reference.setDate(reference.getDate() + 3 - ((reference.getDay() + 6) % 7));
  const firstThursday = new Date(reference.getFullYear(), 0, 4);
  const week = 1 + Math.round(((reference - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${reference.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function mondayFromWeekValue(value) {
  const match = /^(\d{4})-W(\d{2})$/.exec(value || "");
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const januaryFourth = new Date(year, 0, 4);
  const monday = new Date(januaryFourth);
  monday.setDate(januaryFourth.getDate() - ((januaryFourth.getDay() + 6) % 7) + (week - 1) * 7);
  return monday;
}

export function localDateKey(date) {
  const current = new Date(date);
  return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
}

export function dateFromKey(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) ? new Date(year, month - 1, day) : null;
}

export function timeToMinutes(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function formatDuration(minutes) {
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

export function rangesOverlap(firstTime, firstDuration, secondTime, secondDuration) {
  const firstStart = timeToMinutes(firstTime);
  const secondStart = timeToMinutes(secondTime);
  return firstStart < secondStart + secondDuration && secondStart < firstStart + firstDuration;
}
