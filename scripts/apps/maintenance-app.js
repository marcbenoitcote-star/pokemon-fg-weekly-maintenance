import {
  ACTIVITY_COSTS_PRQ,
  ACTIVITY_KEYS,
  ACTIVITY_OPTIONS,
  CRAFTING_JOURNAL_UUID,
  CRAFTING_TYPES,
  DEFAULT_WEEK_DATA,
  GARDEN_BASE_SLOTS,
  GARDEN_PLANT_TYPES,
  GARDEN_TIERS,
  HARVEST_RESULT_TYPES,
  MAINTENANCE_SKILL_KEYS,
  MODULE_ID,
  MODULE_TITLE,
  POKEMON_HARVEST_OPTIONS,
  PR_MAINTENANCE_SKILL_KEYS,
  REACH_CAPABILITY_UUID,
  SETTINGS,
  TEMPLATES,
  WEAPON_CRAFTING_CATEGORIES
} from "../data/constants.js";
import {
  calculatePR,
  formatPRQ,
  getBestSkill,
  getRankLabel,
  getSkillOptions,
  getSkillRank,
  toPRQ,
  getWorkRateForRank
} from "../services/pr-service.js";
import {
  getActorWeek,
  getCurrentWeekData,
  isWeekFinalized,
  saveWeek,
  unlockWeek
} from "../services/calendar-service.js";
import {
  addItemToActor,
  addMoney,
  deductMoney,
  getItemQuantity,
  getMoney,
  hasItemQuantity,
  removeItemQuantity,
  resolveDroppedItem
} from "../services/item-service.js";
import { getOwnedPokemonForTrainer } from "../services/pokemon-service.js";
import { postActivitySummary, postFinalSummary, postRollCard } from "../services/chat-service.js";

const STEPS = [
  { key: "trainer", label: "Trainer" },
  { key: "pr", label: "PR" },
  { key: "activity", label: "Activité" },
  { key: "work", label: "Petit Travail" },
  { key: "summary", label: "Résumé" }
];

