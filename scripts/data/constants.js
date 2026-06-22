export const MODULE_ID = "pokemon-fg-weekly-maintenance";
export const SYSTEM_ID = "ptu";

export const MODULE_TITLE = "Pokémon FG - Entretien Hebdomadaire";

export const TEMPLATES = {
  app: `modules/${MODULE_ID}/templates/maintenance-app.hbs`,
  chatSummary: `modules/${MODULE_ID}/templates/chat-summary.hbs`,
  chatRollCard: `modules/${MODULE_ID}/templates/chat-roll-card.hbs`
};

export const SETTINGS = {
  strictActivityMode: "strictActivityMode",
  debug: "debug",
  lockWeeks: "lockWeeks",
  minimumWorkRate: "minimumWorkRate",
  maxBonusGardenSlots: "maxBonusGardenSlots",
  harvestRollUsesSkillDice: "harvestRollUsesSkillDice",
  freeReplantThreshold: "freeReplantThreshold"
};

export const FLAGS = {
  weeks: "weeks"
};

export const PRQ_PER_PR = 4;

export const ACTIVITY_KEYS = {
  work: "work",
  crafting: "crafting",
  pokemonHarvest: "pokemonHarvest",
  gardening: "gardening"
};

export const ACTIVITY_COSTS_PRQ = {
  work: 8,
  normalCraft: 1,
  equipmentCraft: 4,
  simplePokemonHarvest: 8,
  professionalPokemonHarvest: 12,
  advancedPokemonHarvest: 16,
  rarePokemonHarvest: 36,
  gardenHarvest: 1
};

export const RANK_LABELS = {
  0: "Inconnu",
  1: "Pathetic",
  2: "Untrained",
  3: "Novice",
  4: "Adept",
  5: "Expert",
  6: "Master",
  7: "Virtuoso",
  8: "Virtuoso"
};

export const WORK_RATES = {
  1: 0,
  2: 0,
  3: 50,
  4: 100,
  5: 150,
  6: 250,
  7: 300,
  8: 300
};

export const TRAINER_SKILLS = [
  { key: "acrobatics", label: "Acrobatics" },
  { key: "athletics", label: "Athletics" },
  { key: "charm", label: "Charm" },
  { key: "combat", label: "Combat" },
  { key: "command", label: "Command" },
  { key: "generalEd", label: "General Education" },
  { key: "medicineEd", label: "Medicine Education" },
  { key: "occultEd", label: "Occult Education" },
  { key: "pokemonEd", label: "Pokémon Education" },
  { key: "techEd", label: "Technology Education" },
  { key: "focus", label: "Focus" },
  { key: "guile", label: "Guile" },
  { key: "intimidate", label: "Intimidate" },
  { key: "intuition", label: "Intuition" },
  { key: "perception", label: "Perception" },
  { key: "stealth", label: "Stealth" },
  { key: "survival", label: "Survival" }
];

export const MAINTENANCE_SKILL_KEYS = [
  "generalEd",
  "occultEd",
  "medicineEd",
  "pokemonEd",
  "techEd",
  "survival"
];

export const PR_SKILL_KEYS = {
  work: MAINTENANCE_SKILL_KEYS,
  crafting: MAINTENANCE_SKILL_KEYS,
  harvest: MAINTENANCE_SKILL_KEYS,
  gardening: MAINTENANCE_SKILL_KEYS
};

export const ACTIVITY_OPTIONS = [
  {
    key: ACTIVITY_KEYS.work,
    icon: "fas fa-briefcase",
    title: "Petit Travail",
    description: "Jets 1d6 x taux du rang, avec option d'appliquer les gains au Trainer.",
    enabled: true
  },
  {
    key: ACTIVITY_KEYS.crafting,
    icon: "fas fa-hammer",
    title: "Fabrication",
    description: "Drag & drop d'objet, ingredients reserves, argent et inventaire.",
    enabled: false
  },
  {
    key: ACTIVITY_KEYS.pokemonHarvest,
    icon: "fas fa-leaf",
    title: "Récolte Pokémon",
    description: "Validation Pokémon, Friendship, niveau et Capability.",
    enabled: true
  },
  {
    key: ACTIVITY_KEYS.gardening,
    icon: "fas fa-seedling",
    title: "Agriculture / Jardinage",
    description: "Planting Stage, Growth Stage, Harvest Stage et Yield Rolls.",
    enabled: false
  }
];

export const DEFAULT_WEEK_DATA = {
  weekName: "",
  rpDate: "",
  eventName: "",
  eventDescription: ""
};

export const HARVEST_RESULT_TYPES = {
  item: "item",
  rollTable: "rollTable",
  info: "info"
};

