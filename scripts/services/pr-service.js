import {
  MODULE_ID,
  PRQ_PER_PR,
  PR_SKILL_KEYS,
  RANK_LABELS,
  TRAINER_SKILLS,
  WORK_RATES
} from "../data/constants.js";

const LEVEL_PATHS = [
  "system.level.value",
  "system.level.current",
  "system.level.total",
  "system.level.milestones",
  "system.advancement.level"
];

const POWER_PATHS = [
  "system.modifiers.capabilities.power",
  "system.capabilities.power",
  "system.capabilities.other.power"
];

const SKILL_PATH_PATTERNS = [
  "system.skills.skills.{skill}.value.value",
  "system.skills.skills.{skill}.value",
  "system.skills.{skill}.value.value",
  "system.skills.{skill}.value",
  "system.skills.{skill}"
];

export function getTrainerLevel(actor, options = {}) {
  const manual = readPositiveInteger(options.manualLevel);
  if (manual !== null) {
    return { value: manual, source: "manual", missing: false };
  }

  const found = readFirstNumber(actor, LEVEL_PATHS);
  if (found) return { ...found, missing: false };

  warnMissing(actor, "niveau", LEVEL_PATHS);
  return { value: 1, source: "default", missing: true };
}

export function getPower(actor, options = {}) {
  const manual = readInteger(options.manualPower);
  if (manual !== null) {
    return { value: Math.max(0, manual), source: "manual", missing: false };
  }

  const found = readFirstNumber(actor, POWER_PATHS);
  if (found) return { ...found, value: Math.max(0, found.value), missing: false };

  warnMissing(actor, "Power", POWER_PATHS);
  return { value: 0, source: "default", missing: true };
}

export function getSkillRank(actor, skillKey) {
  const paths = SKILL_PATH_PATTERNS.map((pattern) => pattern.replace("{skill}", skillKey));
  const found = readFirstNumber(actor, paths);
  const value = found ? clampRank(found.value) : 0;
  const definition = TRAINER_SKILLS.find((skill) => skill.key === skillKey);

  if (!found) warnMissing(actor, `skill ${skillKey}`, paths);

  return {
    key: skillKey,
    label: definition?.label ?? skillKey,
    value,
    rank: value,
    rankLabel: RANK_LABELS[value] ?? RANK_LABELS[0],
    source: found?.source ?? "default",
    missing: !found
  };
}

export function getBestSkill(actor, mode = "work") {
  const keys = PR_SKILL_KEYS[mode] ?? PR_SKILL_KEYS.work;
  const skills = keys.map((key) => getSkillRank(actor, key));
  return skills.reduce((best, current) => current.value > best.value ? current : best, skills[0] ?? getSkillRank(actor, "generalEd"));
}

export function calculatePR(actor, mode = "work", options = {}) {
  const level = getTrainerLevel(actor, options);
  const power = getPower(actor, options);
  const bestSkill = getBestSkill(actor, mode);
  const levelPR = Math.max(1, Math.floor(level.value / 10));
  const powerPR = Math.floor(power.value / 2);
  const skillPR = bestSkill.value;
  const totalPR = levelPR + powerPR + skillPR;

  return {
    actor,
    mode,
    level,
    power,
    bestSkill,
    levelPR,
    powerPR,
    skillPR,
    totalPR,
    totalPRQ: toPRQ(totalPR),
    detail: `Niveau ${level.value} = ${levelPR} PR; Power ${power.value} = ${powerPR} PR; ${bestSkill.label} ${bestSkill.rankLabel} = ${skillPR} PR`
  };
}

export function toPRQ(pr) {
  return Math.round(Number(pr || 0) * PRQ_PER_PR);
}

export function fromPRQ(prq) {
  return Number(prq || 0) / PRQ_PER_PR;
}

export function formatPRQ(prq) {
  const value = Math.max(0, Math.trunc(Number(prq) || 0));
  const whole = Math.floor(value / PRQ_PER_PR);
  const quarter = value % PRQ_PER_PR;
  if (quarter === 0) return `${whole} PR`;
  if (whole === 0) return `${quarter}/4 PR`;
  return `${whole} ${quarter}/4 PR`;
}

export function getSkillOptions(actor, selectedKey = "athletics") {
  return TRAINER_SKILLS.map((skill) => {
    const rank = actor ? getSkillRank(actor, skill.key) : null;
    return {
      ...skill,
      selected: skill.key === selectedKey,
      rank: rank?.value ?? 0,
      rankLabel: rank?.rankLabel ?? RANK_LABELS[0]
    };
  });
}

export function getWorkRateForRank(rank) {
  const configuredMinimum = Number(game.settings?.get?.(MODULE_ID, "minimumWorkRate") ?? 0) || 0;
  return Math.max(WORK_RATES[clampRank(rank)] ?? 0, configuredMinimum);
}

export function getRankLabel(rank) {
  return RANK_LABELS[clampRank(rank)] ?? RANK_LABELS[0];
}

function readFirstNumber(actor, paths) {
  for (const path of paths) {
    const raw = readPath(actor, path);
    const value = coerceNumber(raw);
    if (value !== null) return { value, source: path };
  }
  return null;
}

function readPath(actor, path) {
  if (!actor || !path) return undefined;
  if (globalThis.foundry?.utils?.getProperty) return foundry.utils.getProperty(actor, path);

  return path.split(".").reduce((value, key) => value?.[key], actor);
}

function coerceNumber(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return Math.trunc(Number(raw));
  return null;
}

function readInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) ? number : null;
}

function readPositiveInteger(value) {
  const number = readInteger(value);
  return number !== null && number > 0 ? number : null;
}

function clampRank(value) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return 0;
  return Math.min(7, Math.max(0, number));
}

function warnMissing(actor, label, paths) {
  if (!game.settings?.get?.(MODULE_ID, "debug")) return;
  console.warn(`${MODULE_ID} | Donnee PTR introuvable pour ${actor?.name ?? "Actor"}: ${label}. Chemins testes:`, paths);
}
