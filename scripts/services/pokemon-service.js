import { MODULE_ID } from "../data/constants.js";

export function getOwnedPokemonForTrainer(trainer) {
  const pokemon = game.actors
    .filter((actor) => actor.type === "pokemon")
    .filter((actor) => actor.isOwner || game.user?.isGM);

  const trainerId = trainer?.id;
  const linked = pokemon.filter((actor) => {
    const ownerId = read(actor, "system.owner.id") ?? read(actor, "system.trainer.id") ?? read(actor, "system.originalTrainer.id");
    const ownerUuid = read(actor, "system.owner.uuid") ?? read(actor, "system.trainer.uuid");
    return ownerId === trainerId || ownerUuid === trainer?.uuid;
  });

  return linked.length > 0 ? linked : pokemon;
}

export function pokemonHasCapability(pokemon, capabilityName) {
  const wanted = normalize(capabilityName);
  if (!wanted) return false;

  const capabilities = read(pokemon, "system.capabilities") ?? {};
  for (const [key, value] of Object.entries(capabilities)) {
    if (normalize(key) === wanted && capabilityValueIsPresent(value)) return true;
    if (Array.isArray(value) && value.some((entry) => normalize(entry?.name ?? entry) === wanted)) return true;
  }

  const other = read(pokemon, "system.capabilities.other");
  if (Array.isArray(other) && other.some((entry) => normalize(entry?.name ?? entry) === wanted)) return true;

  return getActorItems(pokemon).some((item) => item.type === "capability" && normalize(item.name) === wanted);
}

export function getPokemonLevel(pokemon) {
  const value = readNumber(pokemon, ["system.level.value", "system.level.current", "system.level", "level"]);
  return value ?? 1;
}

export function getPokemonFriendship(pokemon) {
  const value = readNumber(pokemon, ["system.friendship", "system.friendship.value", "system.loyalty"]);
  return value ?? 0;
}

export function validateHarvestPokemon(pokemon, capabilityName, options = {}) {
  const minimumLevel = Number(options.minimumLevel ?? 20);
  const level = getPokemonLevel(pokemon);
  const friendship = getPokemonFriendship(pokemon);
  const hasCapability = pokemonHasCapability(pokemon, capabilityName);
  const valid = level >= minimumLevel && friendship >= 2 && hasCapability;

  return {
    valid,
    level,
    friendship,
    hasCapability,
    errors: [
      level < minimumLevel ? `Niveau ${level}/${minimumLevel}` : null,
      friendship < 2 ? `Friendship ${friendship}/2` : null,
      !hasCapability ? `Capability ${capabilityName} introuvable` : null
    ].filter(Boolean)
  };
}

function read(document, path) {
  return foundry.utils.getProperty(document, path);
}

function readNumber(document, paths) {
  for (const path of paths) {
    const value = read(document, path);
    if (Number.isFinite(Number(value))) return Math.trunc(Number(value));
  }
  if (game.settings?.get?.(MODULE_ID, "debug")) {
    console.warn(`${MODULE_ID} | Niveau/Friendship Pokemon introuvable pour ${document?.name}.`, paths);
  }
  return null;
}

function getActorItems(actor) {
  return actor?.items?.contents ?? Array.from(actor?.items ?? []);
}

function capabilityValueIsPresent(value) {
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return value.trim() !== "" && value !== "0";
  return Boolean(value);
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}