export class PfgMaintenanceApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "pfg-maintenance-app",
      title: MODULE_TITLE,
      template: TEMPLATES.app,
      classes: ["pfg-maintenance", "sheet"],
      width: 760,
      height: "auto",
      resizable: true
    });
  }

  constructor(options = {}) {
    super(options);
    this.state = {
      step: "trainer",
      actorId: options.actorId ?? null,
      manualLevel: "",
      manualPower: "",
      prSkillKey: "generalEd",
      prBonuses: createEmptyPrBonuses(),
      calendar: { ...DEFAULT_WEEK_DATA },
      startWeaponCrafting: Boolean(options.startWeaponCrafting),
      selectedActivity: ACTIVITY_KEYS.work,
      work: {
        description: "",
        skillKey: "generalEd",
        count: 1,
        rolls: [],
        totalGain: 0
      },
      harvest: {
        harvestKey: POKEMON_HARVEST_OPTIONS[0]?.key ?? "",
        count: 1,
        pokemonId: "",
        pokemonName: "",
        secondPokemonName: "",
        ownsPokemon: false,
        paleontologyConfirmed: false,
        rareCandyIngredientConfirmed: false,
        rareCandyIngredientName: "",
        rareCandyIngredientUuid: ""
      },
      crafting: {
        itemUuid: "",
        itemName: "",
        itemType: "",
        type: "normal",
        quantity: 1,
        moneyMode: "total",
        moneyValue: 0,
        weapon: createDefaultWeaponCraftingState(),
        ingredients: []
      },
      gardening: createDefaultGardeningState(),
      activities: [],
      currentActivity: null,
      finalized: false
    };

    if (this.state.startWeaponCrafting) {
      this.state.selectedActivity = ACTIVITY_KEYS.crafting;
      this.state.crafting.type = "weapon";
    }
    if (this.state.actorId) this.state.step = this.state.startWeaponCrafting ? "crafting" : "pr";
  }

  get actor() {
    return getActorByKey(this.state.actorId);
  }

  getData() {
    const actor = this.actor;
    const trainers = getAvailableTrainers();
    if (actor) this.state.prSkillKey = normalizePrSkill(this.state.prSkillKey, "generalEd");
    const pr = actor ? calculatePR(actor, "work", {
      manualLevel: this.state.manualLevel,
      manualPower: this.state.manualPower,
      skillKey: this.state.prSkillKey
    }) : null;
    const week = getCurrentWeekData(this.state.calendar);
    const weekEntry = actor ? getActorWeek(actor, week.weekKey) : null;
    const lockWeeks = setting(SETTINGS.lockWeeks, true);
    const weekLocked = Boolean(actor && lockWeeks && isWeekFinalized(actor, week.weekKey));
    const plannedActivities = this.getPlannedActivities();
    const basePRQ = pr?.totalPRQ ?? 0;
    const budget = this.getBudgetData(basePRQ, plannedActivities);
    const totalPRQ = budget.totalPRQ;
    const spentPRQ = budget.spentPRQ;
    const remainingPRQ = budget.remainingPRQ;
    const workData = this.getWorkData(actor, budget.availableByActivity[ACTIVITY_KEYS.work] ?? 0);
    const harvestData = this.getHarvestData(actor, budget.availableByActivity[ACTIVITY_KEYS.pokemonHarvest] ?? 0);
    const craftingData = this.getCraftingData(actor, budget.availableByActivity[ACTIVITY_KEYS.crafting] ?? 0);
    const gardeningData = this.getGardeningData(actor, budget.availableByActivity[ACTIVITY_KEYS.gardening] ?? 0);
    const activityHistory = plannedActivities.map((activity, index) => ({
      ...activity,
      number: index + 1,
      isCurrent: activity === this.state.currentActivity
    }));
    const activityOptions = ACTIVITY_OPTIONS.map((activity) => ({
      ...activity,
      selected: activity.key === this.state.selectedActivity,
      disabled: !activity.enabled
    }));
    const visibleSteps = getVisibleSteps(this.state);

    return {
      moduleId: MODULE_ID,
      title: MODULE_TITLE,
      steps: visibleSteps.map((step, index) => ({
        ...step,
        active: step.key === this.state.step,
        done: visibleSteps.findIndex((entry) => entry.key === this.state.step) > index
      })),
      isTrainerStep: this.state.step === "trainer",
      isPrStep: this.state.step === "pr",
      isActivityStep: this.state.step === "activity",
      isCraftingStep: this.state.step === "crafting",
      isHarvestStep: this.state.step === "harvest",
      isGardeningStep: this.state.step === "gardening",
      isWorkStep: this.state.step === "work",
      isSummaryStep: this.state.step === "summary",
      hasTrainers: trainers.length > 0,
      trainers: trainers.map((trainer) => ({
        id: getActorKey(trainer),
        name: trainer.name,
        selected: getActorKey(trainer) === this.state.actorId
      })),
      actor,
      actorName: actor?.name ?? "",
      actorMoney: actor ? getMoney(actor) : 0,
      canApply: Boolean(actor && (actor.isOwner || game.user?.isGM)),
      canApplyCurrentActivity: Boolean(actor && this.state.currentActivity && !this.state.currentActivity.applied && (actor.isOwner || game.user?.isGM)),
      pr,
      prSkillKey: this.state.prSkillKey,
      prSkillOptions: getSkillOptions(actor, this.state.prSkillKey, PR_MAINTENANCE_SKILL_KEYS),
      basePRQ,
      basePRLabel: formatPRQ(basePRQ),
      prBonuses: budget.bonuses,
      budget,
      totalPRQ,
      totalPRLabel: formatPRQ(totalPRQ),
      spentPRQ,
      spentPRLabel: formatPRQ(spentPRQ),
      remainingPRQ,
      remainingPRLabel: formatPRQ(remainingPRQ),
      manualLevel: this.state.manualLevel,
      manualPower: this.state.manualPower,
      calendar: {
        ...this.state.calendar,
        ...week,
        manual: !week.simpleCalendarActive
      },
      weekEntry,
      weekLocked,
      canUnlockWeek: Boolean(weekLocked && game.user?.isGM),
      activityOptions,
      strictActivityMode: setting(SETTINGS.strictActivityMode, true),
      work: workData,
      harvest: harvestData,
      crafting: craftingData,
      gardening: gardeningData,
      activities: plannedActivities,
      activityHistory,
      hasActivityHistory: activityHistory.length > 0,
      currentActivity: this.state.currentActivity,
      currentActivityRolls: this.state.currentActivity?.rolls ?? [],
      hasCurrentActivity: Boolean(this.state.currentActivity),
      canStartAnotherActivity: Boolean(actor && this.state.currentActivity && !weekLocked && canStartAnyEnabledActivity(budget)),
      finalized: this.state.finalized
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.on("click", "[data-action]", (event) => {
      event.preventDefault();
      const action = event.currentTarget.dataset.action;
      this.handleAction(action, event.currentTarget.closest("form") ?? html, event.currentTarget).catch((error) => {
        console.error(`${MODULE_ID} | Action ${action} impossible.`, error);
        ui.notifications.error(`Entretien hebdomadaire: ${error.message ?? error}`);
      });
    });

    html.on("change", "select[name='actorId']", (event) => {
      this.readForm(event.currentTarget.closest("form") ?? html);
      const actor = this.actor;
      if (actor) {
        this.selectTrainer(actor);
        return;
      }
      this.render(false);
    });

    html.on("input", "input[name='weekName'], input[name='rpDate'], input[name='eventName'], textarea[name='eventDescription'], input[name='workDescription'], input[name='harvestPokemonName'], input[name='harvestSecondPokemonName'], input[name='craftWeaponName'], input[name^='garden'], textarea[name^='garden']", (event) => {
      this.updateFieldState(event.currentTarget);
    });

    html.on("change", "select[name='prSkillKey'], input[name='manualLevel'], input[name='manualPower'], input[name='bonusPR'], input[name='bonusPRCrafting'], input[name='bonusPRHarvest'], input[name='bonusPRWork'], input[name='bonusPRGardening'], select[name='workSkillKey'], input[name='workCount'], select[name='harvestKey'], input[name='harvestCount'], select[name='harvestPokemonId'], input[name='harvestOwnsPokemon'], input[name='harvestPaleontologyConfirmed'], input[name='harvestRareCandyIngredientConfirmed'], select[name='craftType'], input[name='craftQuantity'], input[name='craftMoneyMode'], input[name='craftMoneyValue'], select[name='craftWeaponCategory'], select[name='craftWeaponBase'], select[name='craftWeaponTier1Move'], select[name='craftWeaponTier2Move'], input[name^='craftIngredientQuantity:'], input[name^='garden'], select[name^='garden'], textarea[name^='garden']", (event) => {
      this.updateFieldState(event.currentTarget);
      this.render(false);
    });

    html.on("dragover", ".pfg-drop-zone", (event) => {
      event.preventDefault();
      event.currentTarget.classList.add("dragging");
    });

    html.on("dragleave", ".pfg-drop-zone", (event) => {
      event.currentTarget.classList.remove("dragging");
    });

    html.on("drop", ".pfg-drop-zone[data-drop-target='rareCandyIngredient']", (event) => {
      this.handleHarvestDrop(event).catch((error) => {
        console.error(`${MODULE_ID} | Drop récolte impossible.`, error);
        ui.notifications.error(`Récolte Pokémon: ${error.message ?? error}`);
      });
    });

    html.on("drop", ".pfg-drop-zone[data-drop-target='craftResult'], .pfg-drop-zone[data-drop-target='craftIngredient']", (event) => {
      this.handleCraftDrop(event).catch((error) => {
        console.error(`${MODULE_ID} | Drop fabrication impossible.`, error);
        ui.notifications.error(`Fabrication: ${error.message ?? error}`);
      });
    });
  }

  async handleAction(action, html, control = null) {
    this.readForm(html);

    if (action === "choose-trainer") {
      const actor = getActorByKey(control?.dataset?.actorId);
      if (!actor) {
        ui.notifications.warn("Trainer introuvable. Recharge la fenêtre et réessaie.");
        this.debugSelection("choose-trainer-missing", control?.dataset?.actorId);
        return;
      }
      this.selectTrainer(actor);
      return;
    }

    if (action === "select-trainer") {
      const actor = this.actor;
      if (!actor) {
        ui.notifications.warn("Choisis un Trainer avant de continuer.");
        this.debugSelection("select-trainer-missing", this.state.actorId);
        return;
      }
      this.selectTrainer(actor);
      return;
    }

    if (action === "back") {
      this.goBack();
      return;
    }

    if (action === "to-activity") {
      if (!this.actor) return;
      if (this.isCurrentWeekLocked()) {
        ui.notifications.warn("Cet entretien est déjà finalisé pour cette semaine.");
        return;
      }
      this.state.step = "activity";
      this.render(false);
      return;
    }

    if (action === "to-work") {
      if (this.state.selectedActivity === ACTIVITY_KEYS.work) {
        this.state.step = "work";
        this.render(false);
        return;
      }
      if (this.state.selectedActivity === ACTIVITY_KEYS.crafting) {
        this.state.step = "crafting";
        this.render(false);
        return;
      }
      if (this.state.selectedActivity === ACTIVITY_KEYS.pokemonHarvest) {
        this.state.step = "harvest";
        this.render(false);
        return;
      }
      if (this.state.selectedActivity === ACTIVITY_KEYS.gardening) {
        this.state.step = "gardening";
        this.render(false);
        return;
      }

      ui.notifications.info("Cette activité sera ajoutée dans une prochaine étape du module.");
      return;
    }

    if (action === "to-summary") {
      if (!this.state.currentActivity) return;
      this.state.step = "summary";
      this.render(false);
      return;
    }

    if (action === "open-crafting-journal") {
      await this.openCraftingJournal();
      return;
    }

    if (action === "remove-craft-ingredient") {
      this.removeCraftIngredient(control?.dataset?.entryId);
      return;
    }

    if (action === "roll-work") {
      await this.rollWork();
      return;
    }

    if (action === "confirm-crafting") {
      await this.confirmCrafting();
      return;
    }

    if (action === "roll-harvest") {
      await this.confirmHarvest();
      return;
    }

    if (action === "garden-stage") {
      this.setGardenStage(control?.dataset?.stage);
      return;
    }

    if (action === "add-garden-slot") {
      this.addGardenSlot();
      return;
    }

    if (action === "remove-garden-slot") {
      this.removeGardenSlot(control?.dataset?.slotId);
      return;
    }

    if (action === "confirm-gardening") {
      await this.confirmGardening();
      return;
    }

    if (action === "roll-garden-quantity") {
      await this.rollGardenQuantity(control?.dataset?.slotId);
      return;
    }

    if (action === "post-activity") {
      await this.postCurrentActivity();
      return;
    }

    if (action === "apply-gains") {
      await this.applyWorkGains();
      return;
    }

    if (action === "apply-gains-and-new") {
      await this.applyGainsAndStartNewActivity();
      return;
    }

    if (action === "new-activity") {
      await this.startNewActivity();
      return;
    }

    if (action === "new-maintenance") {
      this.startNewMaintenance();
      return;
    }

    if (action === "finish") {
      await this.finishMaintenance();
      return;
    }

    if (action === "unlock-week") {
      await this.unlockCurrentWeek();
      return;
    }

    if (action === "cancel") {
      this.close();
    }
  }

  readForm(html) {
    const form = resolveForm(html);
    if (!form) return;

    const data = new FormData(form);
    const prBonuses = this.ensurePrBonusState();
    if (data.has("actorId")) this.state.actorId = normalizeActorKey(data.get("actorId")) || this.state.actorId;
    if (data.has("manualLevel")) this.state.manualLevel = stringValue(data.get("manualLevel"));
    if (data.has("manualPower")) this.state.manualPower = stringValue(data.get("manualPower"));
    if (data.has("prSkillKey")) this.state.prSkillKey = normalizePrSkill(data.get("prSkillKey"), this.state.prSkillKey);
    if (data.has("bonusPR")) prBonuses.global = stringValue(data.get("bonusPR"));
    if (data.has("bonusPRCrafting")) prBonuses.crafting = stringValue(data.get("bonusPRCrafting"));
    if (data.has("bonusPRHarvest")) prBonuses.harvest = stringValue(data.get("bonusPRHarvest"));
    if (data.has("bonusPRWork")) prBonuses.work = stringValue(data.get("bonusPRWork"));
    if (data.has("bonusPRGardening")) prBonuses.gardening = stringValue(data.get("bonusPRGardening"));
    if (data.has("weekName")) this.state.calendar.weekName = stringValue(data.get("weekName"));
    if (data.has("rpDate")) this.state.calendar.rpDate = stringValue(data.get("rpDate"));
    if (data.has("eventName")) this.state.calendar.eventName = stringValue(data.get("eventName"));
    if (data.has("eventDescription")) this.state.calendar.eventDescription = stringValue(data.get("eventDescription"));
    if (data.has("selectedActivity")) this.state.selectedActivity = stringValue(data.get("selectedActivity")) || this.state.selectedActivity;
    if (data.has("workDescription")) this.state.work.description = stringValue(data.get("workDescription"));
    if (data.has("workSkillKey")) this.state.work.skillKey = normalizeMaintenanceSkill(data.get("workSkillKey"), this.state.work.skillKey);
    if (data.has("workCount")) this.state.work.count = readPositiveCount(data.get("workCount"), this.state.work.count);
    if (data.has("harvestKey")) this.state.harvest.harvestKey = normalizeHarvestKey(data.get("harvestKey"), this.state.harvest.harvestKey);
    if (data.has("harvestCount")) this.state.harvest.count = readPositiveCount(data.get("harvestCount"), this.state.harvest.count);
    if (data.has("harvestPokemonId")) {
      this.state.harvest.pokemonId = normalizeActorKey(data.get("harvestPokemonId"));
      const pokemon = getPokemonByKey(this.actor, this.state.harvest.pokemonId);
      if (pokemon) this.state.harvest.pokemonName = pokemon.name;
    }
    if (data.has("harvestPokemonName")) this.state.harvest.pokemonName = stringValue(data.get("harvestPokemonName"));
    if (data.has("harvestSecondPokemonName")) this.state.harvest.secondPokemonName = stringValue(data.get("harvestSecondPokemonName"));
    if (form.querySelector?.("[name='harvestOwnsPokemon']")) this.state.harvest.ownsPokemon = data.has("harvestOwnsPokemon");
    if (form.querySelector?.("[name='harvestPaleontologyConfirmed']")) this.state.harvest.paleontologyConfirmed = data.has("harvestPaleontologyConfirmed");
    if (form.querySelector?.("[name='harvestRareCandyIngredientConfirmed']")) this.state.harvest.rareCandyIngredientConfirmed = data.has("harvestRareCandyIngredientConfirmed");
    if (data.has("craftType")) this.state.crafting.type = normalizeCraftType(data.get("craftType"), this.state.crafting.type);
    if (data.has("craftQuantity")) this.state.crafting.quantity = readPositiveCount(data.get("craftQuantity"), this.state.crafting.quantity);
    if (data.has("craftMoneyMode")) this.state.crafting.moneyMode = normalizeMoneyMode(data.get("craftMoneyMode"), this.state.crafting.moneyMode);
    if (data.has("craftMoneyValue")) this.state.crafting.moneyValue = readMoneyValue(data.get("craftMoneyValue"), this.state.crafting.moneyValue);
    const weaponState = this.ensureWeaponCraftingState();
    if (data.has("craftWeaponName")) weaponState.name = stringValue(data.get("craftWeaponName"));
    if (data.has("craftWeaponCategory")) weaponState.categoryKey = normalizeWeaponCategoryKey(data.get("craftWeaponCategory"), weaponState.categoryKey);
    if (data.has("craftWeaponBase")) weaponState.baseKey = stringValue(data.get("craftWeaponBase")) || weaponState.baseKey;
    if (data.has("craftWeaponTier1Move")) weaponState.tier1MoveKey = stringValue(data.get("craftWeaponTier1Move")) || weaponState.tier1MoveKey;
    if (data.has("craftWeaponTier2Move")) weaponState.tier2MoveKey = stringValue(data.get("craftWeaponTier2Move")) || weaponState.tier2MoveKey;
    for (const [key, value] of data.entries()) {
      if (String(key).startsWith("craftIngredientQuantity:")) {
        this.updateCraftIngredientQuantity(String(key).split(":").slice(1).join(":"), value);
      }
    }
    this.readGardeningForm(data, form);
  }

  updateFieldState(field) {
    const name = field?.name;
    if (!name) return;

    if (String(name).startsWith("garden")) {
      if (field.form) this.readGardeningForm(new FormData(field.form), field.form);
      return;
    }

    if (name === "manualLevel") this.state.manualLevel = stringValue(field.value);
    if (name === "manualPower") this.state.manualPower = stringValue(field.value);
    if (name === "prSkillKey") this.state.prSkillKey = normalizePrSkill(field.value, this.state.prSkillKey);
    const prBonusKey = getPrBonusStateKey(name);
    if (prBonusKey) this.ensurePrBonusState()[prBonusKey] = stringValue(field.value);
    if (name === "weekName") this.state.calendar.weekName = stringValue(field.value);
    if (name === "rpDate") this.state.calendar.rpDate = stringValue(field.value);
    if (name === "eventName") this.state.calendar.eventName = stringValue(field.value);
    if (name === "eventDescription") this.state.calendar.eventDescription = stringValue(field.value);
    if (name === "workDescription") this.state.work.description = stringValue(field.value);
    if (name === "workSkillKey") this.state.work.skillKey = normalizeMaintenanceSkill(field.value, this.state.work.skillKey);
    if (name === "workCount") this.state.work.count = readPositiveCount(field.value, this.state.work.count);
    if (name === "harvestKey") this.state.harvest.harvestKey = normalizeHarvestKey(field.value, this.state.harvest.harvestKey);
    if (name === "harvestCount") this.state.harvest.count = readPositiveCount(field.value, this.state.harvest.count);
    if (name === "harvestPokemonId") {
      this.state.harvest.pokemonId = normalizeActorKey(field.value);
      const pokemon = getPokemonByKey(this.actor, this.state.harvest.pokemonId);
      if (pokemon) this.state.harvest.pokemonName = pokemon.name;
    }
    if (name === "harvestPokemonName") this.state.harvest.pokemonName = stringValue(field.value);
    if (name === "harvestSecondPokemonName") this.state.harvest.secondPokemonName = stringValue(field.value);
    if (name === "harvestOwnsPokemon") this.state.harvest.ownsPokemon = Boolean(field.checked);
    if (name === "harvestPaleontologyConfirmed") this.state.harvest.paleontologyConfirmed = Boolean(field.checked);
    if (name === "harvestRareCandyIngredientConfirmed") this.state.harvest.rareCandyIngredientConfirmed = Boolean(field.checked);
    if (name === "craftType") this.state.crafting.type = normalizeCraftType(field.value, this.state.crafting.type);
    if (name === "craftQuantity") this.state.crafting.quantity = readPositiveCount(field.value, this.state.crafting.quantity);
    if (name === "craftMoneyMode") this.state.crafting.moneyMode = normalizeMoneyMode(field.value, this.state.crafting.moneyMode);
    if (name === "craftMoneyValue") this.state.crafting.moneyValue = readMoneyValue(field.value, this.state.crafting.moneyValue);
    const weaponState = this.ensureWeaponCraftingState();
    if (name === "craftWeaponName") weaponState.name = stringValue(field.value);
    if (name === "craftWeaponCategory") weaponState.categoryKey = normalizeWeaponCategoryKey(field.value, weaponState.categoryKey);
    if (name === "craftWeaponBase") weaponState.baseKey = stringValue(field.value) || weaponState.baseKey;
    if (name === "craftWeaponTier1Move") weaponState.tier1MoveKey = stringValue(field.value) || weaponState.tier1MoveKey;
    if (name === "craftWeaponTier2Move") weaponState.tier2MoveKey = stringValue(field.value) || weaponState.tier2MoveKey;
    if (String(name).startsWith("craftIngredientQuantity:")) {
      this.updateCraftIngredientQuantity(String(name).split(":").slice(1).join(":"), field.value);
    }
  }

  readGardeningForm(data, form) {
    if (!data || !form) return;
    const gardening = this.ensureGardeningState();
    if (data.has("gardenHarvestSkillMode")) gardening.harvestSkillMode = normalizeGardenHarvestSkillMode(data.get("gardenHarvestSkillMode"));
    if (data.has("gardenNaturalSpecialtyType")) gardening.naturalSpecialty.type = normalizeGardenPlantType(data.get("gardenNaturalSpecialtyType"));
    if (data.has("gardenNaturalSpecialtyName")) gardening.naturalSpecialty.name = stringValue(data.get("gardenNaturalSpecialtyName"));
    if (form.querySelector?.("[name='gardenNaturalSpecialtyEnabled']")) gardening.naturalSpecialty.enabled = data.has("gardenNaturalSpecialtyEnabled");
    if (form.querySelector?.("[name='gardenSprouterAll']")) gardening.modifiers.sprouterAll = data.has("gardenSprouterAll");

    for (const key of ["sprouter", "gardener", "expert", "mulch", "fertilizer", "terrain"]) {
      const fieldName = `garden${capitalize(key)}Count`;
      if (data.has(fieldName)) gardening.modifiers[`${key}Count`] = readNonNegativeCount(data.get(fieldName));
    }

    for (const slot of gardening.slots) {
      const id = slot.id;
      if (data.has(`gardenSlotName:${id}`)) slot.name = stringValue(data.get(`gardenSlotName:${id}`));
      if (data.has(`gardenSlotType:${id}`)) slot.type = normalizeGardenPlantType(data.get(`gardenSlotType:${id}`));
      if (data.has(`gardenSlotTier:${id}`)) slot.tier = normalizeGardenTier(data.get(`gardenSlotTier:${id}`));
      if (data.has(`gardenSlotRemaining:${id}`)) slot.remainingWeeks = readOptionalNonNegativeCount(data.get(`gardenSlotRemaining:${id}`));
      if (data.has(`gardenSlotSoil:${id}`)) slot.soilQuality = clampNumber(data.get(`gardenSlotSoil:${id}`), 0, 6);
      if (data.has(`gardenSlotYield:${id}`)) slot.yieldBonus = readNonNegativeCount(data.get(`gardenSlotYield:${id}`));
      if (data.has(`gardenSlotReason:${id}`)) slot.reason = stringValue(data.get(`gardenSlotReason:${id}`));
      if (data.has(`gardenSlotNotes:${id}`)) slot.notes = stringValue(data.get(`gardenSlotNotes:${id}`));

      for (const key of ["FreeReplant", "Sprouter", "Gardener", "Expert", "Mulch", "Fertilizer", "Terrain", "Harvest"]) {
        const fieldName = `gardenSlot${key}:${id}`;
        if (form.querySelector?.(`[name='${cssEscape(fieldName)}']`)) {
          const stateKey = key === "FreeReplant" ? "freeReplant" : key.charAt(0).toLowerCase() + key.slice(1);
          slot[stateKey] = data.has(fieldName);
        }
      }
    }
  }

  getWorkData(actor, availablePRQ) {
    const lockedActivity = this.state.currentActivity?.key === ACTIVITY_KEYS.work ? this.state.currentActivity : null;
    const remainingBefore = Math.max(0, Math.trunc(Number(availablePRQ) || 0));
    const maxCount = Math.floor(remainingBefore / ACTIVITY_COSTS_PRQ.work);
    const workSkillKey = normalizeMaintenanceSkill(lockedActivity?.skillKey ?? this.state.work.skillKey, this.state.prSkillKey);
    this.state.work.skillKey = workSkillKey;
    const selectedSkill = actor ? getSkillRank(actor, workSkillKey) : null;
    const rate = lockedActivity?.rate ?? (selectedSkill ? getWorkRateForRank(selectedSkill.rank) : 0);
    const count = lockedActivity?.count ?? Math.min(Math.max(1, this.state.work.count), Math.max(1, maxCount));
    const costPRQ = lockedActivity?.costPRQ ?? count * ACTIVITY_COSTS_PRQ.work;

    return {
      ...this.state.work,
      description: lockedActivity?.description ?? this.state.work.description,
      count,
      maxCount: lockedActivity?.count ?? maxCount,
      costPRQ,
      costLabel: lockedActivity?.costLabel ?? formatPRQ(costPRQ),
      remainingBefore,
      remainingBeforeLabel: formatPRQ(remainingBefore),
      remainingAfterLabel: formatPRQ(Math.max(0, remainingBefore - (lockedActivity ? 0 : costPRQ))),
      skillKey: workSkillKey,
      skillOptions: getSkillOptions(actor, workSkillKey, MAINTENANCE_SKILL_KEYS),
      selectedSkill,
      rankLabel: selectedSkill?.rankLabel ?? getRankLabel(0),
      rate,
      rateWarning: selectedSkill ? selectedSkill.rank <= 2 : false,
      locked: Boolean(lockedActivity),
      lockedRolls: lockedActivity?.rolls ?? [],
      lockedTotalGain: lockedActivity?.totalGain ?? 0,
      canRoll: Boolean(actor && maxCount > 0 && !lockedActivity),
      rolls: this.state.work.rolls ?? [],
      totalGain: this.state.work.totalGain ?? 0
    };
  }

  getHarvestData(actor, availablePRQ) {
    const lockedActivity = this.state.currentActivity?.key === ACTIVITY_KEYS.pokemonHarvest ? this.state.currentActivity : null;
    const harvestKey = normalizeHarvestKey(lockedActivity?.harvestKey ?? this.state.harvest.harvestKey);
    this.state.harvest.harvestKey = harvestKey;
    const selectedOption = getHarvestOption(harvestKey);
    const remainingBefore = Math.max(0, Math.trunc(Number(availablePRQ) || 0));
    const unitCostPRQ = selectedOption?.costPRQ ?? 0;
    const maxCount = unitCostPRQ > 0 ? Math.floor(remainingBefore / unitCostPRQ) : 0;
    const count = lockedActivity?.count ?? Math.min(Math.max(1, this.state.harvest.count ?? 1), Math.max(1, maxCount));
    const costPRQ = lockedActivity?.costPRQ ?? count * unitCostPRQ;
    const selectedPokemonId = lockedActivity?.pokemonId ?? this.state.harvest.pokemonId;
    const selectedPokemon = actor && !lockedActivity ? getPokemonByKey(actor, selectedPokemonId) : null;
    const pokemonOptions = getPokemonOptions(actor, selectedPokemonId);
    const detectedPokemonName = selectedPokemon?.name ?? "";
    const detectedOricorioNames = actor ? getOwnedPokemonForTrainer(actor)
      .filter((pokemon) => pokemonLooksLikeSpecies(pokemon, "oricorio"))
      .map((pokemon) => pokemon.name)
      .filter(Boolean) : [];
    const pokemonName = lockedActivity
      ? (lockedActivity.pokemonName ?? "")
      : (this.state.harvest.pokemonName || (selectedOption?.requiresTwoOricorio ? detectedOricorioNames[0] : detectedPokemonName) || "");
    const secondPokemonName = lockedActivity
      ? (lockedActivity.secondPokemonName ?? "")
      : (this.state.harvest.secondPokemonName || (selectedOption?.requiresTwoOricorio ? detectedOricorioNames[1] : "") || "");
    const ownsPokemon = lockedActivity ? true : Boolean(selectedPokemon || detectedOricorioNames.length >= 2 || this.state.harvest.ownsPokemon);
    const paleontologyConfirmed = lockedActivity ? Boolean(lockedActivity.paleontologyConfirmed) : Boolean(this.state.harvest.paleontologyConfirmed);
    const rareCandyIngredientConfirmed = lockedActivity ? Boolean(lockedActivity.rareCandyIngredientConfirmed) : Boolean(this.state.harvest.rareCandyIngredientConfirmed);
    const rareCandyIngredientName = lockedActivity ? (lockedActivity.rareCandyIngredientName ?? "") : this.state.harvest.rareCandyIngredientName;
    const rareCandyIngredientUuid = lockedActivity ? (lockedActivity.rareCandyIngredientUuid ?? "") : this.state.harvest.rareCandyIngredientUuid;
    const requirementErrors = lockedActivity ? [] : getHarvestRequirementErrors(actor, selectedOption, {
      pokemonName,
      secondPokemonName,
      ownsPokemon,
      selectedPokemon,
      detectedOricorioNames,
      paleontologyConfirmed,
      rareCandyIngredientConfirmed,
      remainingBefore,
      costPRQ
    });

    return {
      ...this.state.harvest,
      harvestKey,
      count,
      maxCount: lockedActivity?.count ?? maxCount,
      pokemonId: selectedPokemonId,
      pokemonName,
      secondPokemonName,
      ownsPokemon,
      paleontologyConfirmed,
      rareCandyIngredientConfirmed,
      rareCandyIngredientName,
      rareCandyIngredientUuid,
      selectedOption: selectedOption ? {
        ...selectedOption,
        costLabel: formatPRQ(selectedOption.costPRQ),
        resultTypeLabel: getHarvestResultTypeLabel(selectedOption.resultType)
      } : null,
      options: POKEMON_HARVEST_OPTIONS.map((option) => ({
        ...option,
        selected: option.key === harvestKey,
        costLabel: formatPRQ(option.costPRQ),
        resultTypeLabel: getHarvestResultTypeLabel(option.resultType),
        insufficientPR: option.costPRQ > remainingBefore && !lockedActivity
      })),
      pokemonOptions,
      hasPokemonOptions: pokemonOptions.length > 0,
      detectedOricorioNames,
      detectedOricorioLabel: detectedOricorioNames.join(", "),
      costPRQ,
      costLabel: lockedActivity?.costLabel ?? formatPRQ(costPRQ),
      unitCostPRQ,
      unitCostLabel: formatPRQ(unitCostPRQ),
      remainingBefore,
      remainingBeforeLabel: formatPRQ(remainingBefore),
      remainingAfterLabel: formatPRQ(Math.max(0, remainingBefore - (lockedActivity ? 0 : costPRQ))),
      requiresSecondPokemon: Boolean(selectedOption?.requiresTwoOricorio),
      requiresPokemon: !selectedOption?.skipPokemonRequirement,
      requiresPaleontologyConfirmation: Boolean(selectedOption?.requiresPaleontologyConfirmation),
      requiresRareCandyIngredient: Boolean(selectedOption?.requiresRareCandyIngredient),
      locked: Boolean(lockedActivity),
      lockedResultStatus: lockedActivity?.resultStatus ?? "",
      lockedResultLabel: lockedActivity?.resultLabel ?? "",
      requirementErrors,
      hasRequirementErrors: requirementErrors.length > 0,
      canHarvest: Boolean(actor && selectedOption && !lockedActivity && requirementErrors.length === 0)
    };
  }

  getCraftingData(actor, availablePRQ) {
    const lockedActivity = this.state.currentActivity?.key === ACTIVITY_KEYS.crafting ? this.state.currentActivity : null;
    const remainingBefore = Math.max(0, Math.trunc(Number(availablePRQ) || 0));
    const craftTypeKey = normalizeCraftType(lockedActivity?.craftType ?? this.state.crafting.type);
    this.state.crafting.type = craftTypeKey;
    const craftType = getCraftType(craftTypeKey);
    const isWeaponCraft = craftTypeKey === "weapon";
    const weapon = isWeaponCraft ? this.getWeaponCraftingData(actor, lockedActivity?.weapon) : null;
    const quantity = lockedActivity?.quantity ?? (isWeaponCraft ? 1 : Math.max(1, this.state.crafting.quantity));
    const moneyMode = isWeaponCraft ? "total" : normalizeMoneyMode(lockedActivity?.moneyMode ?? this.state.crafting.moneyMode);
    const moneyValue = lockedActivity?.moneyValue ?? (isWeaponCraft ? (weapon?.moneyCost ?? 0) : Math.max(0, Number(this.state.crafting.moneyValue) || 0));
    const moneyCost = lockedActivity?.moneyCost ?? (isWeaponCraft ? (weapon?.moneyCost ?? 0) : calculateCraftMoneyCost(moneyMode, moneyValue, quantity));
    const costPRQ = lockedActivity?.costPRQ ?? quantity * (craftType?.costPRQ ?? ACTIVITY_COSTS_PRQ.normalCraft);
    const ingredients = (lockedActivity?.ingredients ?? this.state.crafting.ingredients).map((ingredient) => {
      const actorItem = actor ? actor.items?.get?.(ingredient.itemId) : null;
      const availableQuantity = lockedActivity ? ingredient.availableQuantity : (actorItem ? getItemQuantity(actorItem) : 0);
      const quantityNeeded = Math.max(1, Math.trunc(Number(ingredient.quantity) || 1));
      return {
        ...ingredient,
        quantity: quantityNeeded,
        availableQuantity,
        enough: Boolean(lockedActivity || (actorItem && availableQuantity >= quantityNeeded))
      };
    });
    const requirementErrors = lockedActivity ? [] : getCraftRequirementErrors(actor, {
      itemUuid: isWeaponCraft ? "" : this.state.crafting.itemUuid,
      itemName: isWeaponCraft ? weapon?.itemName : this.state.crafting.itemName,
      generatedItem: weapon?.itemSource ?? null,
      craftType,
      quantity,
      costPRQ,
      remainingBefore,
      moneyCost,
      ingredients
    });

    return {
      ...this.state.crafting,
      itemUuid: lockedActivity?.itemUuid ?? (isWeaponCraft ? "" : this.state.crafting.itemUuid),
      itemName: lockedActivity?.itemName ?? (isWeaponCraft ? weapon?.itemName ?? "" : this.state.crafting.itemName),
      itemType: lockedActivity?.itemType ?? (isWeaponCraft ? "item" : this.state.crafting.itemType),
      type: craftTypeKey,
      quantity,
      quantityLocked: Boolean(isWeaponCraft || lockedActivity),
      moneyMode,
      moneyModeUnit: moneyMode === "unit",
      moneyValue,
      moneyCost,
      moneyCostLabel: formatMoney(moneyCost),
      unitMoneyCostLabel: moneyMode === "unit" ? formatMoney(moneyValue) : "",
      costPRQ,
      costLabel: lockedActivity?.costLabel ?? formatPRQ(costPRQ),
      remainingBefore,
      remainingBeforeLabel: formatPRQ(remainingBefore),
      remainingAfterLabel: formatPRQ(Math.max(0, remainingBefore - (lockedActivity ? 0 : costPRQ))),
      typeOptions: CRAFTING_TYPES.map((type) => ({
        ...type,
        selected: type.key === craftTypeKey,
        costLabel: `${formatPRQ(type.costPRQ)} / unité`,
        disabled: !type.enabled
      })),
      selectedType: craftType,
      selectedTypeLabel: craftType?.label ?? craftTypeKey,
      isWeaponCraft,
      weapon,
      ingredients,
      hasIngredients: ingredients.length > 0,
      requirementErrors,
      hasRequirementErrors: requirementErrors.length > 0,
      locked: Boolean(lockedActivity),
      canCraft: Boolean(actor && !lockedActivity && requirementErrors.length === 0)
    };
  }

  getGardeningData(actor, availablePRQ) {
    const lockedActivity = this.state.currentActivity?.key === ACTIVITY_KEYS.gardening ? this.state.currentActivity : null;
    const remainingBefore = Math.max(0, Math.trunc(Number(availablePRQ) || 0));
    const state = this.ensureGardeningState();
    const maxBonusSlots = Math.max(0, Math.trunc(Number(setting(SETTINGS.maxBonusGardenSlots, 6)) || 0));
    const maxSlots = GARDEN_BASE_SLOTS + maxBonusSlots;
    state.slots = state.slots.slice(0, maxSlots);

    if (lockedActivity) {
      const lockedGrowthEntries = lockedActivity.growthEntries ?? [];
      const lockedReadyEntries = lockedActivity.readyEntries ?? [];
      return {
        ...state,
        stage: state.stage,
        isPlantingStage: state.stage === "planting",
        isGrowthStage: state.stage === "growth",
        isHarvestStage: state.stage === "harvest",
        locked: true,
        maxSlots,
        slotCount: lockedGrowthEntries.length,
        baseSlotCount: GARDEN_BASE_SLOTS,
        bonusSlotCount: Math.max(0, lockedGrowthEntries.length - GARDEN_BASE_SLOTS),
        maxBonusSlots,
        canAddSlot: false,
        slots: lockedGrowthEntries,
        growthEntries: lockedGrowthEntries,
        plantedEntries: lockedGrowthEntries.filter((slot) => slot.isPlanted),
        readyEntries: lockedReadyEntries,
        hasReadyEntries: lockedReadyEntries.length > 0,
        selectedHarvestCount: lockedActivity.harvestedCount ?? 0,
        plantTypeOptions: GARDEN_PLANT_TYPES.map((option) => ({
          ...option,
          selected: option.key === state.naturalSpecialty.type
        })),
        harvestResults: lockedActivity.harvestResults ?? [],
        hasHarvestResults: Boolean(lockedActivity.hasHarvestResults),
        costPRQ: lockedActivity.costPRQ ?? 0,
        costLabel: lockedActivity.costLabel ?? formatPRQ(0),
        moneyCost: lockedActivity.moneyCost ?? 0,
        moneyCostLabel: lockedActivity.moneyCostLabel ?? formatMoney(0),
        remainingBefore,
        remainingBeforeLabel: formatPRQ(remainingBefore),
        remainingAfterLabel: formatPRQ(remainingBefore),
        resultStatus: lockedActivity.resultStatus ?? "Agriculture déjà confirmée.",
        canConfirm: false,
        requirementErrors: [],
        hasRequirementErrors: false
      };
    }

    const skill = getSkillRank(actor, "survival");
    const growthEntries = calculateGardenEntries(state, skill);
    const plantedEntries = growthEntries.filter((slot) => slot.isPlanted);
    const readyEntries = plantedEntries.filter((slot) => slot.ready);
    const selectedHarvestEntries = readyEntries.filter((slot) => slot.harvest);
    const modifierSummary = getGardenModifierSummary(state, plantedEntries);
    const costPRQ = modifierSummary.costPRQ + (selectedHarvestEntries.length * ACTIVITY_COSTS_PRQ.gardenHarvest);
    const moneyCost = modifierSummary.moneyCost;
    const requirementErrors = getGardeningRequirementErrors(actor, {
      plantedEntries,
      selectedHarvestEntries,
      modifierSummary,
      remainingBefore,
      costPRQ,
      moneyCost
    });

    return {
      ...state,
      isPlantingStage: state.stage === "planting",
      isGrowthStage: state.stage === "growth",
      isHarvestStage: state.stage === "harvest",
      locked: false,
      maxSlots,
      canAddSlot: state.slots.length < maxSlots,
      slotCount: state.slots.length,
      baseSlotCount: GARDEN_BASE_SLOTS,
      bonusSlotCount: Math.max(0, state.slots.length - GARDEN_BASE_SLOTS),
      maxBonusSlots,
      plantTypeOptions: GARDEN_PLANT_TYPES.map((option) => ({
        ...option,
        selected: option.key === state.naturalSpecialty.type
      })),
      tierOptions: GARDEN_TIERS,
      growthEntries,
      plantedEntries,
      readyEntries,
      hasReadyEntries: readyEntries.length > 0,
      selectedHarvestEntries,
      selectedHarvestCount: selectedHarvestEntries.length,
      modifierSummary,
      skill,
      harvestSkillModeBest: state.harvestSkillMode === "best",
      skillLabel: skill?.label ?? "Survival",
      skillRankLabel: skill?.rankLabel ?? getRankLabel(0),
      skillDiceFormula: skill?.diceFormula ?? "0d6",
      harvestRollUsesSkillDice: setting(SETTINGS.harvestRollUsesSkillDice, true),
      freeReplantThreshold: Math.max(1, Math.trunc(Number(setting(SETTINGS.freeReplantThreshold, 8)) || 8)),
      costPRQ,
      costLabel: formatPRQ(costPRQ),
      moneyCost,
      moneyCostLabel: formatMoney(moneyCost),
      remainingBefore,
      remainingBeforeLabel: formatPRQ(remainingBefore),
      remainingAfterLabel: formatPRQ(Math.max(0, remainingBefore - costPRQ)),
      requirementErrors,
      hasRequirementErrors: requirementErrors.length > 0,
      canConfirm: Boolean(actor && requirementErrors.length === 0)
    };
  }

  getPlannedActivities() {
    return this.state.activities ?? [];
  }

  ensureGardeningState() {
    if (!this.state.gardening) this.state.gardening = createDefaultGardeningState();
    if (!Array.isArray(this.state.gardening.slots)) this.state.gardening.slots = [];
    while (this.state.gardening.slots.length < GARDEN_BASE_SLOTS) {
      this.state.gardening.slots.push(createGardenSlot(this.state.gardening.slots.length));
    }
    if (!this.state.gardening.modifiers) this.state.gardening.modifiers = createDefaultGardenModifiers();
    if (!this.state.gardening.naturalSpecialty) this.state.gardening.naturalSpecialty = createDefaultNaturalSpecialty();
    return this.state.gardening;
  }

  ensureWeaponCraftingState() {
    if (!this.state.crafting.weapon) this.state.crafting.weapon = createDefaultWeaponCraftingState();
    return this.state.crafting.weapon;
  }

  getWeaponCraftingData(actor, lockedWeapon = null) {
    if (lockedWeapon) return lockedWeapon;

    const state = this.ensureWeaponCraftingState();
    const category = getWeaponCategory(state.categoryKey);
    state.categoryKey = category.key;
    const base = getWeaponBase(category, state.baseKey);
    state.baseKey = base.key;
    const tier1Options = getWeaponMoveOptions(category, "tier1", base);
    const tier2Options = getWeaponMoveOptions(category, "tier2", base);
    const tier1Move = getWeaponMoveFromOptions(tier1Options, state.tier1MoveKey);
    const tier2Move = getWeaponMoveFromOptions(tier2Options, state.tier2MoveKey);
    state.tier1MoveKey = tier1Move?.key ?? "";
    state.tier2MoveKey = tier2Move?.key ?? "";

    const selectedMoves = [tier1Move, tier2Move].filter(Boolean);
    const baseCost = Number(base.cost) || 0;
    const surcharge = selectedMoves.reduce((total, move) => total + (Number(move.musicalSurcharge) || 0), 0);
    const moneyCost = baseCost + surcharge;
    const isShield = category.key === "shield";
    const itemName = state.name || buildWeaponItemName(category, base, selectedMoves);
    const rules = buildWeaponRules(category, base, selectedMoves);
    const summaryLines = buildWeaponSummaryLines(category, base, selectedMoves, baseCost, surcharge);
    const keywords = buildWeaponKeywords(category, base);
    const moveRankSkill = getWeaponMoveRankSkill(category);
    const effectText = buildWeaponEffectText(category, base, selectedMoves, moveRankSkill);
    const description = buildWeaponDescription(category, base, selectedMoves, baseCost, surcharge, keywords, effectText);
    const itemSource = buildWeaponItemSource({
      itemName,
      category,
      base,
      selectedMoves,
      baseCost,
      surcharge,
      moneyCost,
      keywords,
      effectText,
      description,
      rules
    });

    return {
      name: state.name,
      itemName,
      categoryKey: category.key,
      categoryLabel: category.label,
      baseKey: base.key,
      baseLabel: base.label,
      baseCost,
      baseCostLabel: formatMoney(baseCost),
      surcharge,
      surchargeLabel: formatMoney(surcharge),
      moneyCost,
      moneyCostLabel: formatMoney(moneyCost),
      moveRankSkill,
      isShield,
      evasionBonus: base.evasionBonus ?? 0,
      actionDescription: base.actionDescription ?? "",
      effectUuid: base.effectUuid ?? "",
      rangeLabel: base.rangeLabel ?? "",
      tier1MoveKey: tier1Move?.key ?? "",
      tier2MoveKey: tier2Move?.key ?? "",
      tier1MoveLabel: tier1Move?.label ?? "",
      tier2MoveLabel: tier2Move?.label ?? "",
      moveLabels: selectedMoves.map((move) => move.label).join(", "),
      selectedMoves,
      categoryOptions: WEAPON_CRAFTING_CATEGORIES.map((entry) => ({
        key: entry.key,
        label: entry.label,
        selected: entry.key === category.key
      })),
      baseOptions: category.bases.map((entry) => ({
        ...entry,
        selected: entry.key === base.key,
        costLabel: formatMoney(entry.cost)
      })),
      tier1Options: tier1Options.map((move) => ({
        ...move,
        selected: move.key === tier1Move?.key,
        surchargeLabel: move.musicalSurcharge ? ` + ${formatMoney(move.musicalSurcharge)}` : ""
      })),
      tier2Options: tier2Options.map((move) => ({
        ...move,
        selected: move.key === tier2Move?.key,
        surchargeLabel: move.musicalSurcharge ? ` + ${formatMoney(move.musicalSurcharge)}` : ""
      })),
      summaryLines,
      hasSummaryLines: summaryLines.length > 0,
      keywords,
      keywordLabels: keywords.join(", "),
      effectText,
      description,
      rules,
      itemSource
    };
  }

  ensurePrBonusState() {
    if (!this.state.prBonuses) this.state.prBonuses = createEmptyPrBonuses();
    return this.state.prBonuses;
  }

  getPrBonusData() {
    const values = this.ensurePrBonusState();
    const activityPRQ = {
      [ACTIVITY_KEYS.work]: readPrBonusPRQ(values.work),
      [ACTIVITY_KEYS.crafting]: readPrBonusPRQ(values.crafting),
      [ACTIVITY_KEYS.pokemonHarvest]: readPrBonusPRQ(values.harvest),
      [ACTIVITY_KEYS.gardening]: readPrBonusPRQ(values.gardening)
    };
    const globalPRQ = readPrBonusPRQ(values.global);
    const activityTotalPRQ = Object.values(activityPRQ).reduce((total, value) => total + value, 0);
    const totalBonusPRQ = globalPRQ + activityTotalPRQ;

    return {
      globalValue: values.global ?? "",
      craftingValue: values.crafting ?? "",
      harvestValue: values.harvest ?? "",
      workValue: values.work ?? "",
      gardeningValue: values.gardening ?? "",
      globalPRQ,
      globalLabel: formatPRQ(globalPRQ),
      activityPRQ,
      workPRQ: activityPRQ[ACTIVITY_KEYS.work],
      workLabel: formatPRQ(activityPRQ[ACTIVITY_KEYS.work]),
      craftingPRQ: activityPRQ[ACTIVITY_KEYS.crafting],
      craftingLabel: formatPRQ(activityPRQ[ACTIVITY_KEYS.crafting]),
      harvestPRQ: activityPRQ[ACTIVITY_KEYS.pokemonHarvest],
      harvestLabel: formatPRQ(activityPRQ[ACTIVITY_KEYS.pokemonHarvest]),
      gardeningPRQ: activityPRQ[ACTIVITY_KEYS.gardening],
      gardeningLabel: formatPRQ(activityPRQ[ACTIVITY_KEYS.gardening]),
      activityTotalPRQ,
      activityTotalLabel: formatPRQ(activityTotalPRQ),
      totalBonusPRQ,
      totalBonusLabel: formatPRQ(totalBonusPRQ)
    };
  }

  getBudgetData(basePRQ, activities = this.getPlannedActivities()) {
    const sanitizedBasePRQ = Math.max(0, Math.trunc(Number(basePRQ) || 0));
    const bonuses = this.getPrBonusData();
    let remainingGeneralPRQ = sanitizedBasePRQ + bonuses.globalPRQ;
    const remainingSpecificPRQ = { ...bonuses.activityPRQ };
    const allocations = [];
    const spentPRQ = activities.reduce((total, activity) => total + Math.max(0, Math.trunc(Number(activity.costPRQ) || 0)), 0);

    for (const activity of activities) {
      const key = activity?.key;
      let remainingCostPRQ = Math.max(0, Math.trunc(Number(activity?.costPRQ) || 0));
      const specificBeforePRQ = Math.max(0, remainingSpecificPRQ[key] ?? 0);
      const usedSpecificPRQ = Math.min(specificBeforePRQ, remainingCostPRQ);
      remainingCostPRQ -= usedSpecificPRQ;
      if (key in remainingSpecificPRQ) remainingSpecificPRQ[key] = specificBeforePRQ - usedSpecificPRQ;

      const usedGeneralPRQ = Math.min(remainingGeneralPRQ, remainingCostPRQ);
      remainingGeneralPRQ -= usedGeneralPRQ;
      remainingCostPRQ -= usedGeneralPRQ;

      allocations.push({
        key,
        usedSpecificPRQ,
        usedGeneralPRQ,
        deficitPRQ: Math.max(0, remainingCostPRQ)
      });
    }

    const activityKeys = [ACTIVITY_KEYS.work, ACTIVITY_KEYS.crafting, ACTIVITY_KEYS.pokemonHarvest, ACTIVITY_KEYS.gardening];
    const availableByActivity = activityKeys.reduce((available, key) => {
      available[key] = Math.max(0, remainingGeneralPRQ + (remainingSpecificPRQ[key] ?? 0));
      return available;
    }, {});
    const remainingSpecificTotalPRQ = Object.values(remainingSpecificPRQ).reduce((total, value) => total + value, 0);

    return {
      basePRQ: sanitizedBasePRQ,
      bonuses,
      totalPRQ: sanitizedBasePRQ + bonuses.totalBonusPRQ,
      spentPRQ,
      remainingPRQ: Math.max(0, remainingGeneralPRQ + remainingSpecificTotalPRQ),
      remainingGeneralPRQ: Math.max(0, remainingGeneralPRQ),
      remainingGeneralLabel: formatPRQ(remainingGeneralPRQ),
      remainingSpecificPRQ,
      availableByActivity,
      allocations
    };
  }

  async rollWork() {
    const actor = this.actor;
    if (!actor) return;

    if (this.state.currentActivity) {
      ui.notifications.warn("Un Petit Travail a déjà été lancé pour cet entretien. Le résultat est conservé.");
      this.state.step = "summary";
      this.render(false);
      return;
    }

    const data = this.getData();
    const work = data.work;
    if (!work.canRoll || work.maxCount <= 0) {
      ui.notifications.warn("PR insuffisants pour effectuer un Petit Travail.");
      return;
    }

    const count = Math.min(this.state.work.count, work.maxCount);
    const rolls = [];
    let totalGain = 0;

    for (let index = 0; index < count; index += 1) {
      const roll = await new Roll("1d6").evaluate({ async: true });
      const die = Math.trunc(Number(roll.total) || 0);
      const gain = die * work.rate;
      totalGain += gain;
      rolls.push({
        index: index + 1,
        die,
        rate: work.rate,
        gain,
        roll
      });
    }

    const activity = {
      key: ACTIVITY_KEYS.work,
      title: "Petit Travail",
      description: this.state.work.description || "Petit Travail hebdomadaire",
      skillKey: this.state.work.skillKey,
      skillLabel: work.selectedSkill?.label ?? this.state.work.skillKey,
      skillRank: work.selectedSkill?.rank ?? 0,
      skillRankLabel: work.selectedSkill?.rankLabel ?? getRankLabel(0),
      skillTotalDetail: work.selectedSkill?.totalDetail ?? "0",
      skillDiceFormula: work.selectedSkill?.diceFormula ?? "0d6",
      count,
      costPRQ: count * ACTIVITY_COSTS_PRQ.work,
      costLabel: formatPRQ(count * ACTIVITY_COSTS_PRQ.work),
      rate: work.rate,
      rolls,
      totalGain,
      applied: false
    };

    this.state.work.rolls = rolls;
    this.state.work.totalGain = totalGain;
    this.state.activities.push(activity);
    this.state.currentActivity = activity;

    await postRollCard({
      actor,
      activity,
      rolls,
      totalGain,
      remainingPRLabel: formatPRQ(this.getTotals().remainingPRQ)
    });

    this.state.step = "summary";
    this.render(false);
  }

  async confirmHarvest() {
    const actor = this.actor;
    if (!actor) return;

    if (this.state.currentActivity) {
      ui.notifications.warn("Une activité a déjà été confirmée. Le résultat est conservé dans l'historique.");
      this.state.step = "summary";
      this.render(false);
      return;
    }

    const data = this.getData();
    const harvest = data.harvest;
    if (!harvest.canHarvest) {
      ui.notifications.warn(harvest.requirementErrors?.[0] ?? "Récolte Pokémon impossible avec les données actuelles.");
      return;
    }

    const option = harvest.selectedOption;
    const count = Math.max(1, Math.trunc(Number(harvest.count) || 1));
    const result = await this.applyHarvestResult(actor, option, count);
    const pokemonNames = [harvest.pokemonName, harvest.requiresSecondPokemon ? harvest.secondPokemonName : ""]
      .map((name) => stringValue(name))
      .filter(Boolean);
    const pokemonNamesLabel = option.skipPokemonRequirement
      ? "Field of Study: Paleontology"
      : (pokemonNames.join(", ") || "Pokémon confirmé");
    const resultStatus = option.requiresRareCandyIngredient
      ? `${result.status} Retirer ${count} × ${harvest.rareCandyIngredientName || option.ingredientLabel || "Shuckle's Berry Juice"} manuellement de l'inventaire.`
      : result.status;
    const activity = {
      key: ACTIVITY_KEYS.pokemonHarvest,
      isHarvest: true,
      title: "Récolte Pokémon",
      description: option.label,
      harvestKey: option.key,
      harvestLabel: option.label,
      harvestCategory: option.category,
      usesPokemon: !option.skipPokemonRequirement,
      pokemonId: harvest.pokemonId,
      pokemonName: option.skipPokemonRequirement ? "" : harvest.pokemonName,
      secondPokemonName: harvest.requiresSecondPokemon ? harvest.secondPokemonName : "",
      pokemonNames: pokemonNamesLabel,
      paleontologyConfirmed: harvest.paleontologyConfirmed,
      rareCandyIngredientConfirmed: harvest.rareCandyIngredientConfirmed,
      rareCandyIngredientName: harvest.rareCandyIngredientName,
      rareCandyIngredientUuid: harvest.rareCandyIngredientUuid,
      count,
      costPRQ: harvest.costPRQ,
      costLabel: harvest.costLabel,
      resultType: option.resultType,
      resultTypeLabel: getHarvestResultTypeLabel(option.resultType),
      resultUuid: option.resultUuid ?? "",
      resultLabel: option.resultLabel ?? option.label,
      resultEntries: result.entries ?? [],
      hasResultEntries: (result.entries ?? []).length > 0,
      resultStatus,
      resultApplied: result.applied,
      summaryLine: `${option.label} × ${count} avec ${pokemonNamesLabel}: ${formatResultEntries(result.entries) || option.resultLabel || "résultat à gérer"}`,
      rolls: [],
      totalGain: 0,
      moneyDelta: 0,
      applied: true
    };

    this.state.activities.push(activity);
    this.state.currentActivity = activity;
    const totals = this.getTotals();

    await postActivitySummary({
      actor,
      activity,
      activities: [activity],
      calendar: getCurrentWeekData(this.state.calendar),
      totalPRLabel: formatPRQ(totals.totalPRQ),
      spentPRLabel: formatPRQ(totals.spentPRQ),
      remainingPRLabel: formatPRQ(totals.remainingPRQ),
      isActivity: true
    });

    ui.notifications.info("Récolte Pokémon confirmée et ajoutée à l'historique.");
    this.state.step = "summary";
    this.render(false);
  }

  async applyHarvestResult(actor, option, count = 1) {
    if (!option) return { applied: false, status: "Récolte inconnue." };
    const quantity = Math.max(1, Math.trunc(Number(count) || 1));

    try {
      if (option.resultType === HARVEST_RESULT_TYPES.item) {
        if (!option.resultUuid) return { applied: false, status: "Item manquant: à ajouter manuellement." };
        if (!(actor.isOwner || game.user?.isGM)) {
          return { applied: false, status: "Item non ajouté: permission insuffisante. À ajouter manuellement." };
        }
        if (!globalThis.fromUuid) return { applied: false, status: "fromUuid indisponible: à ajouter manuellement." };

        const item = await globalThis.fromUuid(option.resultUuid);
        if (!item) return { applied: false, status: `${option.resultLabel} introuvable: à ajouter manuellement.` };

        const created = await addItemToActor(actor, item, quantity);
        return {
          applied: Boolean(created),
          entries: [{ index: 1, label: `${created?.name ?? option.resultLabel} × ${quantity}` }],
          status: created ? `${created.name ?? option.resultLabel} × ${quantity} ajouté à l'inventaire.` : `${option.resultLabel} × ${quantity} à ajouter manuellement.`
        };
      }

      if (option.resultType === HARVEST_RESULT_TYPES.rollTable) {
        if (!option.resultUuid) return { applied: false, status: "Table manquante: à lancer manuellement." };
        if (!globalThis.fromUuid) return { applied: false, status: "fromUuid indisponible: table à lancer manuellement." };

        const table = await globalThis.fromUuid(option.resultUuid);
        if (!table?.draw) return { applied: false, status: `${option.resultLabel} introuvable: table à lancer manuellement.` };

        const entries = [];
        for (let index = 0; index < quantity; index += 1) {
          const draw = await table.draw({ displayChat: true });
          entries.push({
            index: index + 1,
            label: getRollTableDrawLabel(draw, option.resultLabel)
          });
        }
        return { applied: true, entries, status: `${option.resultLabel} lancée ${quantity} fois dans le chat.` };
      }

      return {
        applied: true,
        entries: Array.from({ length: quantity }, (_, index) => ({
          index: index + 1,
          label: option.resultLabel ?? "Information uniquement dans le chat"
        })),
        status: quantity > 1
          ? `${option.resultLabel ?? "Information"} notée ${quantity} fois dans le chat.`
          : option.resultLabel ?? "Information postée dans le chat."
      };
    } catch (error) {
      console.error(`${MODULE_ID} | Récolte Pokémon impossible.`, error);
      return { applied: false, status: `${option.resultLabel ?? option.label} à appliquer manuellement (${error.message ?? error}).` };
    }
  }

  async handleHarvestDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove("dragging");
    if (this.state.currentActivity?.key === ACTIVITY_KEYS.pokemonHarvest) {
      ui.notifications.warn("Récolte déjà confirmée: le résultat est verrouillé.");
      return;
    }

    this.readForm(event.currentTarget.closest("form"));

    const transfer = event.originalEvent?.dataTransfer ?? event.dataTransfer;
    const raw = transfer?.getData("text/plain") || transfer?.getData("application/json");
    if (!raw) {
      ui.notifications.warn("Aucune donnée d'item détectée dans le dépôt.");
      return;
    }

    let dropData = null;
    try {
      dropData = JSON.parse(raw);
    } catch {
      ui.notifications.warn("Dépôt invalide. Glisse l'item depuis la fiche ou le compendium.");
      return;
    }

    const item = await resolveDroppedItem(dropData);
    const itemName = item?.name ?? dropData.name ?? "";
    if (!looksLikeShuckleBerryJuice(itemName)) {
      ui.notifications.warn("L'item déposé ne semble pas être Shuckle's Berry Juice.");
      return;
    }

    this.state.harvest.rareCandyIngredientConfirmed = true;
    this.state.harvest.rareCandyIngredientName = itemName || "Shuckle's Berry Juice";
    this.state.harvest.rareCandyIngredientUuid = item?.uuid ?? dropData.uuid ?? dropData.documentUuid ?? "";
    ui.notifications.info(`${this.state.harvest.rareCandyIngredientName} confirmé pour Juicer - Rare Candy.`);
    this.render(false);
  }

  async handleCraftDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove("dragging");
    if (this.state.currentActivity?.key === ACTIVITY_KEYS.crafting) {
      ui.notifications.warn("Fabrication déjà confirmée: le résultat est verrouillé.");
      return;
    }

    this.readForm(event.currentTarget.closest("form"));
    const target = event.currentTarget.dataset.dropTarget;
    const dropData = readDropData(event);
    if (!dropData) {
      ui.notifications.warn("Dépôt invalide. Glisse un item depuis un compendium, la sidebar Items ou l'inventaire du Trainer.");
      return;
    }

    const item = await resolveDroppedItem(dropData);
    if (!item) {
      ui.notifications.warn("Item introuvable pour ce dépôt.");
      return;
    }

    if (target === "craftResult") {
      if (this.state.crafting.type === "weapon") {
        ui.notifications.info("La Fabrication d'arme génère l'objet final automatiquement.");
        return;
      }
      this.state.crafting.itemUuid = item.uuid ?? dropData.uuid ?? dropData.documentUuid ?? "";
      this.state.crafting.itemName = item.name ?? "Objet fabriqué";
      this.state.crafting.itemType = item.type ?? "";
      ui.notifications.info(`${this.state.crafting.itemName} défini comme objet à fabriquer.`);
      this.render(false);
      return;
    }

    if (target === "craftIngredient") {
      const actor = this.actor;
      if (!actor || !isEmbeddedItemFromActor(item, actor)) {
        ui.notifications.warn("Les ingrédients doivent être glissés depuis l'inventaire du Trainer sélectionné.");
        return;
      }

      const itemId = item.id ?? item._id;
      const entryId = itemId || item.uuid;
      const existing = this.state.crafting.ingredients.find((ingredient) => ingredient.entryId === entryId);
      if (existing) {
        existing.quantity = Math.max(1, Math.trunc(Number(existing.quantity) || 1) + 1);
      } else {
        this.state.crafting.ingredients.push({
          entryId,
          itemId,
          uuid: item.uuid ?? "",
          name: item.name ?? "Ingrédient",
          quantity: 1,
          availableQuantity: getItemQuantity(item)
        });
      }
      ui.notifications.info(`${item.name} réservé comme ingrédient.`);
      this.render(false);
    }
  }

  async openCraftingJournal() {
    if (!globalThis.fromUuid) {
      ui.notifications.warn("Impossible d'ouvrir le journal: fromUuid indisponible.");
      return;
    }
    const journal = await globalThis.fromUuid(CRAFTING_JOURNAL_UUID);
    if (!journal) {
      ui.notifications.warn("Journal de fabrication introuvable.");
      return;
    }
    if (journal.sheet?.render) {
      journal.sheet.render(true);
    } else if (journal.render) {
      journal.render(true);
    }
  }

  removeCraftIngredient(entryId) {
    const id = stringValue(entryId);
    if (!id) return;
    this.state.crafting.ingredients = this.state.crafting.ingredients.filter((ingredient) => ingredient.entryId !== id);
    this.render(false);
  }

  updateCraftIngredientQuantity(entryId, value) {
    const id = stringValue(entryId);
    const ingredient = this.state.crafting.ingredients.find((entry) => entry.entryId === id);
    if (!ingredient) return;
    ingredient.quantity = readPositiveCount(value, ingredient.quantity);
  }

  async confirmCrafting() {
    const actor = this.actor;
    if (!actor) return;

    if (this.state.currentActivity) {
      ui.notifications.warn("Une activité a déjà été confirmée. Le résultat est conservé dans l'historique.");
      this.state.step = "summary";
      this.render(false);
      return;
    }

    const data = this.getData();
    const crafting = data.crafting;
    if (!crafting.canCraft) {
      ui.notifications.warn(crafting.requirementErrors?.[0] ?? "Fabrication impossible avec les données actuelles.");
      return;
    }
    if (!crafting.isWeaponCraft && !globalThis.fromUuid) {
      ui.notifications.warn("Impossible de résoudre l'objet final: fromUuid indisponible.");
      return;
    }

    const finalItem = crafting.isWeaponCraft ? crafting.weapon?.itemSource : await globalThis.fromUuid(crafting.itemUuid);
    if (!finalItem) {
      ui.notifications.warn(crafting.isWeaponCraft ? "Arme impossible à générer avec les données actuelles." : "Objet final introuvable. Redépose l'objet à fabriquer.");
      return;
    }

    const confirmed = await confirmDialog(
      "Confirmer la fabrication",
      `<p>Fabriquer ${escapeHtml(crafting.itemName)} x ${escapeHtml(crafting.quantity)} pour ${escapeHtml(crafting.costLabel)} et ${escapeHtml(crafting.moneyCostLabel)} ?</p>`
    );
    if (!confirmed) return;

    const refreshedBudget = this.getBudgetData(data.basePRQ, this.getPlannedActivities());
    const refreshed = this.getCraftingData(actor, refreshedBudget.availableByActivity[ACTIVITY_KEYS.crafting] ?? 0);
    const errors = getCraftRequirementErrors(actor, {
      itemUuid: refreshed.itemUuid,
      itemName: refreshed.itemName,
      generatedItem: refreshed.weapon?.itemSource ?? null,
      craftType: refreshed.selectedType,
      quantity: refreshed.quantity,
      costPRQ: refreshed.costPRQ,
      remainingBefore: refreshed.remainingBefore,
      moneyCost: refreshed.moneyCost,
      ingredients: refreshed.ingredients
    });
    if (errors.length > 0) {
      ui.notifications.warn(errors[0]);
      return;
    }

    if (refreshed.moneyCost > 0) {
      const paid = await deductMoney(actor, refreshed.moneyCost);
      if (!paid) {
        ui.notifications.warn("Impossible de retirer les Pokédollars du Trainer.");
        return;
      }
    }

    for (const ingredient of refreshed.ingredients) {
      const removed = await removeItemQuantity(actor, ingredient.itemId, ingredient.quantity);
      if (!removed) {
        ui.notifications.warn(`Impossible de retirer ${ingredient.name}. Vérifie l'inventaire.`);
        return;
      }
    }

    const created = await addItemToActor(actor, finalItem, refreshed.quantity);
    const resultStatus = created
      ? "Fabrication terminée."
      : "Ressources consommées; objet final à ajouter manuellement.";
    const ingredients = refreshed.ingredients.map((ingredient) => ({
      entryId: ingredient.entryId,
      itemId: ingredient.itemId,
      uuid: ingredient.uuid,
      name: ingredient.name,
      quantity: ingredient.quantity
    }));
    const activity = {
      key: ACTIVITY_KEYS.crafting,
      isCrafting: true,
      title: "Fabrication",
      description: refreshed.itemName,
      itemUuid: refreshed.itemUuid,
      itemName: refreshed.itemName,
      itemType: refreshed.itemType,
      craftType: refreshed.type,
      craftTypeLabel: refreshed.selectedTypeLabel,
      isWeaponCraft: refreshed.isWeaponCraft,
      weapon: refreshed.weapon,
      quantity: refreshed.quantity,
      costPRQ: refreshed.costPRQ,
      costLabel: refreshed.costLabel,
      moneyMode: refreshed.moneyMode,
      moneyValue: refreshed.moneyValue,
      moneyCost: refreshed.moneyCost,
      moneyCostLabel: refreshed.moneyCostLabel,
      moneyDelta: -refreshed.moneyCost,
      ingredients,
      hasIngredients: ingredients.length > 0,
      resultStatus,
      summaryLine: `${refreshed.itemName} × ${refreshed.quantity}`,
      rolls: [],
      totalGain: 0,
      applied: true
    };

    this.state.activities.push(activity);
    this.state.currentActivity = activity;
    const totals = this.getTotals();

    await postActivitySummary({
      actor,
      activity,
      activities: [activity],
      calendar: getCurrentWeekData(this.state.calendar),
      totalPRLabel: formatPRQ(totals.totalPRQ),
      spentPRLabel: formatPRQ(totals.spentPRQ),
      remainingPRLabel: formatPRQ(totals.remainingPRQ),
      isActivity: true
    });

    ui.notifications.info(resultStatus);
    this.state.step = "summary";
    this.render(false);
  }

  setGardenStage(stage) {
    const gardening = this.ensureGardeningState();
    gardening.stage = ["planting", "growth", "harvest"].includes(stage) ? stage : "planting";
    this.render(false);
  }

  addGardenSlot() {
    const gardening = this.ensureGardeningState();
    const maxBonusSlots = Math.max(0, Math.trunc(Number(setting(SETTINGS.maxBonusGardenSlots, 6)) || 0));
    const maxSlots = GARDEN_BASE_SLOTS + maxBonusSlots;
    if (gardening.slots.length >= maxSlots) {
      ui.notifications.warn(`Maximum d'emplacements atteint (${maxSlots}).`);
      return;
    }
    gardening.slots.push(createGardenSlot(gardening.slots.length, true));
    this.render(false);
  }

  removeGardenSlot(slotId) {
    const gardening = this.ensureGardeningState();
    const id = stringValue(slotId);
    const slot = gardening.slots.find((entry) => entry.id === id);
    if (!slot || !slot.bonus) return;
    gardening.slots = gardening.slots.filter((entry) => entry.id !== id);
    this.render(false);
  }

  async confirmGardening() {
    const actor = this.actor;
    if (!actor) return;

    if (this.state.currentActivity) {
      ui.notifications.warn("Une activité a déjà été confirmée. Le résultat est conservé dans l'historique.");
      this.state.step = "summary";
      this.render(false);
      return;
    }

    const data = this.getData();
    const gardening = data.gardening;
    if (!gardening.canConfirm) {
      ui.notifications.warn(gardening.requirementErrors?.[0] ?? "Agriculture impossible avec les données actuelles.");
      return;
    }

    const confirmed = await confirmDialog(
      "Confirmer l'Agriculture",
      `<p>Confirmer ${escapeHtml(gardening.plantedEntries.length)} plantation(s), ${escapeHtml(gardening.selectedHarvestCount)} récolte(s), pour ${escapeHtml(gardening.costLabel)} et ${escapeHtml(gardening.moneyCostLabel)} ?</p>`
    );
    if (!confirmed) return;

    if (gardening.moneyCost > 0) {
      const paid = await deductMoney(actor, gardening.moneyCost);
      if (!paid) {
        ui.notifications.warn("Impossible de retirer les Pokédollars du Trainer.");
        return;
      }
    }

    const harvestResults = [];
    for (const slot of gardening.selectedHarvestEntries) {
      harvestResults.push(await rollGardenHarvest(actor, gardening, slot));
    }

    const resultStatus = harvestResults.length > 0
      ? `${harvestResults.length} récolte(s) lancée(s). Lance les quantités depuis le résumé si désiré.`
      : (gardening.readyEntries.length > 0
        ? `${gardening.readyEntries.length} plante(s) prête(s), aucune récolte sélectionnée.`
        : "Croissance enregistrée; aucune plante prête cette semaine.");
    const activity = {
      key: ACTIVITY_KEYS.gardening,
      isGardening: true,
      title: "Agriculture / Jardinage",
      description: "Agriculture / Jardinage",
      plantedCount: gardening.plantedEntries.length,
      readyCount: gardening.readyEntries.length,
      harvestedCount: harvestResults.length,
      costPRQ: gardening.costPRQ,
      costLabel: gardening.costLabel,
      moneyCost: gardening.moneyCost,
      moneyCostLabel: gardening.moneyCostLabel,
      moneyDelta: -gardening.moneyCost,
      modifierSummary: gardening.modifierSummary,
      growthEntries: gardening.growthEntries,
      readyEntries: gardening.readyEntries,
      harvestResults,
      hasHarvestResults: harvestResults.length > 0,
      resultStatus,
      summaryLine: `${gardening.plantedEntries.length} plantation(s), ${gardening.readyEntries.length} prête(s), ${harvestResults.length} récoltée(s)`,
      rolls: harvestResults,
      totalGain: 0,
      applied: true
    };

    this.state.activities.push(activity);
    this.state.currentActivity = activity;
    const totals = this.getTotals();

    await postActivitySummary({
      actor,
      activity,
      activities: [activity],
      calendar: getCurrentWeekData(this.state.calendar),
      totalPRLabel: formatPRQ(totals.totalPRQ),
      spentPRLabel: formatPRQ(totals.spentPRQ),
      remainingPRLabel: formatPRQ(totals.remainingPRQ),
      isActivity: true
    });

    ui.notifications.info("Agriculture confirmée et ajoutée à l'historique.");
    this.state.step = "summary";
    this.render(false);
  }

  async rollGardenQuantity(slotId) {
    const actor = this.actor;
    const activity = this.state.currentActivity;
    if (!actor || activity?.key !== ACTIVITY_KEYS.gardening) return;
    const id = stringValue(slotId);
    const entry = (activity.harvestResults ?? []).find((result) => result.slotId === id);
    if (!entry) return;
    if (entry.quantityRolled) {
      ui.notifications.info("La quantité de cette récolte est déjà lancée.");
      return;
    }

    const roll = await new Roll(entry.quantityFormula).evaluate({ async: true });
    entry.quantity = Math.max(0, Math.trunc(Number(roll.total) || 0));
    entry.quantityRolled = true;
    entry.quantityRollTotal = entry.quantity;
    entry.quantityResultLabel = `${entry.quantity} × ${entry.plantName}`;
    if (roll.toMessage) {
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: `Quantité récoltée - ${entry.plantName}`
      });
    }
    activity.resultStatus = "Agriculture confirmée; quantités mises à jour dans le résumé.";
    ui.notifications.info(`Quantité récoltée: ${entry.quantityResultLabel}.`);
    this.render(false);
  }

  async postCurrentActivity() {
    const actor = this.actor;
    const activity = this.state.currentActivity;
    if (!actor || !activity) return;

    const totals = this.getTotals();
    await postActivitySummary({
      actor,
      activity,
      activities: [activity],
      calendar: getCurrentWeekData(this.state.calendar),
      totalPRLabel: formatPRQ(totals.totalPRQ),
      spentPRLabel: formatPRQ(totals.spentPRQ),
      remainingPRLabel: formatPRQ(totals.remainingPRQ),
      isActivity: true
    });
    ui.notifications.info("Résumé d'activité posté dans le chat.");
  }

  async applyWorkGains() {
    const actor = this.actor;
    const activity = this.state.currentActivity;
    if (!actor || !activity) return;
    if (!(actor.isOwner || game.user?.isGM)) {
      ui.notifications.warn("Seul le propriétaire ou un MJ peut appliquer les gains.");
      return;
    }
    if (activity.applied) {
      ui.notifications.info("Les gains ont déjà été appliqués.");
      return;
    }

    const confirmed = await confirmDialog(
      "Appliquer les gains",
      `<p>Ajouter ${escapeHtml(activity.totalGain)}₽ à ${escapeHtml(actor.name)} ?</p>`
    );
    if (!confirmed) return;

    await addMoney(actor, activity.totalGain);
    activity.applied = true;
    activity.moneyDelta = activity.totalGain;
    ui.notifications.info(`Gains appliqués à ${actor.name}.`);
    this.render(false);
  }

  async applyGainsAndStartNewActivity() {
    await this.applyWorkGains();
    if (!this.state.currentActivity?.applied) return;
    await this.startNewActivity();
  }

  async startNewActivity() {
    if (!this.state.currentActivity) return;
    if (!this.state.currentActivity.applied) {
      ui.notifications.warn("Applique les gains avant de commencer une nouvelle activite.");
      return;
    }

    const totals = this.getTotals();
    if (!canStartAnyEnabledActivity(totals.budget)) {
      ui.notifications.warn("PR insuffisants pour commencer une autre activité.");
      this.render(false);
      return;
    }

    this.state.currentActivity = null;
    this.resetWorkState();
    this.resetHarvestState();
    this.resetCraftingState();
    this.resetGardeningState();
    this.state.step = "activity";
    this.render(false);
  }

  startNewMaintenance() {
    const actor = this.actor;
    if (!actor) {
      this.state.step = "trainer";
      this.render(false);
      return;
    }

    this.state.calendar = { ...DEFAULT_WEEK_DATA };
    this.state.prBonuses = createEmptyPrBonuses();
    this.state.selectedActivity = ACTIVITY_KEYS.work;
    this.state.prSkillKey = normalizePrSkill(this.state.prSkillKey, getBestSkill(actor, "work")?.key ?? "generalEd");
    this.resetActivityState(this.state.prSkillKey);
    this.state.step = "pr";
    this.render(false);
  }

  async finishMaintenance() {
    const actor = this.actor;
    const plannedActivities = this.getPlannedActivities();
    if (!actor || plannedActivities.length === 0) return;
    if (this.isCurrentWeekLocked()) {
      ui.notifications.warn("Cet entretien est déjà finalisé pour cette semaine.");
      return;
    }

    const totals = this.getTotals();
    const calendar = getCurrentWeekData(this.state.calendar);
    const activities = plannedActivities.map((activity) => sanitizeActivity(activity));
    const weekData = {
      weekKey: calendar.weekKey,
      calendarLabel: calendar.calendarLabel,
      eventName: calendar.eventName,
      eventDescription: calendar.eventDescription,
      actorId: actor.id,
      actorName: actor.name,
      totalPRQ: totals.totalPRQ,
      spentPRQ: totals.spentPRQ,
      remainingPRQ: totals.remainingPRQ,
      activities,
      createdBy: game.user?.id ?? null,
      createdAt: new Date().toISOString(),
      finalized: true
    };

    await saveWeek(actor, weekData);
    await postFinalSummary({
      actor,
      activity: this.state.currentActivity ?? plannedActivities.at(-1),
      activities,
      calendar,
      totalPRLabel: formatPRQ(totals.totalPRQ),
      spentPRLabel: formatPRQ(totals.spentPRQ),
      remainingPRLabel: formatPRQ(totals.remainingPRQ),
      isFinal: true
    });

    this.state.finalized = true;
    ui.notifications.info("Entretien hebdomadaire finalise.");
    this.render(false);
  }

  async unlockCurrentWeek() {
    const actor = this.actor;
    if (!actor || !game.user?.isGM) return;
    const calendar = getCurrentWeekData(this.state.calendar);
    const confirmed = await confirmDialog(
      "Deverrouiller la semaine",
      `<p>Autoriser un nouvel entretien pour ${escapeHtml(actor.name)} pendant ${escapeHtml(calendar.calendarLabel)} ?</p>`
    );
    if (!confirmed) return;
    await unlockWeek(actor, calendar.weekKey);
    ui.notifications.info("Semaine deverrouillee.");
    this.render(false);
  }

  getTotals() {
    const actor = this.actor;
    const pr = actor ? calculatePR(actor, "work", {
      manualLevel: this.state.manualLevel,
      manualPower: this.state.manualPower,
      skillKey: this.state.prSkillKey
    }) : null;
    const budget = this.getBudgetData(pr?.totalPRQ ?? 0, this.getPlannedActivities());
    return {
      totalPRQ: budget.totalPRQ,
      spentPRQ: budget.spentPRQ,
      remainingPRQ: budget.remainingPRQ,
      budget
    };
  }

  isCurrentWeekLocked() {
    const actor = this.actor;
    if (!actor || !setting(SETTINGS.lockWeeks, true)) return false;
    const calendar = getCurrentWeekData(this.state.calendar);
    return isWeekFinalized(actor, calendar.weekKey);
  }

  goBack() {
    if (this.state.step === "summary" && this.state.currentActivity?.key === ACTIVITY_KEYS.crafting) {
      this.state.step = "crafting";
    } else if (this.state.step === "summary" && this.state.currentActivity?.key === ACTIVITY_KEYS.pokemonHarvest) {
      this.state.step = "harvest";
    } else if (this.state.step === "summary" && this.state.currentActivity?.key === ACTIVITY_KEYS.gardening) {
      this.state.step = "gardening";
    } else if (this.state.step === "summary" && this.state.currentActivity?.key === ACTIVITY_KEYS.work) {
      this.state.step = "work";
    } else if (this.state.step === "work" || this.state.step === "harvest" || this.state.step === "crafting" || this.state.step === "gardening") {
      this.state.step = "activity";
    } else if (this.state.step === "activity") {
      this.state.step = "pr";
    } else if (this.state.step === "pr") {
      this.state.step = "trainer";
    } else {
      this.state.step = "trainer";
    }
    this.render(false);
  }

  resetActivityState(skillKey = this.state.prSkillKey) {
    this.resetWorkState(skillKey);
    this.resetHarvestState();
    this.resetCraftingState();
    this.resetGardeningState();
    this.state.activities = [];
    this.state.currentActivity = null;
    this.state.finalized = false;
  }

  resetWorkState(skillKey = this.state.prSkillKey) {
    const normalizedSkill = normalizeMaintenanceSkill(skillKey, "generalEd");
    this.state.work = {
      description: "",
      skillKey: normalizedSkill,
      count: 1,
      rolls: [],
      totalGain: 0
    };
  }

  resetHarvestState() {
    this.state.harvest = {
      harvestKey: POKEMON_HARVEST_OPTIONS[0]?.key ?? "",
      count: 1,
      pokemonId: "",
      pokemonName: "",
      secondPokemonName: "",
      ownsPokemon: false,
      paleontologyConfirmed: false,
      rareCandyIngredientConfirmed: false,
      rareCandyIngredientName: "",
      rareCandyIngredientUuid: ""
    };
  }

  resetCraftingState() {
    this.state.crafting = {
      itemUuid: "",
      itemName: "",
      itemType: "",
      type: "normal",
      quantity: 1,
      moneyMode: "total",
      moneyValue: 0,
      weapon: createDefaultWeaponCraftingState(),
      ingredients: []
    };
  }

  resetGardeningState() {
    this.state.gardening = createDefaultGardeningState();
  }

  selectTrainer(actor) {
    this.state.actorId = getActorKey(actor);
    this.state.step = this.state.startWeaponCrafting ? "crafting" : "pr";
    const bestSkill = getBestSkill(actor, "work");
    this.state.prSkillKey = normalizePrSkill(bestSkill?.key, "generalEd");
    this.resetActivityState(this.state.prSkillKey);
    if (this.state.startWeaponCrafting) {
      this.state.selectedActivity = ACTIVITY_KEYS.crafting;
      this.state.crafting.type = "weapon";
    }
    this.debugSelection("select-trainer", this.state.actorId, actor);
    this.render(false);
  }

  debugSelection(scope, actorId, actor = null) {
    if (!setting(SETTINGS.debug, false)) return;
    console.log(`${MODULE_ID} | ${scope}`, {
      actorId,
      resolved: Boolean(actor ?? getActorByKey(actorId)),
      actorName: (actor ?? getActorByKey(actorId))?.name ?? null,
      trainerCount: getAvailableTrainers().length
    });
  }
}

