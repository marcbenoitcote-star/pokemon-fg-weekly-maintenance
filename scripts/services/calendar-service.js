import { MODULE_ID } from "../data/constants.js";

export function isSimpleCalendarRebornActive() {
  return Boolean(
    game.modules?.get?.("foundryvtt-simple-calendar")?.active ||
    game.modules?.get?.("simple-calendar")?.active ||
    game.modules?.get?.("foundryvtt-simple-calendar-reborn")?.active ||
    globalThis.SimpleCalendar
  );
}

export function getCurrentWeekData(manual = {}) {
  const simple = readSimpleCalendar();
  if (simple) return simple;

  const weekName = String(manual.weekName ?? "").trim();
  const rpDate = String(manual.rpDate ?? "").trim();
  const eventName = String(manual.eventName ?? "").trim();
  const label = [weekName || "Semaine manuelle", rpDate].filter(Boolean).join(" - ");
  const weekKey = slugify([weekName || "semaine-manuelle", rpDate || new Date().toISOString().slice(0, 10)].join("-"));

  return {
    source: "manual",
    simpleCalendarActive: false,
    weekKey,
    calendarLabel: label,
    eventName,
    eventDescription: String(manual.eventDescription ?? "").trim()
  };
}

export function getCurrentWeekKey(manual = {}) {
  return getCurrentWeekData(manual).weekKey;
}

export function getCurrentCalendarLabel(manual = {}) {
  return getCurrentWeekData(manual).calendarLabel;
}

export function getActorWeeks(actor) {
  const weeks = actor?.getFlag?.(MODULE_ID, "weeks");
  return weeks && typeof weeks === "object" ? weeks : {};
}

export function getActorWeek(actor, weekKey) {
  return getActorWeeks(actor)[weekKey] ?? null;
}

export function isWeekFinalized(actor, weekKey) {
  return Boolean(getActorWeek(actor, weekKey)?.finalized);
}

export async function saveWeek(actor, weekData) {
  const existing = getActorWeeks(actor);
  const weeks = {
    ...existing,
    [weekData.weekKey]: {
      ...existing[weekData.weekKey],
      ...weekData
    }
  };
  await actor.setFlag(MODULE_ID, "weeks", weeks);
}

export async function unlockWeek(actor, weekKey) {
  const weeks = getActorWeeks(actor);
  if (!weeks[weekKey]) return false;
  weeks[weekKey] = {
    ...weeks[weekKey],
    finalized: false,
    unlockedBy: game.user?.id ?? null,
    unlockedAt: new Date().toISOString()
  };
  await actor.setFlag(MODULE_ID, "weeks", weeks);
  return true;
}

function readSimpleCalendar() {
  try {
    const api = globalThis.SimpleCalendar?.api ?? game.modules?.get?.("foundryvtt-simple-calendar")?.api;
    if (!api) return null;

    const timestamp = api.timestamp?.();
    const currentDate = api.currentDateTime?.() ?? api.getCurrentDate?.() ?? api.currentDate?.();
    const display = api.formatDateTime?.(currentDate) ?? api.formatDate?.(currentDate) ?? null;
    const year = currentDate?.year ?? currentDate?.yearName ?? currentDate?.yearNumeric ?? "year";
    const month = currentDate?.month ?? currentDate?.monthName ?? currentDate?.monthNumeric ?? "month";
    const day = currentDate?.day ?? currentDate?.dayOfMonth ?? currentDate?.dayNumeric ?? timestamp ?? "day";
    const week = currentDate?.week ?? currentDate?.weekOfYear ?? Math.max(1, Math.ceil(Number(day || 1) / 7));
    const calendarLabel = display || [year, month, day].filter(Boolean).join("-");

    return {
      source: "simple-calendar",
      simpleCalendarActive: true,
      weekKey: slugify(`${year}-${month}-week-${week}`),
      calendarLabel,
      eventName: "",
      eventDescription: ""
    };
  } catch (error) {
    if (game.settings?.get?.(MODULE_ID, "debug")) {
      console.warn(`${MODULE_ID} | Simple Calendar detecte mais lecture impossible.`, error);
    }
    return null;
  }
}

export function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "semaine";
}
