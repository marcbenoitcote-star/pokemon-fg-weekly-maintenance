import {
  MAINTENANCE_SKILL_KEYS,
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

const SKILL_OBJECT_PATH_PATTERNS = [
  "system.skills.{skill}",
  "system.skills.skills.{skill}",
  "attributes.skills.{skill}",
  "system.attributes.skills.{skill}"
];

const SKILL_LEGACY_NUMBER_PATH_PATTERNS = [
  "system.skills.skills.{skill}.value.value",
  "system.skills.skills.{skill}.value",
  "system.skills.{skill}.value.total",
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
  const definition = TRAINER_SKILLS.find((skill) => skill.key === skillKey);
  const objectPaths = SKILL_OBJECT_PATH_PATTERNS.map((pattern) => pattern.replace("{skill}", skillKey));
  const foundObject = readFirstObject(actor, objectPaths);
  const legacyPaths = SKILL_LEGACY_NUMBER_PATH_PATTERNS.map((pattern) => pattern.replace("{skill}", skillKey));
  const legacy = foundObject ? null : readFirstNumber(actor, legacyPaths);
  const skillData = foundObject?.value;
  const globalSkillBonus = readFirstNumber(actor, ["system.modifiers.skillBonus.total"])?.value ?? 0;

  const base = skillData ? readFirstNumberInObject(skillData, ["value.value", "base", "value.base", "value"]) : null;
  const bonus = skillData ? readFirstNumberInObject(skillData, ["value.mod", "value.bonus", "mod"]) : null;
  let total = skillData ? readFirstNumberInObject(skillData, ["value.total", "total", "rankValue"]) : null;

  if (total === null && (base !== null || bonus !== null)) {
    total = (base ?? 0) + (bonus ?? 0);
  }

  if (total === null && typeof skillData?.rank === "string") {
    total = rankSlugToValue(skillData.rank);
  }

  if (total === null && legacy) {
    total = legacy.value;
  }

  const modifierBase = skillData ? readFirstNumberInObject(skillData, ["modifier.value", "modifier.base"]) : null;
  const modifierBonus = skillData ? readFirstNumberInObject(skillData, ["modifier.mod", "modifier.bonus"]) : null;
  let modifierTotal = skillData ? readFirstNumberInObject(skillData, ["modifier.total", "modifierTotal"]) : null;

  if (modifierTotal === null && (modifierBase !== null || modifierBonus !== null)) {
    modifierTotal = (modifierBase ?? 0) + (modifierBonus ?? 0) + globalSkillBonus;
  }

  const missing = total === null;
  const value = clampRank(total ?? 0);
  const modTotal = Math.trunc(Number(modifierTotal ?? 0)) || 0;
  const diceCount = value > 0 ? Math.min(value, 6) : 0;
  const source = foundObject?.source ?? legacy?.source ?? "default";

  if (missing) warnMissing(actor, `skill ${skillKey}`, [...objectPaths, ...legacyPaths]);

  return {
    key: skillKey,
    label: definition?.label ?? skillKey,
    value,
    rank: value,
    rankLabel: RANK_LABELS[value] ?? RANK_LABELS[0],
    base: base ?? value,
    bonus: bonus ?? 0,
    total: value,
    modifierBase: modifierBase ?? modTotal,
    modifierBonus: modifierBonus ?? 0,
    modifierTotal: modTotal,
    diceCount,
    diceFormula: formatDiceFormula(diceCount, modTotal),
    totalDetail: formatTotalDetail(base, bonus, value, missing),
    modifierDetail: formatTotalDetail(modifierBase, modifierBonus, modTotal, false),
    source,
    missing
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
  const selectedSkill = options.skillKey ? getSkillRank(actor, options.skillKey) : bestSkill;
  const levelPR = Math.max(1, Math.floor(level.value / 10));
  const powerPR = Math.floor(power.value / 2);
  const skillPR = selectedSkill.value;
  const totalPR = levelPR + powerPR + skillPR;

  return {
    actor,
    mode,
    level,
    power,
    bestSkill,
    selectedSkill,
    skill: selectedSkill,
    usesBestSkill: selectedSkill.key === bestSkill.key,
    levelPR,
    powerPR,
    skillPR,
    totalPR,
    totalPRQ: toPRQ(totalPR),
    detail: `Niveau ${level.value} = ${levelPR} PR; Power ${power.value} = ${powerPR} PR; ${selectedSkill.label} ${selectedSkill.rankLabel} (${selectedSkill.totalDetail}) = ${skillPR} PR`
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

export function getSkillOptions(actor, selectedKey = "generalEd", skillKeys = MAINTENANCE_SKILL_KEYS) {
  return skillKeys.map((key) => TRAINER_SKILLS.find((skill) => skill.key === key) ?? { key, label: key }).map((skill) => {
    const rank = actor ? getSkillRank(actor, skill.key) : null;
    return {
      ...skill,
      selected: skill.key === selectedKey,
      rank: rank?.value ?? 0,
      total: rank?.total ?? 0,
      totalDetail: rank?.totalDetail ?? "0",
      modifierTotal: rank?.modifierTotal ?? 0,
      diceFormula: rank?.diceFormula ?? "0d6",
      rankLabel: rank?.rankLabel ?? RANK_LABELS[0]
    };
  });
}

export function getWorkRateForRank(rank) {
  const configuredMinimum = Number(globalThis.game?.settings?.get?.(MODULE_ID, "minimumWorkRate") ?? 0) || 0;
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

function readFirstObject(actor, paths) {
  for (const path of paths) {
    const value = readPath(actor, path);
    if (value && typeof value === "object" && !Array.isArray(value)) return { value, source: path };
  }
  return null;
}

function readFirstNumberInObject(source, paths) {
  for (const path of paths) {
    const value = coerceNumber(readNested(source, path));
    if (value !== null) return value;
  }
  return null;
}

function readPath(actor, path) {
  if (!actor || !path) return undefined;
  if (globalThis.foundry?.utils?.getProperty) return globalThis.foundry.utils.getProperty(actor, path);

  return path.split(".").reduce((value, key) => value?.[key], actor);
}

function readNested(source, path) {
  return path.split(".").reduce((value, key) => value?.[key], source);
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
  return Math.min(8, Math.max(0, number));
}

function rankSlugToValue(rank) {
  switch (String(rank ?? "").toLowerCase()) {
    case "pathetic": return 1;
    case "untrained": return 2;
    case "novice": return 3;
    case "adept": return 4;
    case "expert": return 5;
    case "master": return 6;
    case "virtuoso":
    case "virtuose": return 8;
    default: return null;
  }
}

function formatDiceFormula(diceCount, modifier) {
  if (!modifier) return `${diceCount}d6`;
  return `${diceCount}d6${modifier > 0 ? "+" : ""}${modifier}`;
}

function formatTotalDetail(base, bonus, total, missing) {
  if (missing) return "Non detecte";
  if (base !== null && bonus !== null && bonus !== 0) return `${base} ${bonus > 0 ? "+" : ""}${bonus} = ${total}`;
  if (base !== null && bonus !== null && base !== total) return `${base} = ${total}`;
  if (base !== null && bonus !== null) return `${base}`;
  return `${total}`;
}

function warnMissing(actor, label, paths) {
  if (!globalThis.game?.settings?.get?.(MODULE_ID, "debug")) return;
  console.warn(`${MODULE_ID} | Donnee PTR introuvable pour ${actor?.name ?? "Actor"}: ${label}. Chemins testes:`, paths);
}