function getVisibleSteps(state) {
  const actionStep = state.step === "crafting"
    || state.selectedActivity === ACTIVITY_KEYS.crafting
    || state.currentActivity?.key === ACTIVITY_KEYS.crafting
    ? { key: "crafting", label: "Fabrication" }
    : state.step === "harvest"
    || state.selectedActivity === ACTIVITY_KEYS.pokemonHarvest
    || state.currentActivity?.key === ACTIVITY_KEYS.pokemonHarvest
    ? { key: "harvest", label: "Récolte" }
    : state.step === "gardening"
    || state.selectedActivity === ACTIVITY_KEYS.gardening
    || state.currentActivity?.key === ACTIVITY_KEYS.gardening
    ? { key: "gardening", label: "Jardinage" }
    : { key: "work", label: "Petit Travail" };

  return [
    STEPS[0],
    STEPS[1],
    STEPS[2],
    actionStep,
    STEPS[4]
  ];
}

function createDefaultWeaponCraftingState() {
  const category = WEAPON_CRAFTING_CATEGORIES[0];
  return {
    name: "",
    categoryKey: category?.key ?? "",
    baseKey: category?.bases?.[0]?.key ?? "",
    tier1MoveKey: category?.tier1?.[0]?.key ?? "",
    tier2MoveKey: category?.tier2?.[0]?.key ?? ""
  };
}

