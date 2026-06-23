import { MODULE_ID, MODULE_TITLE, SETTINGS, SYSTEM_ID, TEMPLATES } from "./data/constants.js";
import { PfgMaintenanceApp } from "./apps/maintenance-app.js";
import * as PRService from "./services/pr-service.js";
import * as CalendarService from "./services/calendar-service.js";
import * as ItemService from "./services/item-service.js";
import * as PokemonService from "./services/pokemon-service.js";
import * as ChatService from "./services/chat-service.js";

Hooks.once("init", async () => {
  registerSettings();
  await loadTemplates(Object.values(TEMPLATES));
});

Hooks.once("ready", () => {
  exposeApi();

  if (game.system.id !== SYSTEM_ID) {
    console.warn(`${MODULE_ID} | Systeme ${game.system.id} detecte. Le module est prevu pour ${SYSTEM_ID}.`);
    return;
  }

  console.log(`${MODULE_ID} | Pret.`);
});

function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.strictActivityMode, {
    name: "PFG_MAINTENANCE.Settings.StrictActivityMode.Name",
    hint: "PFG_MAINTENANCE.Settings.StrictActivityMode.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.lockWeeks, {
    name: "PFG_MAINTENANCE.Settings.LockWeeks.Name",
    hint: "PFG_MAINTENANCE.Settings.LockWeeks.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.minimumWorkRate, {
    name: "PFG_MAINTENANCE.Settings.MinimumWorkRate.Name",
    hint: "PFG_MAINTENANCE.Settings.MinimumWorkRate.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 0
  });

  game.settings.register(MODULE_ID, SETTINGS.maxBonusGardenSlots, {
    name: "PFG_MAINTENANCE.Settings.MaxBonusGardenSlots.Name",
    hint: "PFG_MAINTENANCE.Settings.MaxBonusGardenSlots.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 6
  });

  game.settings.register(MODULE_ID, SETTINGS.harvestRollUsesSkillDice, {
    name: "PFG_MAINTENANCE.Settings.HarvestRollUsesSkillDice.Name",
    hint: "PFG_MAINTENANCE.Settings.HarvestRollUsesSkillDice.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.freeReplantThreshold, {
    name: "PFG_MAINTENANCE.Settings.FreeReplantThreshold.Name",
    hint: "PFG_MAINTENANCE.Settings.FreeReplantThreshold.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 8
  });

  game.settings.register(MODULE_ID, SETTINGS.debug, {
    name: "PFG_MAINTENANCE.Settings.Debug.Name",
    hint: "PFG_MAINTENANCE.Settings.Debug.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
}

function exposeApi() {
  game.pfgMaintenance = {
    open: (options = {}) => new PfgMaintenanceApp(options).render(true),
    openWeaponCrafting: (options = {}) => new PfgMaintenanceApp({ ...options, startWeaponCrafting: true }).render(true),
    app: PfgMaintenanceApp,
    pr: PRService,
    calendar: CalendarService,
    item: ItemService,
    pokemon: PokemonService,
    chat: ChatService
  };

  if (game.settings.get(MODULE_ID, SETTINGS.debug)) {
    console.log(`${MODULE_ID} | API exposee sous game.pfgMaintenance.`);
  }
}
