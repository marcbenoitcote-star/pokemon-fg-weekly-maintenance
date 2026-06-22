# Pokémon FG - Entretien Hebdomadaire

Module Foundry VTT V13 pour Pokémon Tabletop Reunited (`ptu`). Il assiste les semaines d'entretien des joueurs Pokémon FG.

## Etat du module

Cette version livre l'étape 1 du cahier des charges:

- Macro `game.pfgMaintenance.open();`
- Selection des Trainers possedes par le joueur, ou de tous les Trainers pour un MJ.
- Calcul des Points Rentability / PR avec stockage interne en quarts de PR (`PRQ`).
- Choix manuel du skill PR parmi `General Education`, `Occult Education`, `Medicine Education`, `Pokémon Education`, `Technology Education` et `Survival`.
- Lecture PTR des skills via `system.skills.<skill>.value.total` et `modifier.total`, donc avec les bonus/malus de fiche.
- Overrides manuels pour le niveau et Power si les chemins PTR ne sont pas détectés.
- Detection basique de Simple Calendar Reborn si son API est disponible, sinon semaine manuelle.
- Integration ciblee avec `Fireblight-Studios/foundryvtt-simple-calendar` (`foundryvtt-simple-calendar-reborn`).
- Affichage de la date Simple Calendar actuelle des l'ecran de selection Trainer.
- Selection Trainer robuste par menu deroulant ou bouton direct, avec resolution par `id`, `_id` ou `uuid`.
- Verrouillage d'une semaine finalisée via `flags.pokemon-fg-weekly-maintenance.weeks`.
- Activité complète `Petit Travail Hebdomadaire`.
- Jet `1d6 x taux du rang`, résumé chat et application optionnelle des gains.
- Saisie stable du skill PR, de la description et du nombre de Petits Travaux pendant les recalculs d'interface.
- Services séparés pour PR, calendrier, chat, items et Pokémon afin de recevoir les étapes suivantes.

Les étapes Fabrication, Récolte Pokémon et Agriculture / Jardinage sont visibles comme emplacements de travail, mais pas encore actives dans l'interface.

## Installation locale

Copier ce dossier dans le repertoire des modules Foundry:

```text
FoundryVTT/Data/modules/pokemon-fg-weekly-maintenance
```

Activer ensuite `Pokémon FG - Entretien Hebdomadaire` dans le monde PTR.

## Installation Forge

Pour Forge VTT, installer le module comme module Foundry classique:

1. Utiliser l'option Forge / Foundry `Install from Manifest`.
2. Coller cette URL:

```text
https://github.com/marcbenoitcote-star/pokemon-fg-weekly-maintenance/releases/latest/download/module.json
```

3. Activer le module dans le monde PTR.

Simple Calendar Reborn est declare comme module relie dans le manifest:

```text
https://github.com/Fireblight-Studios/foundryvtt-simple-calendar/releases/latest/download/module.json
```

Si son API `SimpleCalendar.api` est disponible, le module lit `currentDateTimeDisplay()`, `currentDateTime()` et `timestamp()` pour afficher la date actuelle et fabriquer une cle de semaine automatiquement. Sinon, l'application affiche les champs manuels `Nom de la semaine`, `Date RP` et `Evenement`.

## Utilisation

Creer une macro script avec:

```js
game.pfgMaintenance.open();
```

Flux MVP:

1. Choisir un Trainer.
2. Verifier le calcul des PR et choisir le skill PR voulu.
3. Remplir la semaine ou l'evenement actif.
4. Choisir `Petit Travail`.
5. Saisir la description, le skill et le nombre de travaux.
6. Lancer les des.
7. Poster le résumé, appliquer les gains si souhaité, puis terminer l'entretien.

Par défaut, les changements de fiche ne sont jamais appliqués automatiquement. Le bouton `Appliquer les gains` demande confirmation avant de modifier `system.money`.

## Configuration MJ

Le module ajoute ces settings Foundry:

- `Mode strict des activités`: empêche de mélanger Petit Travail avec les autres activités pendant une semaine.
- `Verrouiller les semaines finalisees`: empêche un second entretien pour le même Trainer et la même semaine.
- `Taux minimum du Petit Travail`: permet un paiement minimum pour Pathetic ou Untrained.
- `Emplacements bonus maximum`: reserve pour l'Agriculture.
- `Récolte avec des dés de Skill`: réservé pour les Harvest Stage.
- `Seuil de reprise gratuite`: reserve pour l'Agriculture.
- `Logs de debug`: affiche les chemins PTR manquants dans la console.

## Stockage

Chaque entretien finalise est stocke sur l'Actor Trainer:

```text
flags.pokemon-fg-weekly-maintenance.weeks[weekKey]
```

Forme principale:

```js
{
  weekKey,
  calendarLabel,
  eventName,
  eventDescription,
  actorId,
  actorName,
  totalPRQ,
  spentPRQ,
  remainingPRQ,
  activities: [],
  createdBy,
  createdAt,
  finalized: true
}
```

## Notes techniques

Le module lit les données PTR avec `foundry.utils.getProperty` et plusieurs chemins candidats. Si un chemin n'est pas trouvé, il utilise une valeur par défaut et, en mode debug, logge les chemins testés.

Chemins importants geres:

- Niveau: `system.level.value`, `system.level.current`, `system.level.total`, `system.level.milestones`
- Power: `system.modifiers.capabilities.power`, `system.capabilities.power`
- Skills: `system.skills.<skill>.value.total`, `system.skills.<skill>.value.value`, `system.skills.<skill>.value.mod`, `system.skills.<skill>.modifier.total`
- Argent: `system.money`

## Prochaines étapes

1. Fabrication avec drag & drop, argent, ingredients reserves et confirmation finale.
2. Récolte Pokémon avec validation niveau, Friendship et Capability.
3. Agriculture / Jardinage avec Planting Stage, Growth Stage, Harvest Stage, Natural Specialty et Yield Rolls.
4. Panneau MJ d'evenement hebdomadaire avec bonus mecaniques.