function createDefaultGardeningState() {
  return {
    stage: "planting",
    harvestSkillMode: "survival",
    modifiers: createDefaultGardenModifiers(),
    naturalSpecialty: createDefaultNaturalSpecialty(),
    slots: Array.from({ length: GARDEN_BASE_SLOTS }, (_, index) => createGardenSlot(index))
  };
}

function createDefaultGardenModifiers() {
  return {
    sprouterCount: 0,
    sprouterAll: false,
    gardenerCount: 0,
    expertCount: 0,
    mulchCount: 0,
    fertilizerCount: 0,
    terrainCount: 0
  };
}

function createDefaultNaturalSpecialty() {
  return {
    enabled: false,
    type: GARDEN_PLANT_TYPES[0]?.key ?? "berry",
    name: ""
  };
}

function createGardenSlot(index = 0, bonus = false) {
  const number = index + 1;
  return {
    id: bonus ? createLocalId("garden") : `base-${number}`,
    number,
    bonus,
    name: "",
    type: GARDEN_PLANT_TYPES[0]?.key ?? "berry",
    tier: GARDEN_TIERS[0]?.key ?? "1",
    freeReplant: false,
    remainingWeeks: "",
    soilQuality: 0,
    yieldBonus: 0,
    reason: "",
    notes: "",
    sprouter: false,
    gardener: false,
    expert: false,
    mulch: false,
    fertilizer: false,
    terrain: false,
    harvest: true
  };
}

