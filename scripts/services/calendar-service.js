import { MODULE_ID } from "../data/constants.js";

export const SIMPLE_CALENDAR_MODULE_ID = "foundryvtt-simple-calendar-reborn";
export const SIMPLE_CALENDAR_MANIFEST = "https://github.com/Fireblight-Studios/foundryvtt-simple-calendar/releases/latest/download/module.json";

export function isSimpleCalendarRebornActive() {
  const module = game.modules?.get?.(SIMPLE_CALENDAR_MODULE_ID);
  return Boolean(module?.active && getSimpleCalendarApi());
}

export function getSimpleCalendarStatus() {
  const module = game.modules?.get?.(SIMPLE_CALENDAR_MODULE_ID);
  const api = getSimpleCalendarApi();
  return {
    moduleId: SIMPLE_CALENDAR_MODULE_ID,
    manifest: SIMPLE_CALENDAR_MANIFEST,
    installed: Boolean(module),
    active: Boolean(module?.active),
    apiAvailable: Boolean(api),
    ready: Boolean(module?.active && api),
    version: module?.version ?? module?.data?.version ?? module?.manifest?.version ?? ""
  };
}

export function getCurrentWeekData(manual = {}) {
  const simple = readSimpleCalendar();
  if (simple) {
    return {
      ...simple,
      eventName: String(manual.eventName ?? "").trim(),
      eventDescription: String(manual.eventDescription ?? "").trim()
    };
  }

  const weekName = String(manual.weekName ?? "").trim();
  const rpDate = String(manual.rpDate ?? "").trim();
  const eventName = String(manual.eventName ?? "").trim();
  const label = [weekName || "Semaine manuelle", rpDate].filter(Boolean).join(" - ");
  const weekKey = slugify([weekName || "semaine-manuelle", rpDate || new Date().toISOString().slice(0, 10)].join("-"));

  return {
    source: "manual",
    simpleCalendarActive: false,
    simpleCalendarStatus: getSimpleCalendarStatus(),
    weekKey,
    calendarLabel: label,
    dateLabel: label,
    timeLabel: "",
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
    const status = getSimpleCalendarStatus();
    const api = getSimpleCalendarApi();
    if (!status.ready || !api) return null;

    const display = safeCall(() => api.currentDateTimeDisplay?.());
    const currentDate = safeCall(() => api.currentDateTime?.());
    const timestamp = safeCall(() => api.timestamp?.());
    const timestampDate = Number.isFinite(Number(timestamp))
      ? safeCall(() => api.timestampToDate?.(Number(timestamp)))
      : null;
    const currentCalendar = safeCall(() => api.getCurrentCalendar?.());

    const dateLabel = getDisplayDate(display, timestampDate, currentDate);
    const timeLabel = getDisplayTime(display, timestampDate);
    const calendarLabel = [dateLabel, timeLabel].filter(Boolean).join(" - ");
    const week = getWeekIndex(api, timestamp, currentDate, timestampDate);
    const year = currentDate?.year ?? timestampDate?.year ?? display?.year ?? "year";
    const month = currentDate?.month ?? timestampDate?.month ?? display?.month ?? "month";
    const day = currentDate?.day ?? timestampDate?.day ?? display?.day ?? "day";
    const calendarId = currentCalendar?.id ?? "active";
    const dateKey = dateLabel || [year, month, day].filter((part) => part !== undefined && part !== null).join("-");

    return {
      source: "simple-calendar-reborn",
      simpleCalendarActive: true,
      simpleCalendarStatus: status,
      weekKey: slugify(`${calendarId}-${dateKey}`),
      calendarLabel,
      dateLabel,
      timeLabel,
      rawDate: currentDate ?? null,
      displayData: display ?? timestampDate?.display ?? null,
      timestamp: Number.isFinite(Number(timestamp)) ? Number(timestamp) : null,
      weekIndex: week,
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

function getSimpleCalendarApi() {
  return globalThis.SimpleCalendar?.api ?? null;
}

function getDisplayDate(display, timestampDate, currentDate) {
  const timestampDisplay = timestampDate?.display;
  const date = display?.date ?? timestampDisplay?.date;
  if (date) return String(date);

  const year = currentDate?.year ?? timestampDate?.year;
  const month = currentDate?.month ?? timestampDate?.month;
  const day = currentDate?.day ?? timestampDate?.day;
  return [year, month, day].filter((part) => part !== undefined && part !== null).join("-");
}

function getDisplayTime(display, timestampDate) {
  return String(display?.time ?? timestampDate?.display?.time ?? "").trim();
}

function getWeekIndex(api, timestamp, currentDate, timestampDate) {
  if (Number.isFinite(Number(timestamp))) {
    const timeConfig = safeCall(() => api.getTimeConfiguration?.()) ?? {};
    const weekdays = safeCall(() => api.getAllWeekdays?.()) ?? [];
    const secondsPerMinute = positiveNumber(timeConfig.secondsInMinute, 60);
    const minutesPerHour = positiveNumber(timeConfig.minutesInHour, 60);
    const hoursPerDay = positiveNumber(timeConfig.hoursInDay, 24);
    const daysPerWeek = Array.isArray(weekdays) && weekdays.length > 0 ? weekdays.length : 7;
    const secondsPerWeek = secondsPerMinute * minutesPerHour * hoursPerDay * daysPerWeek;
    if (secondsPerWeek > 0) return Math.floor(Number(timestamp) / secondsPerWeek);
  }

  const day = Number(currentDate?.day ?? timestampDate?.day ?? 0);
  return Math.max(1, Math.ceil((Number.isFinite(day) ? day + 1 : 1) / 7));
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function safeCall(callback) {
  try {
    return callback();
  } catch {
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
