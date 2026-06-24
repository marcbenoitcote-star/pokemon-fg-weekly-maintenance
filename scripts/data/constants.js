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

export const GARDEN_BASE_SLOTS = 6;

export const GARDEN_PLANT_TYPES = [
  { key: "berry", label: "Berry" },
  { key: "flower", label: "Flower" },
  { key: "herb", label: "Herb" },
  { key: "mushroom", label: "Mushroom" },
  { key: "apricorn", label: "Apricorn" }
];

export const GARDEN_TIERS = [
  { key: "1", label: "Tier 1", value: 1 },
  { key: "2", label: "Tier 2", value: 2 },
  { key: "3", label: "Tier 3", value: 3 },
  { key: "4", label: "Tier 4", value: 4 }
];

export const CRAFTING_JOURNAL_UUID = "Compendium.ptu.journals.JournalEntry.klJMCQbOAWq5CJ9r";

export const CRAFTING_TYPES = [
  {
    key: "normal",
    label: "Objet normal",
    costPRQ: ACTIVITY_COSTS_PRQ.normalCraft,
    enabled: true
  },
  {
    key: "weapon",
    label: "Arme",
    costPRQ: ACTIVITY_COSTS_PRQ.equipmentCraft,
    enabled: true
  },
  {
    key: "armor",
    label: "Armure",
    costPRQ: ACTIVITY_COSTS_PRQ.equipmentCraft,
    enabled: true
  }
];

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

export const MAINTENANCE_SKILL_KEYS = TRAINER_SKILLS.map((skill) => skill.key);

export const PR_MAINTENANCE_SKILL_KEYS = [
  "generalEd",
  "medicineEd",
  "occultEd",
  "pokemonEd",
  "techEd",
  "survival"
];