function calculateGardenEntries(state, skill) {
  const modifiers = state.modifiers ?? createDefaultGardenModifiers();
  return (state.slots ?? []).map((slot, index) => {
    const type = normalizeGardenPlantType(slot.type);
    const tier = normalizeGardenTier(slot.tier);
    const tierNumber = Number(tier) || 1;
    const baseWeeks = getBaseGrowthWeeks(type, tierNumber);
    const isPlanted = Boolean(stringValue(slot.name));
    const currentRemainingWeeks = slot.remainingWeeks === "" || slot.remainingWeeks === null || slot.remainingWeeks === undefined
      ? baseWeeks
      : readNonNegativeCount(slot.remainingWeeks);
    const currentSoilQuality = clampNumber(slot.soilQuality, 0, 6);
    const currentYieldBonus = readNonNegativeCount(slot.yieldBonus);
    const sprouterApplied = isPlanted && modifiers.sprouterCount > 0 && (modifiers.sprouterAll || slot.sprouter);
    const gardenerApplied = isPlanted && Boolean(slot.gardener);
    const expertApplied = isPlanted && Boolean(slot.expert);
    const mulchApplied = isPlanted && Boolean(slot.mulch);
    const fertilizerApplied = isPlanted && Boolean(slot.fertilizer);
    const terrainApplied = isPlanted && Boolean(slot.terrain);
    const soilBonus = (sprouterApplied ? 2 * Math.max(0, modifiers.sprouterCount) : 0)
      + (gardenerApplied ? 1 : 0)
      + (expertApplied ? 2 : 0)
      + (mulchApplied ? 1 : 0);
    const finalSoilQuality = clampNumber(currentSoilQuality + soilBonus, 0, 6);
    const soilReduction = Math.floor(finalSoilQuality / 2);
    const fertilizerReduction = fertilizerApplied ? 1 : 0;
    const remainingAfterModifiers = Math.max(0, currentRemainingWeeks - soilReduction - fertilizerReduction);
    const modifierYieldBonus = (gardenerApplied ? 1 : 0)
      + (expertApplied ? 2 : 0)
      + (mulchApplied ? 1 : 0)
      + (terrainApplied ? 4 : 0);
    const finalYieldBonus = Math.max(0, currentYieldBonus + modifierYieldBonus);
    const ready = Boolean(isPlanted && remainingAfterModifiers <= 0);

    return {
      ...slot,
      number: index + 1,
      type,
      tier,
      tierNumber,
      typeLabel: getGardenPlantTypeLabel(type),
      tierLabel: getGardenTierLabel(tier),
      typeOptions: GARDEN_PLANT_TYPES.map((option) => ({ ...option, selected: option.key === type })),
      tierOptions: GARDEN_TIERS.map((option) => ({ ...option, selected: option.key === tier })),
      baseWeeks,
      isPlanted,
      currentRemainingWeeks,
      currentSoilQuality,
      currentYieldBonus,
      sprouterApplied,
      gardenerApplied,
      expertApplied,
      mulchApplied,
      fertilizerApplied,
      terrainApplied,
      soilBonus,
      finalSoilQuality,
      soilReduction,
      fertilizerReduction,
      remainingAfterModifiers,
      modifierYieldBonus,
      finalYieldBonus,
      ready,
      harvest: Boolean(slot.harvest && ready),
      statusLabel: ready ? "Prête" : `${remainingAfterModifiers} semaine(s) restante(s)`,
      skillLabel: skill?.label ?? "Survival",
      skillRankLabel: skill?.rankLabel ?? getRankLabel(0),
      canRemove: Boolean(slot.bonus)
    };
  });
}

