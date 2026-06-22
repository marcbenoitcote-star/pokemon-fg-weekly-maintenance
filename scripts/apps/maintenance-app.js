import {
  ACTIVITY_COSTS_PRQ,
  ACTIVITY_KEYS,
  ACTIVITY_OPTIONS,
  DEFAULT_WEEK_DATA,
  HARVEST_RESULT_TYPES,
  MAINTENANCE_SKILL_KEYS,
  MODULE_ID,
  MODULE_TITLE,
  POKEMON_HARVEST_OPTIONS,
  SETTINGS,
  TEMPLATES
} from "../data/constants.js";
import {
  calculatePR,
  formatPRQ,
  getBestSkill,
  getRankLabel,
  getSkillOptions,
  getSkillRank,
  getWorkRateForRank
} from "../services/pr-service.js";
import {
  getActorWeek,
  getCurrentWeekData,
  isWeekFinalized,
  saveWeek,
  unlockWeek
} from "../services/calendar-service.js";
import { addItemToActor, addMoney, getMoney, resolveDroppedItem } from "../services/item-service.js";
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
      calendar: { ...DEFAULT_WEEK_DATA },
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
        pokemonId: "",
        pokemonName: "",
        secondPokemonName: "",
        ownsPokemon: false,
        paleontologyConfirmed: false,
        rareCandyIngredientConfirmed: false,
        rareCandyIngredientName: "",
        rareCandyIngredientUuid: ""
      },
      activities: [],
      currentActivity: null,
      finalized: false
    };

    if (this.state.actorId) this.state.step = "pr";
  }

  get actor() {
    return getActorByKey(this.state.actorId);
  }

  getData() {
    const actor = this.actor;
    const trainers = getAvailableTrainers();
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
    const spentPRQ = plannedActivities.reduce((total, activity) => total + Number(activity.costPRQ || 0), 0);
    const totalPRQ = pr?.totalPRQ ?? 0;
    const remainingPRQ = Math.max(0, totalPRQ - spentPRQ);
    const workData = this.getWorkData(actor, totalPRQ, spentPRQ);
    const harvestData = this.getHarvestData(actor, totalPRQ, spentPRQ);
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
      isHarvestStep: this.state.step === "harvest",
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
      prSkillOptions: getSkillOptions(actor, this.state.prSkillKey, MAINTENANCE_SKILL_KEYS),
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
      activities: plannedActivities,
      activityHistory,
      hasActivityHistory: activityHistory.length > 0,
      currentActivity: this.state.currentActivity,
      currentActivityRolls: this.state.currentActivity?.rolls ?? [],
      hasCurrentActivity: Boolean(this.state.currentActivity),
      canStartAnotherActivity: Boolean(actor && this.state.currentActivity && !weekLocked && remainingPRQ >= getCheapestEnabledActivityCost()),
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

    html.on("input", "input[name='weekName'], input[name='rpDate'], input[name='eventName'], textarea[name='eventDescription'], input[name='workDescription'], input[name='harvestPokemonName'], input[name='harvestSecondPokemonName']", (event) => {
      this.updateFieldState(event.currentTarget);
    });

    html.on("change", "select[name='prSkillKey'], input[name='manualLevel'], input[name='manualPower'], select[name='workSkillKey'], input[name='workCount'], select[name='harvestKey'], select[name='harvestPokemonId'], input[name='harvestOwnsPokemon'], input[name='harvestPaleontologyConfirmed'], input[name='harvestRareCandyIngredientConfirmed']", (event) => {
      this.updateFieldState(event.currentTarget);
      this.render(false);
    });

    html.on("dragover", ".pfg-drop-zone[data-drop-target='rareCandyIngredient']", (event) => {
      event.preventDefault();
      event.currentTarget.classList.add("dragging");
    });

    html.on("dragleave", ".pfg-drop-zone[data-drop-target='rareCandyIngredient']", (event) => {
      event.currentTarget.classList.remove("dragging");
    });

    html.on("drop", ".pfg-drop-zone[data-drop-target='rareCandyIngredient']", (event) => {
      this.handleHarvestDrop(event).catch((error) => {
        console.error(`${MODULE_ID} | Drop récolte impossible.`, error);
        ui.notifications.error(`Récolte Pokémon: ${error.message ?? error}`);
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
      if (this.state.selectedActivity === ACTIVITY_KEYS.pokemonHarvest) {
        this.state.step = "harvest";
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

    if (action === "roll-work") {
      await this.rollWork();
      return;
    }

    if (action === "roll-harvest") {
      await this.confirmHarvest();
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
    if (data.has("actorId")) this.state.actorId = normalizeActorKey(data.get("actorId")) || this.state.actorId;
    if (data.has("manualLevel")) this.state.manualLevel = stringValue(data.get("manualLevel"));
    if (data.has("manualPower")) this.state.manualPower = stringValue(data.get("manualPower"));
    if (data.has("prSkillKey")) this.state.prSkillKey = normalizeMaintenanceSkill(data.get("prSkillKey"), this.state.prSkillKey);
    if (data.has("weekName")) this.state.calendar.weekName = stringValue(data.get("weekName"));
    if (data.has("rpDate")) this.state.calendar.rpDate = stringValue(data.get("rpDate"));
    if (data.has("eventName")) this.state.calendar.eventName = stringValue(data.get("eventName"));
    if (data.has("eventDescription")) this.state.calendar.eventDescription = stringValue(data.get("eventDescription"));
    if (data.has("selectedActivity")) this.state.selectedActivity = stringValue(data.get("selectedActivity")) || this.state.selectedActivity;
    if (data.has("workDescription")) this.state.work.description = stringValue(data.get("workDescription"));
    if (data.has("workSkillKey")) this.state.work.skillKey = normalizeMaintenanceSkill(data.get("workSkillKey"), this.state.work.skillKey);
    if (data.has("workCount")) this.state.work.count = readPositiveCount(data.get("workCount"), this.state.work.count);
    if (data.has("harvestKey")) this.state.harvest.harvestKey = normalizeHarvestKey(data.get("harvestKey"), this.state.harvest.harvestKey);
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
  }

  updateFieldState(field) {
    const name = field?.name;
    if (!name) return;

    if (name === "manualLevel") this.state.manualLevel = stringValue(field.value);
    if (name === "manualPower") this.state.manualPower = stringValue(field.value);
    if (name === "prSkillKey") this.state.prSkillKey = normalizeMaintenanceSkill(field.value, this.state.prSkillKey);
    if (name === "weekName") this.state.calendar.weekName = stringValue(field.value);
    if (name === "rpDate") this.state.calendar.rpDate = stringValue(field.value);
    if (name === "eventName") this.state.calendar.eventName = stringValue(field.value);
    if (name === "eventDescription") this.state.calendar.eventDescription = stringValue(field.value);
    if (name === "workDescription") this.state.work.description = stringValue(field.value);
    if (name === "workSkillKey") this.state.work.skillKey = normalizeMaintenanceSkill(field.value, this.state.work.skillKey);
    if (name === "workCount") this.state.work.count = readPositiveCount(field.value, this.state.work.count);
    if (name === "harvestKey") this.state.harvest.harvestKey = normalizeHarvestKey(field.value, this.state.harvest.harvestKey);
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
  }

  getWorkData(actor, totalPRQ, spentPRQ) {
    const lockedActivity = this.state.currentActivity?.key === ACTIVITY_KEYS.work ? this.state.currentActivity : null;
    const remainingBefore = Math.max(0, totalPRQ - spentPRQ);
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

  getHarvestData(actor, totalPRQ, spentPRQ) {
    const lockedActivity = this.state.currentActivity?.key === ACTIVITY_KEYS.pokemonHarvest ? this.state.currentActivity : null;
    const harvestKey = normalizeHarvestKey(lockedActivity?.harvestKey ?? this.state.harvest.harvestKey);
    this.state.harvest.harvestKey = harvestKey;
    const selectedOption = getHarvestOption(harvestKey);
    const remainingBefore = Math.max(0, totalPRQ - spentPRQ);
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
      remainingBefore
    });
    const costPRQ = lockedActivity?.costPRQ ?? selectedOption?.costPRQ ?? 0;

    return {
      ...this.state.harvest,
      harvestKey,
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

  getPlannedActivities() {
    return this.state.activities ?? [];
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
      remainingPRLabel: formatPRQ(Math.max(0, data.totalPRQ - activity.costPRQ))
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
    const result = await this.applyHarvestResult(actor, option);
    const pokemonNames = [harvest.pokemonName, harvest.requiresSecondPokemon ? harvest.secondPokemonName : ""]
      .map((name) => stringValue(name))
      .filter(Boolean);
    const pokemonNamesLabel = option.skipPokemonRequirement
      ? "Field of Study: Paleontology"
      : (pokemonNames.join(", ") || "Pokémon confirmé");
    const resultStatus = option.requiresRareCandyIngredient
      ? `${result.status} Retirer ${harvest.rareCandyIngredientName || option.ingredientLabel || "Shuckle's Berry Juice"} manuellement de l'inventaire.`
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
      costPRQ: option.costPRQ,
      costLabel: formatPRQ(option.costPRQ),
      resultType: option.resultType,
      resultTypeLabel: getHarvestResultTypeLabel(option.resultType),
      resultUuid: option.resultUuid ?? "",
      resultLabel: option.resultLabel ?? option.label,
      resultStatus,
      resultApplied: result.applied,
      summaryLine: `${option.label} avec ${pokemonNamesLabel}: ${option.resultLabel ?? "résultat à gérer"}`,
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

  async applyHarvestResult(actor, option) {
    if (!option) return { applied: false, status: "Récolte inconnue." };

    try {
      if (option.resultType === HARVEST_RESULT_TYPES.item) {
        if (!option.resultUuid) return { applied: false, status: "Item manquant: à ajouter manuellement." };
        if (!(actor.isOwner || game.user?.isGM)) {
          return { applied: false, status: "Item non ajouté: permission insuffisante. À ajouter manuellement." };
        }
        if (!globalThis.fromUuid) return { applied: false, status: "fromUuid indisponible: à ajouter manuellement." };

        const item = await globalThis.fromUuid(option.resultUuid);
        if (!item) return { applied: false, status: `${option.resultLabel} introuvable: à ajouter manuellement.` };

        const created = await addItemToActor(actor, item, 1);
        return {
          applied: Boolean(created),
          status: created ? `${created.name ?? option.resultLabel} ajouté à l'inventaire.` : `${option.resultLabel} à ajouter manuellement.`
        };
      }

      if (option.resultType === HARVEST_RESULT_TYPES.rollTable) {
        if (!option.resultUuid) return { applied: false, status: "Table manquante: à lancer manuellement." };
        if (!globalThis.fromUuid) return { applied: false, status: "fromUuid indisponible: table à lancer manuellement." };

        const table = await globalThis.fromUuid(option.resultUuid);
        if (!table?.draw) return { applied: false, status: `${option.resultLabel} introuvable: table à lancer manuellement.` };

        await table.draw({ displayChat: true });
        return { applied: true, status: `${option.resultLabel} lancée dans le chat.` };
      }

      return { applied: true, status: option.resultLabel ?? "Information postée dans le chat." };
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
    if (totals.remainingPRQ < getCheapestEnabledActivityCost()) {
      ui.notifications.warn("PR insuffisants pour commencer une autre activité.");
      this.render(false);
      return;
    }

    this.state.currentActivity = null;
    this.resetWorkState();
    this.resetHarvestState();
    this.state.step = "activity";
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
    const totalPRQ = pr?.totalPRQ ?? 0;
    const spentPRQ = this.getPlannedActivities().reduce((total, activity) => total + Number(activity.costPRQ || 0), 0);
    return {
      totalPRQ,
      spentPRQ,
      remainingPRQ: Math.max(0, totalPRQ - spentPRQ)
    };
  }

  isCurrentWeekLocked() {
    const actor = this.actor;
    if (!actor || !setting(SETTINGS.lockWeeks, true)) return false;
    const calendar = getCurrentWeekData(this.state.calendar);
    return isWeekFinalized(actor, calendar.weekKey);
  }

  goBack() {
    if (this.state.step === "summary" && this.state.currentActivity?.key === ACTIVITY_KEYS.pokemonHarvest) {
      this.state.step = "harvest";
    } else if (this.state.step === "summary" && this.state.currentActivity?.key === ACTIVITY_KEYS.work) {
      this.state.step = "work";
    } else if (this.state.step === "work" || this.state.step === "harvest") {
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

  selectTrainer(actor) {
    this.state.actorId = getActorKey(actor);
    this.state.step = "pr";
    const bestSkill = getBestSkill(actor, "work");
    this.state.prSkillKey = normalizeMaintenanceSkill(bestSkill?.key, "generalEd");
    this.resetActivityState(this.state.prSkillKey);
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
  const actionStep = state.step === "harvest"
    || state.selectedActivity === ACTIVITY_KEYS.pokemonHarvest
    || state.currentActivity?.key === ACTIVITY_KEYS.pokemonHarvest
    ? { key: "harvest", label: "Récolte" }
    : { key: "work", label: "Petit Travail" };

  return [
    STEPS[0],
    STEPS[1],
    STEPS[2],
    actionStep,
    STEPS[4]
  ];
}

function getCheapestEnabledActivityCost() {
  const enabledKeys = new Set(ACTIVITY_OPTIONS.filter((option) => option.enabled).map((option) => option.key));
  const costs = [];
  if (enabledKeys.has(ACTIVITY_KEYS.work)) costs.push(ACTIVITY_COSTS_PRQ.work);
  if (enabledKeys.has(ACTIVITY_KEYS.pokemonHarvest)) {
    costs.push(...POKEMON_HARVEST_OPTIONS.map((option) => option.costPRQ));
  }
  return Math.min(...costs.filter((cost) => Number.isFinite(cost) && cost > 0), ACTIVITY_COSTS_PRQ.work);
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

  if (context.remainingBefore < option.costPRQ) {
    errors.push(`PR insuffisants: ${formatPRQ(option.costPRQ)} requis.`);
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

function readPositiveCount(value, fallback = 1) {
  const number = Math.trunc(Number(value));
  if (Number.isFinite(number) && number > 0) return number;
  return Math.max(1, Math.trunc(Number(fallback) || 1));
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
