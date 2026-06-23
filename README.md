# Pokémon FG - Entretien Hebdomadaire

Module Foundry VTT V13 pour Pokémon Tabletop Reunited (`ptu`). Il assiste les semaines d'entretien des joueurs Pokémon FG.

## Etat du module

Cette version livre l'étape 1 du cahier des charges:

- Macro `game.pfgMaintenance.open();`
- Selection des Trainers possedes par le joueur, ou de tous les Trainers pour un MJ.
- Calcul des Points Rentability / PR avec stockage interne en quarts de PR (`PRQ`).
- Choix manuel du skill PR parmi `General Education`, `Medicine Education`, `Occult Education`, `Pokémon Education`, `Technology Education` et `Survival`.
- Choix du skill Petit Travail parmi tous les skills Trainer détectés.
- Bonus PR configurables: bonus général, bonus Fabrication, bonus Récolte, bonus Petit Travail et bonus Agriculture.
- Les bonus PR spécifiques sont dépensés seulement par leur activité, avant les PR généraux.
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
- Verrouillage du Petit Travail apres le premier lancer: les PR restent depenses, les jets restent visibles, et l'activite ne peut pas etre relancee pour remplacer le resultat.
- Possibilite d'appliquer les gains puis de commencer une nouvelle activite avec les PR restants, tout en gardant l'historique des activites deja lancees.
- Activité complète `Récolte Pokémon` avec coûts 2 PR, 3 PR, 4 PR et 9 PR selon la récolte.
- Liste active des récoltes: Honey Gather, Mushroom Harvest, Dream Mist, Milk Collection, Fortune, Herb Growth, Juicer, Fossil Research, Nectar Dancer, Pickup, Rare Candy, Heart Gift et Gather Unown.
- Confirmation du Pokémon possédé par sélection d'un Actor Pokémon détecté ou par nom manuel.
- Validation des prérequis spéciaux: confirmation `Field of Study: Paleontology` pour Fossil Research, confirmation ou dépôt de `Shuckle's Berry Juice` pour Rare Candy, et 2 Oricorio pour Nectar Dancer.
- Application de résultat Récolte: ajout d'item depuis UUID, lancement de RollTable, ou information chat selon le type.
- Récolte Pokémon répétable en une seule confirmation, avec coût PR multiplié et résultats RollTable conservés dans l'historique.
- Bouton `Nouvel entretien` après finalisation pour repartir sur la date Simple Calendar actuelle.
- Activité complète `Fabrication` avec journal de fabrication, drop de l'objet final, type, quantité, coût argent, ingrédients réservés et confirmation finale.
- La Fabrication réserve les ingrédients au drop et ne retire argent/ingrédients qu'au moment de la confirmation.
- Types Fabrication actifs: `Objet normal` à 1 PRQ par objet, `Arme` à 4 PRQ par arme et `Armure` à 4 PRQ par armure.
- Constructeur `Arme`: base melee/ranged/magic/shield, coûts Pokédollars automatiques, 1 move Tiers 1, 1 move Tiers 2, restrictions two-handed/heavy, surtaxes Musical Weapon, règles PTR `FlatModifier`/`GrantItem`, champ `Effect`, `Keywords` et capacité `Reach`.
- Macro dédiée `game.pfgMaintenance.openWeaponCrafting();` pour ouvrir directement la Fabrication d'arme.
- Services séparés pour PR, calendrier, chat, items et Pokémon afin de recevoir les étapes suivantes.

L'étape Agriculture / Jardinage est visible comme emplacement de travail, mais pas encore active dans l'interface.

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
4. Choisir `Petit Travail`, `Récolte Pokémon` ou `Fabrication`.
5. Pour `Petit Travail`, saisir la description, le skill et le nombre de travaux, puis lancer les dés.
6. Pour `Récolte Pokémon`, choisir la récolte, confirmer le Pokémon utilisé, puis confirmer le résultat.
7. Pour `Fabrication`, déposer l'objet final, choisir le type, la quantité, le coût argent et les ingrédients réservés, puis confirmer.
8. Poster le résumé, appliquer les gains si souhaité, commencer une nouvelle activité avec les PR restants, puis terminer l'entretien.

Macro directe pour la Fabrication d'arme:

```js
game.pfgMaintenance.openWeaponCrafting();
```

Par défaut, les gains d'argent ne sont jamais appliqués automatiquement. Le bouton `Appliquer les gains` demande confirmation avant de modifier `system.money`. Les Récoltes Pokémon appliquent leur résultat au moment de la confirmation quand l'item ou la RollTable est disponible, sinon le chat indique l'action manuelle à faire.

## Liste de test rapide

