# PTR1e Runic Tab

Module Foundry VTT externe pour Pokemon Tabletop Reunited (`ptu`). Il ajoute un onglet `Runic` a la fiche Trainer afin de gerer des equipements enchantes par des Runes.

## Fonctionnalites

- Onglet `Runic` ajoute apres `Moves` et avant `Contests` sur la fiche Trainer compacte PTR1e.
- Slots d'equipement: Weapon, Torso / Body, Head, Feet.
- Orientation Physical / Special pour chaque slot.
- Weapon Type One-Handed / Two-Handed pour l'arme.
- Calcul automatique des RE Slots:
  - Physical: one-handed 4, two-handed 8, head 1, feet 1, torso 3.
  - Special: one-handed 6, two-handed 10, head 2, feet 2, torso 5.
- Items `Rune` comme items d'inventaire PTR standards (`type: item`, `system.category: "Rune"`).
- Champs Rune injectes dans la fiche d'item: Slot Rune, Rune Subname, Rune Category, Primary Rune Keyword, Linked Effect UUID.
- Fiche d'item Rune agrandie automatiquement pour afficher `Runic Enchanting`.
- Respect de la quantite: une Rune assignee ne consomme pas l'item, mais reduit la quantite disponible.
- Runes creees normalement par l'utilisateur ou depuis un compendium, puis glissees sur la fiche Trainer.
- Affichage visuel des RE Slots:
  - Grey: empty
  - Red: Offensive Rune
  - Blue: Defensive Rune
  - Yellow: Mixed Rune
- Nom visuel de l'equipement avec les subnames de Rune entre crochets, sans renommer l'item d'inventaire.

## Stockage

La configuration Runic est stockee sur l'Actor Trainer:

```text
flags.ptr1e-runic-tab.runic
```

Les metadonnees propres aux Runes sont stockees sur l'item:

```text
flags.ptr1e-runic-tab.slotRune
flags.ptr1e-runic-tab.runeSubname
flags.ptr1e-runic-tab.runeCategory
flags.ptr1e-runic-tab.primaryKeyword
flags.ptr1e-runic-tab.linkedEffect
```

Le module utilise des flags plutot que `system.runic` afin d'eviter les conflits avec le schema PTR1e de Foundry V13.

## Installation locale

Copier ce dossier dans le dossier Foundry:

```text
FoundryVTT/Data/modules/ptr1e-runic-tab
```

Activer ensuite `PTR1e Runic Tab` dans le monde PTR1e.

## Installation Forge / Foundry par manifest

Utiliser cette URL avec `Install from Manifest` dans Foundry ou Forge VTT:

```text
https://github.com/marcbenoitcote-star/ptr1e-runic-tab/releases/latest/download/module.json
```

Le depot GitHub et les assets de release doivent etre publics pour que Forge puisse les telecharger sans authentification.

## Utilisation

1. Ouvrir une fiche Actor de type Trainer.
2. Aller a l'onglet `Runic`.
3. Glisser un item Rune depuis un compendium ou l'inventaire vers la fiche Trainer.
4. Ouvrir la fiche de l'item Rune pour regler `Slot Rune`, `Rune Subname`, keyword, effet et resume.
5. Choisir l'equipement pour Weapon, Torso, Head ou Feet.
6. Regler l'orientation Physical / Special.
7. Pour Weapon, regler One-Handed / Two-Handed.
8. Assigner les Runes disponibles.

## A tester

- L'onglet `Runic` apparait bien entre `Moves` et `Contests`.
- L'onglet `Runic` n'apparait qu'une seule fois.
- Apres un changement dans Runic, la fiche reste sur l'onglet `Runic`.
- Les quatre slots d'equipement acceptent les items de l'inventaire du Trainer.
- Changer l'equipement d'un slot retire les Runes assignees a l'ancien equipement.
- Les valeurs RE Slots sont exactes pour Physical et Special.
- One-Handed / Two-Handed modifie correctement la capacite de l'arme.
- Une Rune `Slot Rune` 1 a 5 occupe le bon nombre de cases.
- Une Rune ne peut pas etre assignee si les RE Slots libres sont insuffisants.
- Une Rune avec quantite 1 ne peut pas etre assignee deux fois.
- Une Rune avec quantite 2 peut etre assignee deux fois.
- Les couleurs correspondent aux keywords Offensive Rune, Defensive Rune et Mixed Rune.
- Un keyword non reconnu affiche une couleur neutre.
- Les noms visuels affichent les subnames entre crochets sans renommer l'item.
- Supprimer un item Rune ou un item equipement nettoie les references Runic au prochain hook de suppression.
- Les champs Rune apparaissent dans la fiche d'item PTR et restent alignes avec les champs natifs.
- Forge / Foundry installe le module depuis le manifest public.