function getGardenModifierSummary(state, plantedEntries) {
  const modifiers = state.modifiers ?? createDefaultGardenModifiers();
  const sprouterTargets = modifiers.sprouterAll
    ? plantedEntries.length
    : plantedEntries.filter((slot) => slot.sprouter).length;
  const gardenerTargets = plantedEntries.filter((slot) => slot.gardener).length;
  const expertTargets = plantedEntries.filter((slot) => slot.expert).length;
  const mulchTargets = plantedEntries.filter((slot) => slot.mulch).length;
  const fertilizerTargets = plantedEntries.filter((slot) => slot.fertilizer).length;
  const terrainTargets = plantedEntries.filter((slot) => slot.terrain).length;
  const sprouterCostPRQ = sprouterTargets > 0 ? Math.max(0, modifiers.sprouterCount) : 0;
  const mulchCostPRQ = Math.max(0, modifiers.mulchCount);
  const fertilizerCostPRQ = Math.max(0, modifiers.fertilizerCount);
  const terrainCostPRQ = Math.max(0, modifiers.terrainCount);
  const moneyCost = (mulchCostPRQ * 200) + (terrainCostPRQ * 300);
  const costPRQ = sprouterCostPRQ + mulchCostPRQ + fertilizerCostPRQ + terrainCostPRQ;

  return {
    sprouterTargets,
    gardenerTargets,
    expertTargets,
    mulchTargets,
    fertilizerTargets,
    terrainTargets,
    sprouterCostPRQ,
    mulchCostPRQ,
    fertilizerCostPRQ,
    terrainCostPRQ,
    costPRQ,
    costLabel: formatPRQ(costPRQ),
    moneyCost,
    moneyCostLabel: formatMoney(moneyCost),
    limits: [
      { key: "gardener", label: "Gardener", count: modifiers.gardenerCount, affected: gardenerTargets, capacity: modifiers.gardenerCount * 4 },
      { key: "expert", label: "Expert Botanist", count: modifiers.expertCount, affected: expertTargets, capacity: modifiers.expertCount * 6 },
      { key: "mulch", label: "Mulch", count: modifiers.mulchCount, affected: mulchTargets, capacity: modifiers.mulchCount * 4 },
      { key: "fertilizer", label: "Fertilizer", count: modifiers.fertilizerCount, affected: fertilizerTargets, capacity: modifiers.fertilizerCount * 4 },
      { key: "terrain", label: "Terrain Soils", count: modifiers.terrainCount, affected: terrainTargets, capacity: modifiers.terrainCount * 4 }
    ]
  };
}