- Vérifier que `Récolte Pokémon` est sélectionnable dans l'écran Activité.
- Confirmer une récolte simple avec un Pokémon détecté, puis vérifier le coût `2 PR` et le résultat dans le chat.
- Confirmer une récolte simple avec un nom manuel et la case de possession cochée.
- Tester une récolte RollTable (`Mushroom Harvest`, `Fortune`, `Herb Growth` ou `Pickup`) et vérifier qu'une table est lancée dans le chat.
- Tester `Fossil Research`: aucun Pokémon ne doit être demandé, seulement la confirmation `Field of Study: Paleontology`, puis la RollTable Fossil Research doit être lancée dans le chat.
- Tester `Juicer - Rare Candy` avec dépôt de `Shuckle's Berry Juice`, puis avec la case de confirmation manuelle.
- Vérifier que `Juicer - Rare Candy` ajoute le Rare Candy si possible, mais demande de retirer `Shuckle's Berry Juice` manuellement.
- Tester `Nectar Dancer` avec deux Oricorio détectés, puis avec deux noms manuels.
- Utiliser `Retour` après une récolte confirmée: le résultat doit rester verrouillé et impossible à relancer.
- Cliquer `Nouvelle activité`: les PR restants doivent être conservés et l'ancienne récolte doit rester dans l'historique.
- Terminer l'entretien et vérifier que le résumé final contient Petit Travail et Récolte si les deux ont été faits.
- Vérifier que `Fabrication` est sélectionnable dans l'écran Activité.
- Ouvrir le journal de fabrication depuis le bouton dédié.
- Déposer un objet final depuis un compendium ou la sidebar Items.
- Tester `Objet normal`: quantité 4 doit coûter 1 PR.
- Tester `Armure`: quantité 1 doit coûter 1 PR.
- Tester `Arme`: choisir `Melee Weapon`, une base à deux mains, un move `Two-handed Only`, puis vérifier coût `1 PR`, coût Pokédollars automatique et item ajouté à l'inventaire.
- Tester une arme magique musicale: choisir un move avec surtaxe Musical Weapon et vérifier que le coût Pokédollars inclut la surtaxe.
- Tester `Shield Weapon`: Bouclier léger doit donner +1 Evasion et l'effet `VEJwFmRF7al1iVH9`; Bouclier lourd doit donner +2 Evasion et l'effet `5OY0BP3rdka8VYbJ`.
- Vérifier que les moves `Heavy Only` ne sont pas proposés pour un Bouclier léger.
- Vérifier que l'item d'arme créé contient les moves accordés, les `Keywords`, le texte dans le champ `Effect` PTR et les règles dans l'onglet Rules.
- Tester une arme `Reach`: elle doit avoir `Weapon`, `Two-Handed`, `Reach`, deux `FlatModifier` `large-melee` (`damage-base` +2, `attack-roll` -1) et un `GrantItem` vers `Compendium.ptu.capabilities.Item.o7NdOFXqtOAIFv6x`.
- Tester une arme à deux mains sans `Reach`: elle doit avoir `damage-base` +1 et `attack-roll` -1 avec le prédicat `move:weapon`.
- Tester une arme à une main: elle doit avoir `damage-base` +1 avec le prédicat `move:weapon`.
- Vérifier qu'un Trainer de niveau 10+ reçoit aussi le `FlatModifier` de bonus dégâts par niveau sur `damage-roll`.
- Entrer un coût Pokédollars total, puis un coût unitaire, et vérifier le total calculé.
- Déposer des ingrédients depuis l'inventaire du Trainer: ils doivent être seulement réservés avant confirmation.
- Cliquer `X` sur un ingrédient réservé: il doit disparaître de la liste sans modifier l'inventaire.
- Confirmer une Fabrication avec argent et ingrédients suffisants: argent et ingrédients sont retirés, l'objet final est ajouté et le résumé chat est posté.
- Tenter une Fabrication avec argent, PR ou ingrédients insuffisants: la confirmation doit être bloquée.
- Dans l'écran PR, vérifier que la liste de skills contient seulement `General Education`, `Medicine Education`, `Occult Education`, `Pokémon Education`, `Technology Education` et `Survival`.
- Dans `Petit Travail`, vérifier que la liste de skills contient aussi les skills non-Education comme `Acrobatics`, `Charm`, `Combat`, `Command`, `Focus`, `Guile`, `Intimidate`, `Intuition`, `Perception` et `Stealth`.
- Tester `Pickup` avec `Nombre de récoltes = 4`: le coût doit être `16 PR`, quatre tirages doivent partir dans le chat et les quatre résultats doivent apparaître dans l'historique.
- Terminer un entretien, changer la date Simple Calendar, cliquer `Nouvel entretien`, puis vérifier que l'app repart sur une fiche d'entretien vide pour la nouvelle date.
- Entrer un `Bonus PR` général et vérifier qu'il peut servir à Petit Travail, Récolte ou Fabrication.
- Entrer un `Bonus PR uniquement Petit Travail`, lancer un Petit Travail, puis vérifier que ce bonus ne permet pas de financer une Fabrication.
- Entrer un `Bonus PR uniquement Fabrication`, confirmer une Fabrication, puis vérifier que ce bonus ne permet pas de financer Petit Travail ou Récolte.
- Entrer un `Bonus PR uniquement Récolte`, confirmer une Récolte Pokémon, puis vérifier que ce bonus ne permet pas de financer Petit Travail ou Fabrication.
- Entrer un `Bonus PR uniquement Agriculture` et vérifier qu'il augmente les PR totaux sans débloquer les activités actuellement actives tant que l'Agriculture reste désactivée.
- Entrer un bonus avec un quart de PR, par exemple `0.25`, et vérifier que le total affiche `1/4 PR`.

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

1. Validation automatique plus stricte des capabilities, niveaux et Friendship pour certaines Récoltes Pokémon.
2. Agriculture / Jardinage avec Planting Stage, Growth Stage, Harvest Stage, Natural Specialty et Yield Rolls.
3. Panneau MJ d'evenement hebdomadaire avec bonus mecaniques.
