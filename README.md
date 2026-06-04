# PTR1e Runic Tab

External Foundry VTT module for Pokemon Tabletop Reunited (`ptu`). It adds a `Runic` tab to Trainer sheets for managing rune-enchanted equipment.

## Features

- Adds a `Runic` tab after `Moves` and before `Contests` on PTR1e compact Trainer sheets.
- Equipment slots:
  - Weapon
  - Torso / Body
  - Head
  - Feet
- Physical / Special orientation for each equipment slot.
- One-Handed / Two-Handed weapon type for the Weapon slot.
- Automatic RE Slot calculation:
  - Physical: one-handed weapon 4, two-handed weapon 8, head 1, feet 1, torso 3.
  - Special: one-handed weapon 6, two-handed weapon 10, head 2, feet 2, torso 5.
- Rune items are standard PTR inventory items (`type: item`, `system.category: "Rune"`).
- Rune item fields injected into the item sheet:
  - Slot Rune
  - Rune Subname
  - Rune Category
  - Primary Rune Keyword
  - Linked Effect UUID
- Rune item sheets automatically open taller so `Runic Enchanting` is visible.
- Rune quantity is respected. Assigning a Rune does not permanently reduce item quantity, but it reduces the available assigned count.
- Runes are created by the user or imported from a compendium, then dragged onto a Trainer sheet.
- Visual RE Slot display:
  - Grey: empty
  - Red: Offensive Rune
  - Blue: Defensive Rune
  - Yellow: Mixed Rune
- Equipment display names show Rune subnames in brackets without renaming the actual inventory item.

## Storage

Runic configuration is stored on the Trainer Actor:

```text
flags.ptr1e-runic-tab.runic
```

Rune metadata is stored on the item:

```text
flags.ptr1e-runic-tab.slotRune
flags.ptr1e-runic-tab.runeSubname
flags.ptr1e-runic-tab.runeCategory
flags.ptr1e-runic-tab.primaryKeyword
flags.ptr1e-runic-tab.linkedEffect
```

The module uses flags instead of `system.runic` to avoid conflicts with the PTR1e Foundry V13 schema.

## Local Install

Copy this folder into your Foundry modules directory:

```text
FoundryVTT/Data/modules/ptr1e-runic-tab
```

Then enable `PTR1e Runic Tab` in your PTR1e world.

## Forge / Foundry Manifest Install

Use this URL with Foundry's or Forge VTT's `Install from Manifest` option:

```text
https://github.com/marcbenoitcote-star/ptr1e-runic-tab/releases/latest/download/module.json
```

The GitHub repository and release assets must be public so Forge and Foundry can download them without GitHub authentication.

## Usage

1. Open a Trainer Actor sheet.
2. Go to the `Runic` tab.
3. Drag a Rune item from a compendium or inventory onto the Trainer sheet.
4. Open the Rune item sheet and configure `Slot Rune`, `Rune Subname`, keyword, effect, and snippet.
5. Choose equipment for Weapon, Torso, Head, or Feet.
6. Set Physical / Special orientation.
7. For Weapon, set One-Handed / Two-Handed.
8. Assign available Runes.

## Test Checklist

- The `Runic` tab appears between `Moves` and `Contests`.
- The `Runic` tab appears only once.
- After changing something in Runic, the sheet remains on the `Runic` tab.
- The four equipment slots accept Trainer inventory items.
- Changing a slot's equipment removes Runes assigned to the previous equipment.
- RE Slot values are correct for Physical and Special equipment.
- One-Handed / Two-Handed changes weapon capacity correctly.
- A `Slot Rune` value from 1 to 5 occupies the correct number of RE Slots.
- A Rune cannot be assigned if there are not enough free RE Slots.
- A Rune with quantity 1 cannot be assigned twice.
- A Rune with quantity 2 can be assigned twice.
- Colors match Offensive Rune, Defensive Rune, and Mixed Rune keywords.
- An unrecognized keyword uses the neutral color.
- Visual equipment names show Rune subnames in brackets without renaming the item.
- Deleting a Rune item or equipment item cleans up Runic references on the next deletion hook.
- Rune fields appear on PTR item sheets and stay aligned with the native fields.
- Forge / Foundry installs the module from the public manifest.
