import { MODULE_ID } from "../data/constants.js";

export async function resolveDroppedItem(dropData) {
  if (!dropData) return null;
  const uuid = dropData.uuid || dropData.documentUuid;
  if (uuid && globalThis.fromUuid) return fromUuid(uuid);
  if (dropData.type === "Item" && dropData.id) return game.items?.get?.(dropData.id) ?? null;
  return null;
}

export async function addItemToActor(actor, item, quantity = 1) {
  if (!actor || !item) return null;
  const qty = Math.max(1, Math.trunc(Number(quantity) || 1));
  const source = item.toObject ? item.toObject() : foundry.utils.deepClone(item);
  setQuantity(source, qty);
  const created = await actor.createEmbeddedDocuments("Item", [source]);
  return created?.[0] ?? null;
}

export async function removeItemQuantity(actor, itemId, quantity = 1) {
  const item = actor?.items?.get?.(itemId);
  if (!item) return false;

  const qty = Math.max(1, Math.trunc(Number(quantity) || 1));
  const current = getItemQuantity(item);
  if (current > qty) {
    await item.update({ [getQuantityPath(item)]: current - qty });
    return true;
  }

  await actor.deleteEmbeddedDocuments("Item", [item.id]);
  return true;
}

export function hasItemQuantity(actor, itemId, quantity = 1) {
  const item = actor?.items?.get?.(itemId);
  if (!item) return false;
  return getItemQuantity(item) >= Math.max(1, Math.trunc(Number(quantity) || 1));
}

export function actorHasSourceItem(actor, uuid) {
  return Boolean(getActorItemBySource(actor, uuid));
}

export function getActorItemBySource(actor, uuid) {
  const wanted = normalizeSourceUuid(uuid);
  if (!actor || !wanted) return null;

  return getActorItems(actor).find((item) => {
    const candidates = [
      item.uuid,
      item.flags?.core?.sourceId,
      foundry.utils.getProperty(item, "flags.core.sourceId"),
      item.system?.source,
      foundry.utils.getProperty(item, "system.source")
    ];
    return candidates.some((candidate) => normalizeSourceUuid(candidate) === wanted);
  }) ?? null;
}

export async function deductMoney(actor, amount) {
  return adjustMoney(actor, -Math.abs(Number(amount) || 0));
}

export async function addMoney(actor, amount) {
  return adjustMoney(actor, Math.abs(Number(amount) || 0));
}

export function getMoney(actor) {
  const raw = foundry.utils.getProperty(actor, "system.money");
  if (typeof raw === "number") return raw;
  if (typeof raw === "string" && Number.isFinite(Number(raw))) return Number(raw);
  if (raw && typeof raw === "object") {
    const value = raw.value ?? raw.amount ?? raw.current;
    if (Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
}

async function adjustMoney(actor, delta) {
  if (!actor?.isOwner) return false;
  const current = getMoney(actor);
  const next = Math.max(0, current + delta);
  await actor.update({ "system.money": next });
  if (game.settings?.get?.(MODULE_ID, "debug")) {
    console.log(`${MODULE_ID} | Argent mis a jour pour ${actor.name}: ${current} -> ${next}`);
  }
  return true;
}

function getItemQuantity(item) {
  const candidates = ["system.quantity", "system.quantity.value", "system.amount", "system.qty"];
  for (const path of candidates) {
    const value = foundry.utils.getProperty(item, path);
    if (Number.isFinite(Number(value))) return Math.max(0, Number(value));
  }
  return 1;
}

function getQuantityPath(item) {
  const candidates = ["system.quantity", "system.quantity.value", "system.amount", "system.qty"];
  return candidates.find((path) => foundry.utils.getProperty(item, path) !== undefined) ?? "system.quantity";
}

function setQuantity(source, quantity) {
  const path = getQuantityPath(source);
  foundry.utils.setProperty(source, path, quantity);
}

function getActorItems(actor) {
  return actor?.items?.contents ?? Array.from(actor?.items ?? []);
}

function normalizeSourceUuid(value) {
  return String(value ?? "").trim();
}