export const POKEMON_HARVEST_OPTIONS = [
  {
    key: "honeyGather",
    label: "Honey Gather",
    category: "Récolte simple",
    costPRQ: ACTIVITY_COSTS_PRQ.simplePokemonHarvest,
    resultType: HARVEST_RESULT_TYPES.item,
    resultUuid: "Compendium.ptu.items.Item.Op2TZv6Qoz4Y65e2",
    resultLabel: "Honey"
  },
  {
    key: "mushroomHarvest",
    label: "Mushroom Harvest",
    category: "Récolte simple",
    costPRQ: ACTIVITY_COSTS_PRQ.simplePokemonHarvest,
    resultType: HARVEST_RESULT_TYPES.rollTable,
    resultUuid: "Compendium.ptu.rolltables.RollTable.Jz0g9IlGs00xj9u4",
    resultLabel: "Table Mushroom Harvest"
  },
  {
    key: "dreamMist",
    label: "Dream Mist",
    category: "Récolte simple",
    costPRQ: ACTIVITY_COSTS_PRQ.simplePokemonHarvest,
    resultType: HARVEST_RESULT_TYPES.item,
    resultUuid: "Compendium.ptu.items.Item.xQ0rqoDEsPAR4uP8",
    resultLabel: "Dream Mist"
  },
  {
    key: "milkCollection",
    label: "Milk Collection",
    category: "Récolte simple",
    costPRQ: ACTIVITY_COSTS_PRQ.simplePokemonHarvest,
    resultType: HARVEST_RESULT_TYPES.item,
    resultUuid: "Compendium.ptu.items.Item.YswiehoUnTqeuvg2",
    resultLabel: "Milk"
  },
  {
    key: "fortune",
    label: "Fortune",
    category: "Récolte simple",
    costPRQ: ACTIVITY_COSTS_PRQ.simplePokemonHarvest,
    resultType: HARVEST_RESULT_TYPES.rollTable,
    resultUuid: "Compendium.ptu.rolltables.RollTable.QEnQIcCZMSLbQhwh",
    resultLabel: "Table Fortune"
  },
  {
    key: "herbGrowth",
    label: "Herb Growth",
    category: "Récolte simple",
    costPRQ: ACTIVITY_COSTS_PRQ.simplePokemonHarvest,
    resultType: HARVEST_RESULT_TYPES.rollTable,
    resultUuid: "Compendium.ptu.rolltables.RollTable.hKHeP9ynrhTGSY21",
    resultLabel: "Table Herb Growth"
  },
  {
    key: "juicerJuice",
    label: "Juicer - Jus seulement",
    category: "Récolte simple",
    costPRQ: ACTIVITY_COSTS_PRQ.simplePokemonHarvest,
    resultType: HARVEST_RESULT_TYPES.item,
    resultUuid: "Compendium.ptu.items.Item.7fMNsUfMhbr6ZB8W",
    resultLabel: "Juicer / Jus"
  },
  {
    key: "fossilResearch",
    label: "Fossil Research",
    category: "Récolte professionnelle",
    costPRQ: ACTIVITY_COSTS_PRQ.professionalPokemonHarvest,
    resultType: HARVEST_RESULT_TYPES.rollTable,
    resultUuid: "Compendium.ptu.rolltables.RollTable.nExmlR2WmxPcWdKY",
    resultLabel: "Table Fossil Research",
    skipPokemonRequirement: true,
    requiresPaleontologyConfirmation: true
  },
  {
    key: "nectarDancer",
    label: "Nectar Dancer",
    category: "Récolte avancée",
    costPRQ: ACTIVITY_COSTS_PRQ.advancedPokemonHarvest,
    resultType: HARVEST_RESULT_TYPES.info,
    resultLabel: "Aucun item valide actuel; noter la récolte dans le chat",
    requiresTwoOricorio: true
  },
  {
    key: "pickup",
    label: "Pickup",
    category: "Récolte avancée",
    costPRQ: ACTIVITY_COSTS_PRQ.advancedPokemonHarvest,
    resultType: HARVEST_RESULT_TYPES.rollTable,
    resultUuid: "Compendium.ptu.rolltables.RollTable.s0b5aT318cnMx8fX",
    resultLabel: "Table Pickup"
  },
  {
    key: "juicerRareCandy",
    label: "Juicer - Rare Candy",
    category: "Récolte avancée",
    costPRQ: ACTIVITY_COSTS_PRQ.advancedPokemonHarvest,
    resultType: HARVEST_RESULT_TYPES.item,
    resultUuid: "Compendium.ptu.items.Item.35X4PEOomwgAFvwa",
    resultLabel: "Rare Candy",
    requiresRareCandyIngredient: true,
    ingredientLabel: "Shuckle's Berry Juice"
  },
  {
    key: "heartGift",
    label: "Heart Gift",
    category: "Récolte avancée",
    costPRQ: ACTIVITY_COSTS_PRQ.advancedPokemonHarvest,
    resultType: HARVEST_RESULT_TYPES.item,
    resultUuid: "Compendium.ptu.items.Item.MVgde5bSqt7dgxDk",
    resultLabel: "Heart Scale / Heart Gift"
  },
  {
    key: "gatherUnown",
    label: "Gather Unown",
    category: "Récolte très rare",
    costPRQ: ACTIVITY_COSTS_PRQ.rarePokemonHarvest,
    resultType: HARVEST_RESULT_TYPES.info,
    resultLabel: "Information uniquement dans le chat"
  }
];