function getGardeningRequirementErrors(actor, context) {
  const errors = [];
  if (!actor) errors.push("Choisis un Trainer avant de faire l'Agriculture.");
  if (!(actor?.isOwner || game.user?.isGM)) errors.push("Seul le propriétaire ou un MJ peut confirmer l'Agriculture.");
  if (context.plantedEntries.length === 0) errors.push("Ajoute au moins une plante ou un objet planté.");
  if (context.remainingBefore < context.costPRQ) errors.push(`PR insuffisants: ${formatPRQ(context.costPRQ)} requis.`);
  if (getMoney(actor) < context.moneyCost) errors.push(`Argent insuffisant: ${formatMoney(context.moneyCost)} requis.`);
  if (context.modifierSummary.sprouterTargets > 0 && context.modifierSummary.sprouterCostPRQ <= 0) {
    errors.push("Sprouter cible des plantations, mais aucun Sprouter utilisé n'est indiqué.");
  }
  for (const limit of context.modifierSummary.limits) {
    if (limit.affected > limit.capacity) {
      errors.push(`${limit.label}: ${limit.affected} plantation(s) ciblée(s), maximum ${limit.capacity}.`);
    }
  }
  return errors;
}

async function rollGardenHarvest(actor, gardening, slot) {
  const skill = gardening.skill ?? getSkillRank(actor, "survival");
  const natural = getNaturalSpecialtyBonus(gardening.naturalSpecialty, slot);
  const rollBonus = natural.rollBonus;
  const yieldBonus = Math.max(0, slot.finalYieldBonus + natural.yieldBonus);
  const formula = buildGardenHarvestFormula(skill, slot.finalSoilQuality, rollBonus, gardening.harvestRollUsesSkillDice);
  const roll = await new Roll(formula).evaluate({ async: true });
  const total = Math.trunc(Number(roll.total) || 0);
  const resultLabel = getGardenHarvestResultLabel(total);
  const quantityFormula = getGardenQuantityFormula(total, yieldBonus);
  const freeReplantThreshold = Math.max(1, Math.trunc(Number(gardening.freeReplantThreshold) || 8));
  const freeReplantAvailable = total >= freeReplantThreshold;

  return {
    slotId: slot.id,
    plantName: slot.name,
    type: slot.type,
    typeLabel: slot.typeLabel,
    tier: slot.tier,
    tierLabel: slot.tierLabel,
    soilQuality: slot.finalSoilQuality,
    yieldBonus,
    skillKey: "survival",
    skillLabel: skill.label,
    skillRankLabel: skill.rankLabel,
    formula,
    total,
    resultLabel,
    quantityFormula,
    quantityRolled: false,
    quantity: null,
    naturalSpecialtyApplied: natural.applied,
    naturalSpecialtyLabel: natural.label,
    freeReplantAvailable,
    freeReplantThreshold,
    freeReplantLabel: freeReplantAvailable
      ? "Reprise gratuite disponible; Soil Quality repasse à 0 après récolte."
      : "Pas de reprise gratuite."
  };
}

function buildGardenHarvestFormula(skill, soilQuality, rollBonus, usesSkillDice) {
  const soil = Math.max(0, Math.trunc(Number(soilQuality) || 0));
  const bonus = Math.trunc(Number(rollBonus) || 0);
  if (usesSkillDice) {
    const diceCount = Math.max(0, Math.trunc(Number(skill?.diceCount) || 0));
    const skillPart = diceCount > 0 ? `${diceCount}d6` : "0";
    return `1d6 + ${skillPart} + ${soil} + 2 + ${bonus}`;
  }
  const rank = Math.max(0, Math.trunc(Number(skill?.rank) || 0));
  return `1d6 + ${rank} + ${soil} + 2 + ${bonus}`;
}

function getGardenHarvestResultLabel(total) {
  if (total <= 7) return "Mauvaise Récolte";
  if (total <= 10) return "Correct";
  if (total <= 13) return "Bonne Récolte";
  if (total <= 16) return "Excellente Récolte";
  if (total <= 29) return "Exceptionnelle Récolte";
  return "Récolte Parfaite";
}

function getGardenQuantityFormula(total, yieldBonus) {
  const bonus = Math.max(0, Math.trunc(Number(yieldBonus) || 0));
  if (total <= 7) return `1 + ${bonus}`;
  if (total <= 10) return `1d3 + ${bonus}`;
  if (total <= 13) return `1d4 + ${bonus}`;
  if (total <= 16) return `1d6 + 1 + ${bonus}`;
  if (total <= 29) return `1d10 + 2 + ${bonus}`;
  return `2d6 + 3 + ${bonus}`;
}

function getNaturalSpecialtyBonus(natural, slot) {
  if (!natural?.enabled) return { applied: false, rollBonus: 0, yieldBonus: 0, label: "" };
  const typeMatches = normalizeGardenPlantType(natural.type) === slot.type;
  if (!typeMatches) return { applied: false, rollBonus: 0, yieldBonus: 0, label: "Natural Specialty sans correspondance." };
  const exactName = normalizeSearchText(natural.name);
  const nameMatches = exactName && normalizeSearchText(slot.name) === exactName;
  const yieldBonus = 3 + (nameMatches ? 3 : 0);
  return {
    applied: true,
    rollBonus: 3,
    yieldBonus,
    label: nameMatches ? "Natural Specialty type + nom exact: +3 jet, +6 Yield." : "Natural Specialty type: +3 jet, +3 Yield."
  };
}

function getBaseGrowthWeeks(plantType, tier) {
  if (plantType === "apricorn") return 2;
  const value = Number(tier) || 1;
  if (value === 1 || value === 2) return 1;
  if (value === 3) return 2;
  return 4;
}

function normalizeGardenPlantType(value, fallback = GARDEN_PLANT_TYPES[0]?.key ?? "berry") {
  const key = stringValue(value);
  if (GARDEN_PLANT_TYPES.some((type) => type.key === key)) return key;
  if (GARDEN_PLANT_TYPES.some((type) => type.key === fallback)) return fallback;
  return GARDEN_PLANT_TYPES[0]?.key ?? "berry";
}

function normalizeGardenTier(value, fallback = GARDEN_TIERS[0]?.key ?? "1") {
  const key = stringValue(value);
  if (GARDEN_TIERS.some((tier) => tier.key === key)) return key;
  if (GARDEN_TIERS.some((tier) => tier.key === fallback)) return fallback;
  return GARDEN_TIERS[0]?.key ?? "1";
}

function normalizeGardenHarvestSkillMode(value) {
  return stringValue(value) === "best" ? "best" : "survival";
}

function getGardenPlantTypeLabel(key) {
  return GARDEN_PLANT_TYPES.find((type) => type.key === key)?.label ?? key;
}

function getGardenTierLabel(key) {
  return GARDEN_TIERS.find((tier) => tier.key === key)?.label ?? `Tier ${key}`;
}

function normalizeWeaponCategoryKey(value, fallback = WEAPON_CRAFTING_CATEGORIES[0]?.key ?? "") {
  const key = stringValue(value);
  if (WEAPON_CRAFTING_CATEGORIES.some((category) => category.key === key)) return key;
  if (WEAPON_CRAFTING_CATEGORIES.some((category) => category.key === fallback)) return fallback;
  return WEAPON_CRAFTING_CATEGORIES[0]?.key ?? "";
}

function getWeaponCategory(key) {
  return WEAPON_CRAFTING_CATEGORIES.find((category) => category.key === key) ?? WEAPON_CRAFTING_CATEGORIES[0];
}

function getWeaponBase(category, key) {
  return category?.bases?.find((base) => base.key === key) ?? category?.bases?.[0] ?? {};
}

function getWeaponMoveOptions(category, tier, base) {
  return (category?.[tier] ?? []).filter((move) => {
    if (move.twoHandedOnly && base.hands !== "two") return false;
    if (move.heavyOnly && base.shield !== "heavy") return false;
    return true;
  });
}

function getWeaponMoveFromOptions(options, key) {
  return options.find((move) => move.key === key) ?? options[0] ?? null;
}

function buildWeaponItemName(category, base, moves) {
  const musical = moves.some((move) => move.musicalSurcharge);
  const prefix = musical ? "Musical " : "";
  return `${prefix}${category.label} - ${base.label}`;
}

function buildWeaponSummaryLines(category, base, moves, baseCost, surcharge) {
  const moveRankSkill = getWeaponMoveRankSkill(category);
  const lines = [
    `${category.label} - ${base.label}`,
    `Coût base: ${formatMoney(baseCost)}`,
    `Moves: ${moves.map((move) => move.label).join(", ")}`,
    `Rang des Moves: ${moveRankSkill}`
  ];
  if (surcharge > 0) lines.push(`Surtaxe Musical Weapon: ${formatMoney(surcharge)}`);
  if (category.key === "shield") {
    lines.push(`Bonus évasion passif: +${base.evasionBonus ?? 0}`);
    if (base.actionDescription) lines.push(base.actionDescription);
  } else {
    if (base.reach) {
      lines.push("Bonus arme Reach: +1 Accuracy, +2 DB et capacité Reach.");
    } else {
      lines.push(base.hands === "two" ? "Bonus arme à deux mains: +1 Accuracy et +1 DB." : "Bonus arme à une main: +1 DB.");
    }
    if (base.accuracyPenalty) lines.push(`Portée: ${base.rangeLabel}; ${base.accuracyPenalty} Accuracy.`);
  }
  return lines;
}

function buildWeaponDescription(category, base, moves, baseCost, surcharge, keywords, effectText) {
  const summary = buildWeaponSummaryLines(category, base, moves, baseCost, surcharge)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("");
  const moveList = moves.map((move) => `<li>${escapeHtml(move.label)} (${move.uuids.map((uuid) => escapeHtml(uuid)).join(", ")})</li>`).join("");
  const effect = base.effectUuid ? `<p><strong>Effet lié:</strong> ${escapeHtml(base.effectUuid)}</p>` : "";
  const keywordText = keywords.length ? `<p><strong>Keywords:</strong> ${escapeHtml(keywords.join(", "))}</p>` : "";
  const effectHtml = effectText
    ? `<p><strong>Effect:</strong><br>${escapeHtml(effectText).replace(/\n/g, "<br>")}</p>`
    : "";
  return [
    `<p><strong>Fabrication d'arme Pokémon FG</strong></p>`,
    keywordText,
    effectHtml,
    `<ul>${summary}</ul>`,
    `<p><strong>Moves accordés:</strong></p>`,
    `<ul>${moveList}</ul>`,
    effect
  ].join("");
}

function buildWeaponKeywords(category, base) {
  const keywords = ["Weapon"];
  if (category.key === "shield") {
    keywords.push("Shield");
    if (base.shield === "light") keywords.push("Light Shield");
    if (base.shield === "heavy") keywords.push("Heavy Shield");
    return [...new Set(keywords)];
  }

  if (category.key.includes("magic")) keywords.push("Magic");
  if (category.key.toLowerCase().includes("melee")) keywords.push("Melee");
  if (category.key.toLowerCase().includes("ranged")) keywords.push("Ranged");
  if (base.hands === "one") keywords.push("One-Handed");
  if (base.hands === "two") keywords.push("Two-Handed");
  if (base.reach) keywords.push("Reach");
  return [...new Set(keywords)];
}

function getWeaponMoveRankSkill(category) {
  return category.key.includes("magic") ? "Focus" : "Combat";
}

function buildWeaponEffectText(category, base, moves, moveRankSkill) {
  const lines = [];
  const moveRefs = moves.map((move, index) => {
    const tier = index === 0 ? "Adept Move" : "Expert Move";
    return `${tier} ${formatMoveUuidReferences(move)}`;
  });

  if (category.key === "shield") {
    lines.push(`${base.label}: bonus passif de +${base.evasionBonus ?? 0} Evasion.`);
    if (base.actionDescription) lines.push(base.actionDescription);
    if (base.effectUuid) lines.push(`Effet lié: @UUID[${base.effectUuid}].`);
  } else {
    const range = base.rangeLabel ? ` (${base.rangeLabel})` : "";
    if (base.reach) {
      lines.push(`${base.label}${range}: +2 Damage Base et +1 Accuracy sur les moves weapon; accorde la capacité @UUID[${REACH_CAPABILITY_UUID}]{Reach}.`);
    } else if (base.hands === "two") {
      lines.push(`${base.label}${range}: +1 Damage Base et +1 Accuracy sur les moves weapon.`);
    } else {
      lines.push(`${base.label}${range}: +1 Damage Base sur les moves weapon.`);
    }
    if (base.accuracyPenalty) lines.push(`${base.rangeLabel}: ${base.accuracyPenalty} Accuracy.`);
  }
  lines.push(`Le rang des Moves accordés dépend du skill ${moveRankSkill}: Combat pour une arme normale, Focus pour une arme magique.`);

  if (moveRefs.length > 0) lines.push(`Moves accordés: ${moveRefs.join("; ")}.`);
  return lines.join("\n");
}

function formatMoveUuidReferences(move) {
  return move.uuids.map((uuid) => `@UUID[${uuid}]{${move.label}}`).join(", ");
}

function buildFlatModifierRule(label, selectors, value, predicate = []) {
  const rule = {
    key: "FlatModifier",
    label,
    selectors,
    value
  };
  if (predicate.length > 0) rule.predicate = predicate;
  return rule;
}