export const PR_SKILL_KEYS = {
  work: PR_MAINTENANCE_SKILL_KEYS,
  crafting: PR_MAINTENANCE_SKILL_KEYS,
  harvest: PR_MAINTENANCE_SKILL_KEYS,
  gardening: PR_MAINTENANCE_SKILL_KEYS
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
    enabled: true
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
    enabled: true
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

export const REACH_CAPABILITY_UUID = "Compendium.ptu.capabilities.Item.o7NdOFXqtOAIFv6x";

export const WEAPON_CRAFTING_CATEGORIES = [
  {
    key: "melee",
    label: "Melee Weapon",
    bases: [
      { key: "oneHand", label: "Arme à une main", cost: 3500, hands: "one", rangeLabel: "Mêlée" },
      { key: "twoHand", label: "Arme à deux mains", cost: 3500, hands: "two", rangeLabel: "Mêlée" },
      { key: "twoHandReach", label: "Arme à deux mains (Reach)", cost: 6000, hands: "two", rangeLabel: "Mêlée, Reach", reach: true }
    ],
    tier1: [
      weaponMove("wounderingStrike", "Woundering Strike", "Compendium.ptu.moves.Item.9VRUW0ZlzwcKeTo4"),
      weaponMove("doubleSwipe", "Double Swipe", "Compendium.ptu.moves.Item.GOI7IN8pMcHuAl9D"),
      weaponMove("cheapShot", "Cheap Shot", "Compendium.ptu.moves.Item.zsY2MziAKDJxQ3sT"),
      weaponMove("beatdown", "Beatdown", "Compendium.ptu.moves.Item.kSSdk67IXNzqXAX8", { twoHandedOnly: true }),
      weaponMove("backswing", "Backswing", "Compendium.ptu.moves.Item.wbvuoi8cQC5qvBJX", { twoHandedOnly: true }),
      weaponMove("pierce", "Pierce", "Compendium.ptu.moves.Item.rFOaowdRV71WvhAC"),
      weaponMove("weakeningBlow", "Weakening Blow", "Compendium.ptu.moves.Item.ZuYGurNefQQspmWM")
    ],
    tier2: [
      weaponMove("titanicSlam", "Titanic Slam", "Compendium.ptu.moves.Item.ddKyAoSyhnbTw8Eo"),
      weaponMove("furiousStrikes", "Furious Strikes", ["Compendium.ptu.moves.Item.ddKyAoSyhnbTw8Eo", "Compendium.ptu.moves.Item.7MlnuknpZBXKzzyl"]),
      weaponMove("slicingStrike", "Slicing Strike", "Compendium.ptu.moves.Item.i0oeZ6ZKzLWl2Oi3"),
      weaponMove("wildWhirlwind", "Wild Whirlwind", "Compendium.ptu.moves.Item.jtTlXPTwmgZiKuHa", { twoHandedOnly: true }),
      weaponMove("maul", "Maul", "Compendium.ptu.moves.Item.VvH7l4lRSfz7Z12n", { twoHandedOnly: true }),
      weaponMove("parry", "Parry", "Compendium.ptu.moves.Item.wxMDjbyMhhvrWQzm"),
      weaponMove("deadlyStrike", "Deadly Strike", "Compendium.ptu.moves.Item.zG2EOJBUkf3QYwcf"),
      weaponMove("counterStrike", "Counter Strike", "Compendium.ptu.moves.Item.WKyBlBUFxny0WyDh"),
      weaponMove("riposte", "Riposte", "Compendium.ptu.moves.Item.o9ya4793lC8vxcbA")
    ]
  },
  {
    key: "ranged",
    label: "Ranged Weapon",
    bases: [
      { key: "oneHandRange4", label: "Arme à une main (Range 4)", cost: 3500, hands: "one", rangeLabel: "Range 4" },
      { key: "twoHandRange8", label: "Arme à deux mains (Range 8)", cost: 7000, hands: "two", rangeLabel: "Range 8" },
      { key: "twoHandRange12", label: "Arme à deux mains (Range 12, -1 Accuracy)", cost: 5000, hands: "two", rangeLabel: "Range 12", accuracyPenalty: -1 }
    ],
    tier1: [
      weaponMove("salvo", "Salvo", "Compendium.ptu.moves.Item.WC1cPVvgaOJIOhP3"),
      weaponMove("quickDraw", "Quick Draw", "Compendium.ptu.moves.Item.IjcppDrse8Ps2Prz"),
      weaponMove("bullseye", "Bullseye", "Compendium.ptu.moves.Item.6Y12ln1yceyXiBt4"),
      weaponMove("takeAim", "Take Aim", "Compendium.ptu.moves.Item.WfesNtj171NVSa7T")
    ],
    tier2: [
      weaponMove("furiousStrike", "Furious Strike", ["Compendium.ptu.moves.Item.ddKyAoSyhnbTw8Eo", "Compendium.ptu.moves.Item.7MlnuknpZBXKzzyl"]),
      weaponMove("tripleThreats", "Triple Threats", "Compendium.ptu.moves.Item.k4AF0guLko7sAXMP"),
      weaponMove("deadlyStrike", "Deadly Strike", "Compendium.ptu.moves.Item.zG2EOJBUkf3QYwcf"),
      weaponMove("retaliation", "Retaliation", "Compendium.ptu.moves.Item.t9hZfq9V5oCsnnTw")
    ]
  },
  {
    key: "magicMelee",
    label: "Magic Melee Weapon",
    bases: [
      { key: "oneHand", label: "Arme à une main", cost: 4000, hands: "one", rangeLabel: "Mêlée" },
      { key: "twoHand", label: "Arme à deux mains", cost: 5000, hands: "two", rangeLabel: "Mêlée" },
      { key: "twoHandReach", label: "Arme à deux mains (Reach)", cost: 7000, hands: "two", rangeLabel: "Mêlée, Reach", reach: true }
    ],
    tier1: [
      weaponMove("energyBlast", "Energy Blast", "Compendium.ptu.moves.Item.t9hZfq9V5oCsnnTw"),
      weaponMove("resonanceBeam", "Resonance Beam", "Compendium.ptu.moves.Item.QKuZ4HSPO2133gMt"),
      weaponMove("arcaneFury", "Arcane Fury", "Compendium.ptu.moves.Item.ymd1Byw1ops6Ndt0"),
      weaponMove("secretForce", "Secret Force", "Compendium.ptu.moves.Item.fUMQYovI9X8sWko4"),
      weaponMove("soundBlast", "Sound Blast", "Compendium.ptu.moves.Item.tVYQdCvTvKbJGDPf", { musicalSurcharge: 6000 })
    ],
    tier2: [
      weaponMove("magicBurst", "Magic Burst", "Compendium.ptu.moves.Item.8I3gxChoRNjRE0js"),
      weaponMove("spiritLance", "Spirit Lance", "Compendium.ptu.moves.Item.gzf7cCPQeZjDWpDZ"),
      weaponMove("coneOfForce", "Cone of Force", "Compendium.ptu.moves.Item.KT1jFu6OZhCI4fBr"),
      weaponMove("bane", "Bane", "Compendium.ptu.moves.Item.KT1jFu6OZhCI4fBr")
    ]
  },
  {
    key: "magicRanged",
    label: "Magic Ranged Weapon",
    bases: [
      { key: "oneHandRange4", label: "Arme à une main (Range 4)", cost: 4000, hands: "one", rangeLabel: "Range 4" },
      { key: "twoHandRange8", label: "Arme à deux mains (Range 8)", cost: 9000, hands: "two", rangeLabel: "Range 8" },
      { key: "twoHandRange12", label: "Arme à deux mains (Range 12, -1 Accuracy)", cost: 6000, hands: "two", rangeLabel: "Range 12", accuracyPenalty: -1 }
    ],
    tier1: [
      weaponMove("energyBlast", "Energy Blast", "Compendium.ptu.moves.Item.Qfmw3pH1a3lY3oPn"),
      weaponMove("rendingSpell", "Rending Spell", "Compendium.ptu.moves.Item.ZM0YCsgnQsxbM9q4"),
      weaponMove("energySphere", "Energy Sphere", "Compendium.ptu.moves.Item.Xvvj4B5TzwsPZKBu"),
      weaponMove("resonanceBeam", "Resonance Beam", "Compendium.ptu.moves.Item.Xvvj4B5TzwsPZKBu"),
      weaponMove("magicMissile", "Magic Missile", "Compendium.ptu.moves.Item.9UFVCayZI7el6rhT"),
      weaponMove("downbeatPulse", "Downbeat Pulse", "Compendium.ptu.moves.Item.yMav4W0QbS8OJThK", { musicalSurcharge: 6000 }),
      weaponMove("reliableHarmony", "Reliable Harmony", "Compendium.ptu.moves.Item.yMav4W0QbS8OJThK", { musicalSurcharge: 6000 }),
      weaponMove("inspiringMelody", "Inspiring Melody", "Compendium.ptu.moves.Item.AakykBntwz4LmUxM", { musicalSurcharge: 6000 }),
      weaponMove("healingAria", "Healing Aria", "Compendium.ptu.moves.Item.iVDpnKjLGiBCqT7J", { musicalSurcharge: 6000 }),
      weaponMove("enfeebingMelody", "Enfeebing Melody", "Compendium.ptu.moves.Item.V211EHKa3zP4XyBN", { musicalSurcharge: 6000 }),
      weaponMove("enhancedMusic", "Enhanced Music", "Compendium.ptu.moves.Item.rO2SSw7K4k9mJnqe", { musicalSurcharge: 9000 })
    ],
    tier2: [
      weaponMove("energyVortex", "Energy Vortex", "Compendium.ptu.moves.Item.Ev3Gp9ljvOQCI6H1"),
      weaponMove("arcaneStorm", "Arcane Storm", "Compendium.ptu.moves.Item.v4QE3cM0quFPrFz1"),
      weaponMove("bane", "Bane", "Compendium.ptu.moves.Item.KT1jFu6OZhCI4fBr"),
      weaponMove("spiritLance", "Spirit Lance", "Compendium.ptu.moves.Item.gzf7cCPQeZjDWpDZ"),
      weaponMove("coneOfForce", "Cone of Force", "Compendium.ptu.moves.Item.KT1jFu6OZhCI4fBr"),
      weaponMove("magicFlare", "Magic Flare", "Compendium.ptu.moves.Item.AkAwfsOvRhrnLJRH"),
      weaponMove("sonicWave", "Sonic Wave", "Compendium.ptu.moves.Item.mXw4sg2bLcqejFSm", { musicalSurcharge: 9000 }),
      weaponMove("sonicBurst", "Sonic Burst", "Compendium.ptu.moves.Item.yZopWQ18BIzJmtMw", { musicalSurcharge: 9000 }),
      weaponMove("healingSymphony", "Healing Symphony", "Compendium.ptu.moves.Item.7taxjJkFBtnpZq15", { musicalSurcharge: 9000 }),
      weaponMove("enhancedMusic", "Enhanced Music", "Compendium.ptu.moves.Item.rO2SSw7K4k9mJnqe", { musicalSurcharge: 9000 }),
      weaponMove("cripplingMelody", "Crippling Melody", "Compendium.ptu.moves.Item.jQbpNQZbD4hUlnoW", { musicalSurcharge: 9000 }),
      weaponMove("hauntingTune", "Haunting Tune", "Compendium.ptu.moves.Item.zry9mqznkSZdDQF9", { musicalSurcharge: 9000 })
    ]
  },
  {
    key: "shield",
    label: "Shield Weapon",
    bases: [
      {
        key: "lightShield",
        label: "Bouclier léger",
        cost: 3500,
        shield: "light",
        evasionBonus: 1,
        effectUuid: "Compendium.ptu.effects.Item.VEJwFmRF7al1iVH9",
        actionDescription: "Action standard: +4 Evasion et +10 Damage Reduction jusqu'au prochain tour, puis Ralenti Status Affliction pendant le bonus."
      },
      {
        key: "heavyShield",
        label: "Bouclier lourd",
        cost: 7000,
        shield: "heavy",
        evasionBonus: 2,
        effectUuid: "Compendium.ptu.effects.Item.5OY0BP3rdka8VYbJ",
        actionDescription: "Action standard: +6 Evasion et +15 Damage Reduction jusqu'au prochain tour, puis Stuck Status Affliction pendant le bonus."
      }
    ],
    tier1: [
      weaponMove("fortify", "Fortify", "Compendium.ptu.moves.Item.U9XXFUYs0UH7SReR"),
      weaponMove("shieldWall", "Shield Wall", "Compendium.ptu.moves.Item.KheJ6bfJeNAury1E"),
      weaponMove("mysticProtection", "Mystic Protection", "Compendium.ptu.moves.Item.jzAgwbjb2FrHYign"),
      weaponMove("weakeningBlow", "Weakening Blow", "Compendium.ptu.moves.Item.ZuYGurNefQQspmWM"),
      weaponMove("backswing", "Backswing", "Compendium.ptu.moves.Item.acJtto581m32psdd", { heavyOnly: true })
    ],
    tier2: [
      weaponMove("parry", "Parry", "Compendium.ptu.moves.Item.wxMDjbyMhhvrWQzm"),
      weaponMove("shieldWall", "Shield Wall", "Compendium.ptu.moves.Item.KheJ6bfJeNAury1E"),
      weaponMove("mysticProtection", "Mystic Protection", "Compendium.ptu.moves.Item.jzAgwbjb2FrHYign"),
      weaponMove("protect", "Protect", "Compendium.ptu.moves.Item.9hEiBDnQjTv5pyHC"),
      weaponMove("deflect", "Deflect", "Compendium.ptu.moves.Item.nmAgmPnRV07hnK0M"),
      weaponMove("counterStrike", "Counter Strike", "Compendium.ptu.moves.Item.WKyBlBUFxny0WyDh"),
      weaponMove("riposte", "Riposte", "Compendium.ptu.moves.Item.o9ya4793lC8vxcbA"),
      weaponMove("retaliation", "Retaliation", "Compendium.ptu.moves.Item.o9ya4793lC8vxcbA"),
      weaponMove("maul", "Maul", "Compendium.ptu.moves.Item.VvH7l4lRSfz7Z12n", { heavyOnly: true })
    ]
  }
];

function weaponMove(key, label, uuids, options = {}) {
  return {
    key,
    label,
    uuids: Array.isArray(uuids) ? uuids : [uuids],
    ...options
  };
}
