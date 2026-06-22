import {
  ACTIVITY_COSTS_PRQ,
  ACTIVITY_KEYS,
  ACTIVITY_OPTIONS,
  DEFAULT_WEEK_DATA,
  MAINTENANCE_SKILL_KEYS,
  MODULE_ID,
  MODULE_TITLE,
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
import { addMoney, getMoney } from "../services/item-service.js";
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
    const activityOptions = ACTIVITY_OPTIONS.map((activity) => ({
      ...activity,
      selected: activity.key === this.state.selectedActivity,
      disabled: !activity.enabled
    }));

    return {
      moduleId: MODULE_ID,
      title: MODULE_TITLE,
      steps: STEPS.map((step, index) => ({
        ...step,
        active: step.key === this.state.step,
        done: STEPS.findIndex((entry) => entry.key === this.state.step) > index
      })),
      isTrainerStep: this.state.step === "trainer",
      isPrStep: this.state.step === "pr",
      isActivityStep: this.state.step === "activity",
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
      currentActivity: this.state.currentActivity,
      currentActivityRolls: this.state.currentActivity?.rolls ?? [],
      hasCurrentActivity: Boolean(this.state.currentActivity),
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

    html.on("input", "input[name='weekName'], input[name='rpDate'], input[name='eventName'], textarea[name='eventDescription'], input[name='workDescription']", (event) => {
      this.updateFieldState(event.currentTarget);
    });

    html.on("change", "select[name='prSkillKey'], input[name='manualLevel'], input[name='manualPower'], select[name='workSkillKey'], input[name='workCount']", (event) => {
      this.updateFieldState(event.currentTarget);
      this.render(false);
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
      if (this.state.selectedActivity !== ACTIVITY_KEYS.work) {
        ui.notifications.info("Cette activité sera ajoutée dans une prochaine étape du module.");
        return;
      }
      this.state.step = "work";
      this.render(false);
      return;
    }

    if (action === "roll-work") {
      await this.rollWork();
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
  }

  getWorkData(actor, totalPRQ, spentPRQ) {
    const previousSpent = this.state.currentActivity ? spentPRQ - this.state.currentActivity.costPRQ : spentPRQ;
    const remainingBefore = Math.max(0, totalPRQ - previousSpent);
    const maxCount = Math.floor(remainingBefore / ACTIVITY_COSTS_PRQ.work);
    const workSkillKey = normalizeMaintenanceSkill(this.state.work.skillKey, this.state.prSkillKey);
    this.state.work.skillKey = workSkillKey;
    const selectedSkill = actor ? getSkillRank(actor, workSkillKey) : null;
    const rate = selectedSkill ? getWorkRateForRank(selectedSkill.rank) : 0;
    const count = Math.min(Math.max(1, this.state.work.count), Math.max(1, maxCount));
    const costPRQ = count * ACTIVITY_COSTS_PRQ.work;

    return {
      ...this.state.work,
      count,
      maxCount,
      costPRQ,
      costLabel: formatPRQ(costPRQ),
      remainingBefore,
      remainingBeforeLabel: formatPRQ(remainingBefore),
      remainingAfterLabel: formatPRQ(Math.max(0, remainingBefore - costPRQ)),
      skillKey: workSkillKey,
      skillOptions: getSkillOptions(actor, workSkillKey, MAINTENANCE_SKILL_KEYS),
      selectedSkill,
      rankLabel: selectedSkill?.rankLabel ?? getRankLabel(0),
      rate,
      rateWarning: selectedSkill ? selectedSkill.rank <= 2 : false,
      canRoll: Boolean(actor && maxCount > 0),
      rolls: this.state.work.rolls ?? [],
      totalGain: this.state.work.totalGain ?? 0
    };
  }

  getPlannedActivities() {
    return this.state.currentActivity ? [this.state.currentActivity] : [];
  }

  async rollWork() {
    const actor = this.actor;
    if (!actor) return;

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

  async finishMaintenance() {
    const actor = this.actor;
    if (!actor || !this.state.currentActivity) return;
    if (this.isCurrentWeekLocked()) {
      ui.notifications.warn("Cet entretien est déjà finalisé pour cette semaine.");
      return;
    }

    const totals = this.getTotals();
    const calendar = getCurrentWeekData(this.state.calendar);
    const activities = this.getPlannedActivities().map((activity) => sanitizeActivity(activity));
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
      activity: this.state.currentActivity,
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
    const order = STEPS.map((step) => step.key);
    const index = order.indexOf(this.state.step);
    this.state.step = order[Math.max(0, index - 1)] ?? "trainer";
    this.render(false);
  }

  resetActivityState(skillKey = this.state.prSkillKey) {
    const normalizedSkill = normalizeMaintenanceSkill(skillKey, "generalEd");
    this.state.work = {
      description: "",
      skillKey: normalizedSkill,
      count: 1,
      rolls: [],
      totalGain: 0
    };
    this.state.currentActivity = null;
    this.state.finalized = false;
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