function buildWeaponRules(category, base, moves) {
  const rules = moves.flatMap((move) => move.uuids.map((uuid) => ({
    key: "GrantItem",
    uuid,
    label: move.label
  })));

  if (category.key === "shield") {
    rules.push(buildFlatModifierRule(`${base.label}: Evasion`, "evasion", base.evasionBonus ?? 0));
    if (base.effectUuid) {
      rules.push({
        key: "GrantItem",
        uuid: base.effectUuid,
        label: `${base.label}: effet d'action standard`
      });
    }
    return rules;
  }

  if (base.reach) {
    rules.push(
      buildFlatModifierRule("large-melee", "damage-base", 2, ["move:weapon"]),
      buildFlatModifierRule("large-melee", "attack-roll", -1, ["move:weapon"]),
      {
        key: "GrantItem",
        uuid: REACH_CAPABILITY_UUID,
        label: "Reach"
      }
    );
  } else {
    rules.push(buildFlatModifierRule(base.key, "damage-base", 1, ["move:weapon"]));
    if (base.hands === "two") {
      rules.push(buildFlatModifierRule(base.key, "attack-roll", -1, ["move:weapon"]));
    }
  }
  if (base.accuracyPenalty) {
    rules.push(buildFlatModifierRule(`${base.key}-range`, "attack-roll", Math.abs(base.accuracyPenalty), ["move:weapon"]));
  }
  return rules;
}

function buildWeaponItemSource(data) {
  return {
    name: data.itemName,
    type: "item",
    system: {
      quantity: 1,
      cost: data.moneyCost,
      category: "Equipment",
      keywords: data.keywords,
      effect: data.effectText,
      snippet: data.effectText.split("\n")[0] ?? "",
      referenceEffect: data.base.effectUuid ?? "",
      description: {
        value: data.description
      },
      rules: data.rules
    },
    flags: {
      [MODULE_ID]: {
        weaponCrafting: {
          categoryKey: data.category.key,
          categoryLabel: data.category.label,
          baseKey: data.base.key,
          baseLabel: data.base.label,
          baseCost: data.baseCost,
          surcharge: data.surcharge,
          moneyCost: data.moneyCost,
          moves: data.selectedMoves.map((move) => ({
            key: move.key,
            label: move.label,
            uuids: move.uuids
          }))
        }
      }
    }
  };
}

function createEmptyPrBonuses() {
  return {
    global: "",
    crafting: "",
    harvest: "",
    work: "",
    gardening: ""
  };
}

function getPrBonusStateKey(fieldName) {
  switch (fieldName) {
    case "bonusPR": return "global";
    case "bonusPRCrafting": return "crafting";
    case "bonusPRHarvest": return "harvest";
    case "bonusPRWork": return "work";
    case "bonusPRGardening": return "gardening";
    default: return null;
  }
}

function readPrBonusPRQ(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.max(0, toPRQ(number));
}

function canStartAnyEnabledActivity(budget) {
  if (!budget?.availableByActivity) return false;
  const enabledKeys = new Set(ACTIVITY_OPTIONS.filter((option) => option.enabled).map((option) => option.key));

  if (enabledKeys.has(ACTIVITY_KEYS.work) && (budget.availableByActivity[ACTIVITY_KEYS.work] ?? 0) >= ACTIVITY_COSTS_PRQ.work) {
    return true;
  }

  if (enabledKeys.has(ACTIVITY_KEYS.crafting)) {
    const cheapestCrafting = Math.min(...CRAFTING_TYPES
      .filter((type) => type.enabled)
      .map((type) => type.costPRQ)
      .filter((cost) => Number.isFinite(cost) && cost > 0));
    if (Number.isFinite(cheapestCrafting) && (budget.availableByActivity[ACTIVITY_KEYS.crafting] ?? 0) >= cheapestCrafting) {
      return true;
    }
  }

  if (enabledKeys.has(ACTIVITY_KEYS.pokemonHarvest)) {
    const cheapestHarvest = Math.min(...POKEMON_HARVEST_OPTIONS
      .map((option) => option.costPRQ)
      .filter((cost) => Number.isFinite(cost) && cost > 0));
    if (Number.isFinite(cheapestHarvest) && (budget.availableByActivity[ACTIVITY_KEYS.pokemonHarvest] ?? 0) >= cheapestHarvest) {
      return true;
    }
  }

  if (enabledKeys.has(ACTIVITY_KEYS.gardening) && (budget.availableByActivity[ACTIVITY_KEYS.gardening] ?? 0) >= ACTIVITY_COSTS_PRQ.gardenHarvest) {
    return true;
  }

  return false;
}

function getHarvestOption(key) {
  return POKEMON_HARVEST_OPTIONS.find((option) => option.key === key) ?? POKEMON_HARVEST_OPTIONS[0] ?? null;
}

function normalizeHarvestKey(value, fallback = POKEMON_HARVEST_OPTIONS[0]?.key ?? "") {
  const key = stringValue(value);
  if (POKEMON_HARVEST_OPTIONS.some((option) => option.key === key)) return key;
  if (POKEMON_HARVEST_OPTIONS.some((option) => option.key === fallback)) return fallback;
  return POKEMON_HARVEST_OPTIONS[0]?.key ?? "";
}

function getHarvestResultTypeLabel(resultType) {
  if (resultType === HARVEST_RESULT_TYPES.item) return "Item";
  if (resultType === HARVEST_RESULT_TYPES.rollTable) return "RollTable";
  return "Info chat";
}

function getRollTableDrawLabel(draw, fallback = "Résultat") {
  const results = Array.from(draw?.results ?? []);
  const labels = results
    .map((result) => result?.text ?? result?.document?.name ?? result?.name ?? result?.getChatText?.())
    .map((label) => stringValue(label))
    .filter(Boolean);
  return labels.join(", ") || fallback;
}

function formatResultEntries(entries = []) {
  return entries
    .map((entry) => stringValue(entry?.label))
    .filter(Boolean)
    .join("; ");
}

function getCraftType(key) {
  return CRAFTING_TYPES.find((type) => type.key === key) ?? CRAFTING_TYPES[0] ?? null;
}

function normalizeCraftType(value, fallback = "normal") {
  const key = stringValue(value);
  const type = CRAFTING_TYPES.find((entry) => entry.key === key && entry.enabled);
  if (type) return type.key;
  const fallbackType = CRAFTING_TYPES.find((entry) => entry.key === fallback && entry.enabled);
  return fallbackType?.key ?? CRAFTING_TYPES.find((entry) => entry.enabled)?.key ?? "normal";
}

function normalizeMoneyMode(value, fallback = "total") {
  const mode = stringValue(value);
  if (mode === "unit" || mode === "total") return mode;
  return fallback === "unit" ? "unit" : "total";
}

function readMoneyValue(value, fallback = 0) {
  const number = Number(value);
  if (Number.isFinite(number) && number >= 0) return Math.floor(number);
  return Math.max(0, Math.floor(Number(fallback) || 0));
}

function calculateCraftMoneyCost(mode, value, quantity) {
  const amount = readMoneyValue(value, 0);
  const count = Math.max(1, Math.trunc(Number(quantity) || 1));
  return mode === "unit" ? amount * count : amount;
}

function formatMoney(amount) {
  return `${Math.max(0, Math.trunc(Number(amount) || 0))}₽`;
}

function getCraftRequirementErrors(actor, context) {
  const errors = [];
  if (!actor) errors.push("Choisis un Trainer avant de fabriquer.");
  if (!(actor?.isOwner || game.user?.isGM)) errors.push("Seul le propriétaire ou un MJ peut confirmer une fabrication.");
  if (!context.generatedItem && (!context.itemUuid || !context.itemName)) errors.push("Dépose l'objet final à fabriquer.");
  if (!context.craftType?.enabled) errors.push("Ce type de fabrication n'est pas encore disponible.");
  if (context.quantity < 1) errors.push("La quantité doit être au moins 1.");
  if (context.remainingBefore < context.costPRQ) {
    errors.push(`PR insuffisants: ${formatPRQ(context.costPRQ)} requis.`);
  }
  if (getMoney(actor) < context.moneyCost) {
    errors.push(`Argent insuffisant: ${formatMoney(context.moneyCost)} requis.`);
  }

  for (const ingredient of context.ingredients ?? []) {
    const hasEnough = ingredient.itemId && hasItemQuantity(actor, ingredient.itemId, ingredient.quantity);
    if (!hasEnough) {
      errors.push(`${ingredient.name}: ${ingredient.quantity} requis, ${ingredient.availableQuantity ?? 0} disponible.`);
    }
  }

  return errors;
}

function readDropData(event) {
  const transfer = event.originalEvent?.dataTransfer ?? event.dataTransfer;
  const raw = transfer?.getData("text/plain") || transfer?.getData("application/json");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isEmbeddedItemFromActor(item, actor) {
  if (!item || !actor) return false;
  const uuid = String(item.uuid ?? "");
  return item.parent?.id === actor.id
    || item.actor?.id === actor.id
    || uuid.startsWith(`${actor.uuid}.Item.`)
    || uuid.includes(`Actor.${actor.id}.Item.`);
}

function getPokemonOptions(actor, selectedId) {
  if (!actor) return [];
  return getOwnedPokemonForTrainer(actor).map((pokemon) => {
    const id = getActorKey(pokemon);
    return {
      id,
      name: pokemon.name,
      selected: id === selectedId
    };
  });
}

function getPokemonByKey(actor, pokemonKey) {
  const key = normalizeActorKey(pokemonKey);
  if (!actor || !key) return null;
  return getOwnedPokemonForTrainer(actor).find((pokemon) => getActorKey(pokemon) === key) ?? null;
}

function getHarvestRequirementErrors(actor, option, context) {
  const errors = [];
  if (!actor) errors.push("Choisis un Trainer avant de faire une récolte.");
  if (!option) return ["Récolte inconnue."];

  const requiredPRQ = Math.max(0, Math.trunc(Number(context.costPRQ ?? option.costPRQ) || 0));
  if (context.remainingBefore < requiredPRQ) {
    errors.push(`PR insuffisants: ${formatPRQ(requiredPRQ)} requis.`);
  }

  if (option.requiresPaleontologyConfirmation && !context.paleontologyConfirmed) {
    errors.push("Fossil Research demande de confirmer Field of Study: Paleontology sur le Trainer.");
  }

  if (option.requiresRareCandyIngredient && !context.rareCandyIngredientConfirmed) {
    errors.push("Juicer - Rare Candy demande de confirmer Shuckle's Berry Juice par dépôt ou case manuelle.");
  }

  if (option.requiresTwoOricorio) {
    const manualNames = [context.pokemonName, context.secondPokemonName].map((name) => stringValue(name)).filter(Boolean);
    if (context.detectedOricorioNames.length < 2 && !(context.ownsPokemon && manualNames.length >= 2)) {
      errors.push("Nectar Dancer demande 2 Oricorio valides. Sélectionne-les si détectés, ou confirme la possession et indique les deux noms.");
    }
    return errors;
  }

  if (option.skipPokemonRequirement) return errors;

  if (!context.ownsPokemon && !context.selectedPokemon) {
    errors.push("Confirme que tu possèdes le Pokémon qui permet cette récolte.");
  }

  if (!stringValue(context.pokemonName) && !context.selectedPokemon?.name) {
    errors.push("Indique le nom du Pokémon utilisé pour cette récolte.");
  }

  return errors;
}

function looksLikeShuckleBerryJuice(value) {
  const normalized = normalizeSearchText(value);
  return normalized.includes("shucklesberryjuice") || normalized.includes("shuckleberryjuice");
}

function pokemonLooksLikeSpecies(pokemon, speciesName) {
  const wanted = normalizeSearchText(speciesName);
  const candidates = [
    pokemon?.name,
    foundry.utils.getProperty(pokemon, "system.species"),
    foundry.utils.getProperty(pokemon, "system.species.name"),
    foundry.utils.getProperty(pokemon, "system.species.slug"),
    foundry.utils.getProperty(pokemon, "system.pokemon.species"),
    foundry.utils.getProperty(pokemon, "system.dex.species")
  ];

  const itemCandidates = (pokemon?.items?.contents ?? Array.from(pokemon?.items ?? []))
    .filter((item) => item.type === "species" || item.type === "pokemon")
    .flatMap((item) => [item.name, item.slug, item.system?.slug]);

  return [...candidates, ...itemCandidates]
    .map((candidate) => normalizeSearchText(candidate))
    .some((candidate) => candidate.includes(wanted));
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function getAvailableTrainers() {
  return game.actors
    .filter((actor) => actor.type === "character")
    .filter((actor) => game.user?.isGM || actor.isOwner || actor.testUserPermission?.(game.user, "OWNER"))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getActorKey(actor) {
  return String(actor?.id ?? actor?._id ?? actor?.uuid ?? "");
}

function normalizeActorKey(value) {
  return String(value ?? "").trim();
}

function resolveForm(html) {
  const root = html?.[0] ?? html;
  if (!root) return null;
  if (root.matches?.("form")) return root;
  return root.closest?.("form") ?? root.querySelector?.("form") ?? null;
}

function normalizeMaintenanceSkill(value, fallback = "generalEd") {
  const key = stringValue(value);
  if (MAINTENANCE_SKILL_KEYS.includes(key)) return key;
  if (MAINTENANCE_SKILL_KEYS.includes(fallback)) return fallback;
  return MAINTENANCE_SKILL_KEYS[0] ?? "generalEd";
}

function normalizePrSkill(value, fallback = "generalEd") {
  const key = stringValue(value);
  if (PR_MAINTENANCE_SKILL_KEYS.includes(key)) return key;
  if (PR_MAINTENANCE_SKILL_KEYS.includes(fallback)) return fallback;
  return PR_MAINTENANCE_SKILL_KEYS[0] ?? "generalEd";
}

function readPositiveCount(value, fallback = 1) {
  const number = Math.trunc(Number(value));
  if (Number.isFinite(number) && number > 0) return number;
  return Math.max(1, Math.trunc(Number(fallback) || 1));
}

function readNonNegativeCount(value, fallback = 0) {
  if (value === "") return Math.max(0, Math.trunc(Number(fallback) || 0));
  const number = Math.trunc(Number(value));
  if (Number.isFinite(number) && number >= 0) return number;
  return Math.max(0, Math.trunc(Number(fallback) || 0));
}

function readOptionalNonNegativeCount(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  return readNonNegativeCount(value);
}

function clampNumber(value, min, max) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function capitalize(value) {
  const text = String(value ?? "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function createLocalId(prefix = "id") {
  if (globalThis.foundry?.utils?.randomID) return `${prefix}-${foundry.utils.randomID(8)}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) return CSS.escape(String(value));
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function getActorByKey(actorKey) {
  const key = normalizeActorKey(actorKey);
  if (!key) return null;

  const direct = game.actors?.get?.(key);
  if (direct) return direct;

  return game.actors?.find?.((actor) => actor.id === key || actor._id === key || actor.uuid === key) ?? null;
}

function setting(key, fallback) {
  try {
    return game.settings?.get?.(MODULE_ID, key) ?? fallback;
  } catch {
    return fallback;
  }
}

function stringValue(value) {
  return String(value ?? "").trim();
}

function sanitizeActivity(activity) {
  return {
    ...activity,
    rolls: (activity.rolls ?? []).map((entry) => ({
      index: entry.index,
      die: entry.die,
      rate: entry.rate,
      gain: entry.gain
    }))
  };
}

async function confirmDialog(title, content) {
  if (globalThis.Dialog?.confirm) {
    return Dialog.confirm({
      title,
      content,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });
  }
  return globalThis.window?.confirm?.(content.replace(/<[^>]*>/g, "")) ?? false;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
