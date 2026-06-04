const MODULE_ID = "ptr1e-runic-tab";
const RUNIC_FLAG = "runic";
const RUNE_CATEGORY = "Rune";
const TEMPLATE_PATH = `modules/${MODULE_ID}/templates/runic-tab.hbs`;

const SLOT_DEFINITIONS = [
  { id: "weapon", labelKey: "PTR_RUNIC.Slots.Weapon", fallback: "Weapon", weapon: true },
  { id: "torso", labelKey: "PTR_RUNIC.Slots.Torso", fallback: "Torso / Body" },
  { id: "head", labelKey: "PTR_RUNIC.Slots.Head", fallback: "Head" },
  { id: "feet", labelKey: "PTR_RUNIC.Slots.Feet", fallback: "Feet" }
];

const ORIENTATION_OPTIONS = [
  { id: "physical", labelKey: "PTR_RUNIC.Orientation.Physical", fallback: "Physical" },
  { id: "special", labelKey: "PTR_RUNIC.Orientation.Special", fallback: "Special" }
];

const WEAPON_TYPE_OPTIONS = [
  { id: "oneHanded", labelKey: "PTR_RUNIC.Weapon.OneHanded", fallback: "One-Handed Weapon" },
  { id: "twoHanded", labelKey: "PTR_RUNIC.Weapon.TwoHanded", fallback: "Two-Handed Weapon" }
];

const RE_SLOT_VALUES = {
  physical: {
    weapon: { oneHanded: 4, twoHanded: 8 },
    torso: 3,
    head: 1,
    feet: 1
  },
  special: {
    weapon: { oneHanded: 6, twoHanded: 10 },
    torso: 5,
    head: 2,
    feet: 2
  }
};

const KEYWORD_DATA = {
  "Offensive Rune": {
    labelKey: "PTR_RUNIC.Keywords.Offensive",
    fallback: "Offensive Rune",
    colorClass: "offensive"
  },
  "Defensive Rune": {
    labelKey: "PTR_RUNIC.Keywords.Defensive",
    fallback: "Defensive Rune",
    colorClass: "defensive"
  },
  "Mixed Rune": {
    labelKey: "PTR_RUNIC.Keywords.Mixed",
    fallback: "Mixed Rune",
    colorClass: "mixed"
  }
};

const SLOT_MATCHERS = {
  weapon: /\b(weapon|sword|blade|axe|dagger|knife|spear|staff|wand|rod|bow|crossbow|gun|pistol|rifle|hammer|mace|club|whip)\b/i,
  torso: /\b(torso|body|armor|armour|fashion|chest|coat|robe|jacket|vest|mail|plate|clothes|clothing|outfit|suit)\b/i,
  head: /\b(head|helmet|helm|hat|mask|hood|crown|circlet|cap|visor|goggles)\b/i,
  feet: /\b(feet|foot|boot|boots|shoe|shoes|sandals|greaves)\b/i
};

const DEFAULT_ITEM_COLUMNS = {
  one: ["Key", "Medical", "Misc"],
  two: ["Pokemon Items", "PokeBalls", "TMs", "Money"],
  available: ["Equipment", "Food", RUNE_CATEGORY]
};

Hooks.once("ready", () => {
  if (game.system.id !== "ptu") return;
  registerActorSheetHooks();
  registerItemSheetHooks();
  registerDocumentCleanupHooks();
  exposeApi();
  console.log(`${MODULE_ID} | Ready.`);
});

function registerActorSheetHooks() {
  for (const hook of ["renderActorSheet", "renderPTUActorSheet", "renderPTUCharacterSheet"]) {
    Hooks.on(hook, (app, html) => {
      injectRunicTab(app, html).catch((error) => warn("actor-sheet", error));
    });
  }
}

function registerItemSheetHooks() {
  Hooks.on("renderItemSheet", (app, html) => {
    injectRuneItemFields(app, html).catch((error) => warn("item-sheet", error));
  });
}

function registerDocumentCleanupHooks() {
  Hooks.on("deleteItem", (item) => {
    cleanupDeletedItemReferences(item).catch((error) => warn("delete-item", error));
  });

  Hooks.on("createItem", (item) => {
    if (item?.actor?.type === "character" && isRuneItem(item)) {
      ensureActorRuneCategory(item.actor).catch((error) => warn("create-rune-category", error));
    }
  });

  Hooks.on("updateItem", (item) => {
    if (item?.actor?.type !== "character") return;
    if (isRuneItem(item)) {
      ensureActorRuneCategory(item.actor).catch((error) => warn("update-rune-category", error));
    } else {
      cleanupRuneAssignmentsForItem(item.actor, item.id).catch((error) => warn("update-rune-cleanup", error));
    }
  });
}

async function injectRunicTab(app, html) {
  const actor = app?.actor ?? app?.document ?? app?.object;
  if (!actor || actor.type !== "character") return;

  const root = getSheetRoot(app, html);
  if (!root) return;
  dedupeRunicElements(root);
  if (root.dataset.ptrRunicInjecting === "true") return;
  if (root.querySelector("[data-ptr-runic-tab]") || root.querySelector("[data-ptr-runic-nav]")) {
    bindRunicTabListeners(app, root);
    bindFoundryTabs(app, root);
    activateRunicAfterRender(app, root);
    return;
  }
  root.dataset.ptrRunicInjecting = "true";

  const nav = root.querySelector("nav.tabs[data-group='primary'], nav.tabs");
  const sheetBody = root.querySelector(".sheet-body");
  if (!nav || !sheetBody) {
    root.dataset.ptrRunicInjecting = "false";
    return;
  }

  try {
    const movesNav = nav.querySelector('[data-tab="moves"]');
    const contestsNav = nav.querySelector('[data-tab="contests"]');
    const navHtml = `<a class="item tooltip ball-themes" title="${escapeHtml(label("PTR_RUNIC.Tab", "Runic"))}" data-tab="runic" data-ptr-runic-nav><i class="fas fa-gem"></i></a>`;
    if (movesNav) movesNav.insertAdjacentHTML("afterend", navHtml);
    else if (contestsNav) contestsNav.insertAdjacentHTML("beforebegin", navHtml);
    else nav.insertAdjacentHTML("beforeend", navHtml);

    const data = await buildRunicTabData(actor);
    const tabHtml = await renderModuleTemplate(TEMPLATE_PATH, data);
    const movesTab = sheetBody.querySelector('[data-tab="moves"]');
    const contestsTab = sheetBody.querySelector('[data-tab="contests"]');
    if (movesTab) movesTab.insertAdjacentHTML("afterend", tabHtml);
    else if (contestsTab) contestsTab.insertAdjacentHTML("beforebegin", tabHtml);
    else sheetBody.insertAdjacentHTML("beforeend", tabHtml);

    dedupeRunicElements(root);
    bindRunicTabListeners(app, root);
    bindFoundryTabs(app, root);
    activateRunicAfterRender(app, root);
    root.dataset.ptrRunicInjected = "true";
  } finally {
    root.dataset.ptrRunicInjecting = "false";
  }
}

async function buildRunicTabData(actor) {
  const config = normalizeRunicConfig(actor.getFlag(MODULE_ID, RUNIC_FLAG));
  const items = actor.items?.contents ?? Array.from(actor.items ?? []);
  const runeItems = items.filter(isRuneItem);
  const equipmentItems = items.filter((item) => item.type === "item" && !isRuneItem(item));
  const assignedCounts = countAssignedRunes(config);
  const runeViewData = runeItems
    .map((item) => buildRuneViewData(item, assignedCounts.get(item.id) ?? 0))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    labels: getLabels(),
    slots: SLOT_DEFINITIONS.map((definition) => buildSlotViewData(actor, definition, config[definition.id], equipmentItems, runeViewData, assignedCounts)),
    runeItems: runeViewData
  };
}

function buildSlotViewData(actor, definition, slotState, equipmentItems, runeViewData, assignedCounts) {
  const equipment = slotState.itemId ? actor.items.get(slotState.itemId) : null;
  const capacity = getCapacity(definition.id, slotState);
  const assignedRunes = slotState.runes.map((assignment) => buildAssignedRuneViewData(actor, assignment));
  const usedSlots = assignedRunes.reduce((total, rune) => total + rune.slotRune, 0);
  const freeSlots = Math.max(0, capacity - usedSlots);
  const equipmentOptions = buildEquipmentOptions(equipmentItems, definition.id, slotState.itemId);
  const subnames = assignedRunes.filter((rune) => !rune.missing && rune.subname).map((rune) => `[${rune.subname}]`);
  const displayName = equipment ? [equipment.name, ...subnames].join(" ") : label("PTR_RUNIC.None", "None");
  const warning = getSlotWarning(equipment, slotState, usedSlots, capacity);

  return {
    id: definition.id,
    label: label(definition.labelKey, definition.fallback),
    isWeapon: !!definition.weapon,
    displayName,
    usedSlots,
    capacity,
    freeSlots,
    warning,
    slotLabel: `${usedSlots}/${capacity} RE`,
    equipmentOptions,
    orientationOptions: ORIENTATION_OPTIONS.map((option) => ({
      ...option,
      label: label(option.labelKey, option.fallback),
      selected: slotState.orientation === option.id
    })),
    weaponTypeOptions: WEAPON_TYPE_OPTIONS.map((option) => ({
      ...option,
      label: label(option.labelKey, option.fallback),
      selected: slotState.weaponType === option.id
    })),
    assignedRunes,
    slotBoxes: buildSlotBoxes(assignedRunes, capacity),
    runeOptions: buildRuneOptions(runeViewData, assignedCounts, freeSlots),
    canAdd: !!equipment && runeViewData.length > 0
  };
}

function buildRuneViewData(item, assigned) {
  const metadata = getRuneMetadata(item);
  const quantity = getItemQuantity(item);
  const available = Math.max(0, quantity - assigned);
  return {
    id: item.id,
    name: item.name,
    slotRune: metadata.slotRune,
    subname: metadata.runeSubname,
    keyword: metadata.keyword,
    keywordLabel: getKeywordLabel(metadata.keyword),
    colorClass: getKeywordColorClass(metadata.keyword),
    quantity,
    assigned,
    available,
    quantityLabel: format("PTR_RUNIC.Quantity", { available, quantity }, `${available}/${quantity} available`),
    snippet: String(item.system?.snippet ?? "").trim()
  };
}

function buildAssignedRuneViewData(actor, assignment) {
  const item = actor.items.get(assignment.runeItemId);
  const metadata = item ? getRuneMetadata(item) : assignment;
  const slotRune = clampInt(assignment.slotRune ?? metadata.slotRune, 1, 5);
  const keyword = assignment.keyword || metadata.keyword || "";
  const subname = assignment.runeSubname || metadata.runeSubname || "";
  const name = item?.name ?? "Missing Rune";
  const subnameLabel = subname ? `[${subname}]` : "";

  return {
    assignmentId: assignment.id,
    runeItemId: assignment.runeItemId,
    name,
    subname,
    label: subnameLabel ? `${name} ${subnameLabel}` : name,
    slotRune,
    keyword,
    keywordLabel: getKeywordLabel(keyword),
    colorClass: getKeywordColorClass(keyword),
    missing: !item
  };
}

function buildEquipmentOptions(items, slotId, selectedId) {
  return items
    .map((item) => ({
      id: item.id,
      label: getEquipmentOptionLabel(item, slotId),
      selected: item.id === selectedId,
      score: getCompatibilityScore(item, slotId)
    }))
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

function buildRuneOptions(runes, assignedCounts, freeSlots) {
  return runes.map((rune) => {
    const assigned = assignedCounts.get(rune.id) ?? 0;
    const available = Math.max(0, rune.quantity - assigned);
    const lacksQuantity = available <= 0;
    const lacksSlots = rune.slotRune > freeSlots;
    const suffix = lacksQuantity
      ? ` (${available} available)`
      : lacksSlots
        ? ` (${rune.slotRune} RE > ${freeSlots} free)`
        : ` (${available} available, ${rune.slotRune} RE)`;

    return {
      ...rune,
      optionLabel: `${rune.name}${suffix}`,
      disabled: lacksQuantity || lacksSlots
    };
  });
}

function buildSlotBoxes(assignedRunes, capacity) {
  const boxes = [];
  for (const rune of assignedRunes) {
    for (let i = 0; i < rune.slotRune; i++) {
      boxes.push({
        className: rune.colorClass,
        title: `${rune.label} - ${rune.keywordLabel}`
      });
    }
  }

  for (let i = boxes.length; i < capacity; i++) {
    boxes.push({
      className: "empty",
      title: label("PTR_RUNIC.None", "None")
    });
  }

  return boxes;
}

function getSlotWarning(equipment, slotState, usedSlots, capacity) {
  if (slotState.itemId && !equipment) return label("PTR_RUNIC.Warning.MissingEquipment", "The selected equipment no longer exists.");
  if (!slotState.itemId) return label("PTR_RUNIC.Warning.NoEquipment", "Choose equipment before assigning a Rune.");
  if (usedSlots > capacity) return label("PTR_RUNIC.Warning.OverCapacity", "Assigned Runes exceed available RE Slots.");
  return "";
}

function bindRunicTabListeners(app, root) {
  if (root.dataset.ptrRunicListeners === "true") return;
  root.dataset.ptrRunicListeners = "true";

  root.querySelector("[data-ptr-runic-tab]")?.addEventListener("change", (event) => {
    const control = event.target?.closest?.("[data-ptr-runic-action]");
    if (!control) return;
    handleRunicChange(app, control).catch((error) => warn("runic-change", error));
  });

  root.querySelector("[data-ptr-runic-tab]")?.addEventListener("click", (event) => {
    const control = event.target?.closest?.("[data-ptr-runic-action]");
    if (!control) return;
    event.preventDefault();
    handleRunicClick(app, root, control).catch((error) => warn("runic-click", error));
  });
}

async function handleRunicChange(app, control) {
  const actor = app.actor;
  if (!actor?.isOwner) return;

  const action = control.dataset.ptrRunicAction;
  const slotId = control.dataset.slot;
  if (!slotId) return;

  const config = normalizeRunicConfig(actor.getFlag(MODULE_ID, RUNIC_FLAG));
  const slot = config[slotId];
  if (!slot) return;

  if (action === "equipment") {
    const nextItemId = control.value || null;
    if (slot.itemId !== nextItemId) {
      slot.itemId = nextItemId;
      slot.runes = [];
    }
  } else if (action === "orientation") {
    slot.orientation = control.value === "special" ? "special" : "physical";
    trimRunesToCapacity(slotId, slot);
  } else if (action === "weapon-type") {
    slot.weaponType = control.value === "twoHanded" ? "twoHanded" : "oneHanded";
    trimRunesToCapacity(slotId, slot);
  }

  await saveRunicConfig(actor, config);
  rerenderRunicTab(app);
}

async function handleRunicClick(app, root, control) {
  const actor = app.actor;
  if (!actor?.isOwner) return;

  const action = control.dataset.ptrRunicAction;
  if (action === "edit-item") {
    const item = actor.items.get(control.dataset.itemId);
    item?.sheet?.render(true);
    return;
  }

  const slotId = control.dataset.slot;
  if (!slotId) return;

  if (action === "add-rune") {
    const select = root.querySelector(`[data-ptr-runic-rune-select][data-slot="${slotId}"]`);
    await assignRune(actor, slotId, select?.value ?? "");
    rerenderRunicTab(app);
    return;
  }

  if (action === "remove-rune") {
    const assignmentId = control.dataset.assignmentId;
    await removeRuneAssignment(actor, slotId, assignmentId);
    rerenderRunicTab(app);
  }
}

async function assignRune(actor, slotId, runeItemId) {
  if (!runeItemId) return ui.notifications.warn(label("PTR_RUNIC.Notify.NoRune", "Choose a Rune to assign."));

  const config = normalizeRunicConfig(actor.getFlag(MODULE_ID, RUNIC_FLAG));
  const slot = config[slotId];
  if (!slot?.itemId || !actor.items.get(slot.itemId)) {
    return ui.notifications.warn(label("PTR_RUNIC.Notify.NoEquipment", "Choose equipment before assigning a Rune."));
  }

  const rune = actor.items.get(runeItemId);
  if (!rune || !isRuneItem(rune)) {
    return ui.notifications.warn(label("PTR_RUNIC.Notify.RuneMissing", "The selected Rune is not in this Actor inventory."));
  }

  const assignedCounts = countAssignedRunes(config);
  const quantity = getItemQuantity(rune);
  const assigned = assignedCounts.get(rune.id) ?? 0;
  if (quantity - assigned <= 0) {
    return ui.notifications.warn(label("PTR_RUNIC.Notify.NoQuantity", "No available copy of this Rune remains."));
  }

  const metadata = getRuneMetadata(rune);
  const usedSlots = slot.runes.reduce((total, assignment) => total + clampInt(assignment.slotRune, 1, 5), 0);
  const freeSlots = getCapacity(slotId, slot) - usedSlots;
  if (metadata.slotRune > freeSlots) {
    return ui.notifications.warn(label("PTR_RUNIC.Notify.NoSlots", "Not enough free RE Slots for this Rune."));
  }

  slot.runes.push({
    id: randomID(),
    runeItemId: rune.id,
    slotRune: metadata.slotRune,
    keyword: metadata.keyword,
    runeSubname: metadata.runeSubname,
    linkedEffect: metadata.linkedEffect
  });

  await saveRunicConfig(actor, config);
}

async function removeRuneAssignment(actor, slotId, assignmentId) {
  const config = normalizeRunicConfig(actor.getFlag(MODULE_ID, RUNIC_FLAG));
  const slot = config[slotId];
  if (!slot) return;

  slot.runes = slot.runes.filter((assignment) => assignment.id !== assignmentId);
  await saveRunicConfig(actor, config);
}

async function injectRuneItemFields(app, html) {
  const item = app?.item ?? app?.document ?? app?.object;
  if (!item || item.type !== "item") return;

  const root = getSheetRoot(app, html);
  if (!root || root.querySelector("[data-ptr-runic-item-fields]")) return;

  const details = root.querySelector('.tab.details[data-tab="details"], .tab.details');
  if (!details) return;

  const anchor = details.querySelector('[name="system.category"]')?.closest(".item-row") ?? details.firstElementChild;
  const data = buildRuneItemFieldsData(item);
  const fieldsHtml = renderRuneItemFields(data);
  if (anchor) anchor.insertAdjacentHTML("afterend", fieldsHtml);
  else details.insertAdjacentHTML("afterbegin", fieldsHtml);

  root.querySelector("[data-ptr-runic-item-fields]")?.addEventListener("change", (event) => {
    const control = event.target?.closest?.("[data-ptr-runic-item-field]");
    if (!control) return;
    handleRuneItemFieldChange(app, control).catch((error) => warn("item-field-change", error));
  });
}

function buildRuneItemFieldsData(item) {
  const metadata = getRuneMetadata(item);
  const isRune = isRuneItem(item);
  return {
    isRune,
    slotRune: metadata.slotRune,
    runeSubname: metadata.runeSubname,
    runeCategory: metadata.runeCategory,
    primaryKeyword: metadata.keyword,
    linkedEffect: metadata.linkedEffect,
    keywordOptions: [
      { value: "", label: getKeywordLabel(""), selected: !metadata.keyword },
      ...Object.keys(KEYWORD_DATA).map((keyword) => ({
        value: keyword,
        label: getKeywordLabel(keyword),
        selected: metadata.keyword === keyword
      }))
    ]
  };
}

function renderRuneItemFields(data) {
  const keywordOptions = data.keywordOptions.map((option) => (
    `<option value="${escapeHtml(option.value)}" ${option.selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`
  )).join("");

  const details = data.isRune ? `
    <div class="item-row">
      <label>${escapeHtml(label("PTR_RUNIC.ItemFields.SlotRune", "Slot Rune"))}</label>
      <input data-ptr-runic-item-field="slotRune" type="number" min="1" max="5" step="1" value="${data.slotRune}">
    </div>
    <div class="item-row">
      <label>${escapeHtml(label("PTR_RUNIC.ItemFields.RuneSubname", "Rune Subname"))}</label>
      <input data-ptr-runic-item-field="runeSubname" type="text" value="${escapeHtml(data.runeSubname)}">
    </div>
    <div class="item-row">
      <label>${escapeHtml(label("PTR_RUNIC.ItemFields.RuneCategory", "Rune Category"))}</label>
      <input data-ptr-runic-item-field="runeCategory" type="text" value="${escapeHtml(data.runeCategory)}">
    </div>
    <div class="item-row">
      <label>${escapeHtml(label("PTR_RUNIC.ItemFields.PrimaryKeyword", "Primary Rune Keyword"))}</label>
      <select data-ptr-runic-item-field="primaryKeyword">${keywordOptions}</select>
    </div>
    <div class="item-row">
      <label>${escapeHtml(label("PTR_RUNIC.ItemFields.LinkedEffect", "Linked Effect UUID"))}</label>
      <input data-ptr-runic-item-field="linkedEffect" type="text" value="${escapeHtml(data.linkedEffect)}">
    </div>` : "";

  return `
    <section class="ptr-runic-rune-fields" data-ptr-runic-item-fields>
      <h3>${escapeHtml(label("PTR_RUNIC.ItemFields.Title", "Runic Rune Fields"))}</h3>
      <div class="item-row" style="justify-content: flex-start;">
        <label>${escapeHtml(label("PTR_RUNIC.ItemFields.IsRune", "Rune item"))}</label>
        <input data-ptr-runic-item-field="isRune" type="checkbox" ${data.isRune ? "checked" : ""}>
      </div>
      ${details}
    </section>`;
}

async function handleRuneItemFieldChange(app, control) {
  const item = app.item ?? app.document ?? app.object;
  if (!item?.isOwner) return;

  const field = control.dataset.ptrRunicItemField;
  const updates = {};

  if (field === "isRune") {
    const checked = control.checked;
    updates[`flags.${MODULE_ID}.isRune`] = checked;
    updates["system.category"] = checked ? RUNE_CATEGORY : "Misc";
    if (checked) {
      const primaryKeyword = getRuneMetadata(item).keyword || "Mixed Rune";
      updates[`flags.${MODULE_ID}.slotRune`] = getRuneMetadata(item).slotRune || 1;
      updates[`flags.${MODULE_ID}.runeSubname`] = getRuneMetadata(item).runeSubname || fallbackRuneSubname(item.name);
      updates[`flags.${MODULE_ID}.primaryKeyword`] = primaryKeyword;
      updates["system.keywords"] = mergePrimaryKeyword(item.system?.keywords ?? [], primaryKeyword);
    }
  } else if (field === "slotRune") {
    updates[`flags.${MODULE_ID}.slotRune`] = clampInt(control.value, 1, 5);
  } else if (field === "runeSubname") {
    updates[`flags.${MODULE_ID}.runeSubname`] = String(control.value ?? "").trim();
  } else if (field === "runeCategory") {
    updates[`flags.${MODULE_ID}.runeCategory`] = String(control.value ?? "").trim();
  } else if (field === "primaryKeyword") {
    const keyword = hasKnownKeyword(control.value) ? control.value : "";
    updates[`flags.${MODULE_ID}.primaryKeyword`] = keyword;
    updates["system.keywords"] = mergePrimaryKeyword(item.system?.keywords ?? [], keyword);
  } else if (field === "linkedEffect") {
    const linkedEffect = String(control.value ?? "").trim();
    updates[`flags.${MODULE_ID}.linkedEffect`] = linkedEffect;
    updates["system.referenceEffect"] = linkedEffect;
  }

  await item.update(updates);
  if (item.actor?.type === "character" && isRuneItem(item)) await ensureActorRuneCategory(item.actor);
  app.render(false);
}

function normalizeRunicConfig(raw) {
  const source = foundry.utils.deepClone(raw ?? {});
  const result = {};

  for (const definition of SLOT_DEFINITIONS) {
    const existing = source[definition.id] ?? {};
    result[definition.id] = {
      itemId: existing.itemId || null,
      weaponType: existing.weaponType === "twoHanded" ? "twoHanded" : "oneHanded",
      orientation: existing.orientation === "special" ? "special" : "physical",
      runes: Array.isArray(existing.runes)
        ? existing.runes.map(normalizeRuneAssignment).filter(Boolean)
        : []
    };
  }

  return result;
}

function normalizeRuneAssignment(assignment) {
  if (!assignment?.runeItemId) return null;
  return {
    id: assignment.id || randomID(),
    runeItemId: assignment.runeItemId,
    slotRune: clampInt(assignment.slotRune, 1, 5),
    keyword: String(assignment.keyword ?? ""),
    runeSubname: String(assignment.runeSubname ?? ""),
    linkedEffect: String(assignment.linkedEffect ?? "")
  };
}

async function saveRunicConfig(actor, config) {
  await actor.setFlag(MODULE_ID, RUNIC_FLAG, normalizeRunicConfig(config));
}

function trimRunesToCapacity(slotId, slot) {
  const capacity = getCapacity(slotId, slot);
  let used = 0;
  const kept = [];
  for (const assignment of slot.runes) {
    const slotRune = clampInt(assignment.slotRune, 1, 5);
    if (used + slotRune > capacity) continue;
    used += slotRune;
    kept.push(assignment);
  }
  slot.runes = kept;
}

function getCapacity(slotId, slotState) {
  const orientation = slotState.orientation === "special" ? "special" : "physical";
  if (slotId === "weapon") {
    const weaponType = slotState.weaponType === "twoHanded" ? "twoHanded" : "oneHanded";
    return RE_SLOT_VALUES[orientation].weapon[weaponType];
  }
  return RE_SLOT_VALUES[orientation][slotId] ?? 0;
}

function countAssignedRunes(config) {
  const counts = new Map();
  for (const slot of Object.values(config)) {
    for (const assignment of slot.runes ?? []) {
      counts.set(assignment.runeItemId, (counts.get(assignment.runeItemId) ?? 0) + 1);
    }
  }
  return counts;
}

function getRuneMetadata(item) {
  const flag = (key) => item?.getFlag?.(MODULE_ID, key);
  const keyword = getPrimaryRuneKeyword(item);
  return {
    slotRune: clampInt(flag("slotRune") ?? item?.system?.slotRune ?? 1, 1, 5),
    runeSubname: String(flag("runeSubname") ?? item?.system?.runeSubname ?? fallbackRuneSubname(item?.name)).trim(),
    runeCategory: String(flag("runeCategory") ?? item?.system?.runeCategory ?? "").trim(),
    keyword,
    linkedEffect: String(flag("linkedEffect") ?? item?.system?.referenceEffect ?? "").trim()
  };
}

function isRuneItem(item) {
  if (!item || item.type !== "item") return false;
  if (item.getFlag?.(MODULE_ID, "isRune")) return true;
  return String(item.system?.category ?? "").trim().toLowerCase() === RUNE_CATEGORY.toLowerCase();
}

function getPrimaryRuneKeyword(item) {
  const flagged = item?.getFlag?.(MODULE_ID, "primaryKeyword");
  if (hasKnownKeyword(flagged)) return flagged;

  for (const keyword of normalizeKeywords(item?.system?.keywords)) {
    if (hasKnownKeyword(keyword)) return keyword;
  }
  return "";
}

function normalizeKeywords(keywords) {
  if (!Array.isArray(keywords)) return [];
  return keywords.map((keyword) => {
    if (typeof keyword === "string") return keyword;
    return keyword?.value ?? keyword?.label ?? "";
  }).filter(Boolean);
}

function mergePrimaryKeyword(keywords, primaryKeyword) {
  const values = normalizeKeywords(keywords).filter((keyword) => !hasKnownKeyword(keyword));
  if (primaryKeyword) values.push(primaryKeyword);
  return values;
}

function hasKnownKeyword(keyword) {
  return Object.prototype.hasOwnProperty.call(KEYWORD_DATA, keyword);
}

function getItemQuantity(item) {
  const value = Number(item?.system?.quantity ?? 0);
  return Math.max(0, Number.isFinite(value) ? Math.trunc(value) : 0);
}

function fallbackRuneSubname(name) {
  return String(name ?? "Rune").replace(/\s*rune\s*/ig, " ").trim() || "Rune";
}

function getKeywordLabel(keyword) {
  const data = KEYWORD_DATA[keyword];
  if (!data) return label("PTR_RUNIC.Keywords.Unknown", "Unrecognized Rune");
  return label(data.labelKey, data.fallback);
}

function getKeywordColorClass(keyword) {
  return KEYWORD_DATA[keyword]?.colorClass ?? "unknown";
}

function getCompatibilityScore(item, slotId) {
  const slots = getCompatibleSlots(item);
  if (slots.has(slotId)) return 3;
  if (slots.has("equipment")) return 2;
  return 1;
}

function getEquipmentOptionLabel(item, slotId) {
  const score = getCompatibilityScore(item, slotId);
  return score > 1 ? item.name : `${item.name} (other)`;
}

function getCompatibleSlots(item) {
  const text = [
    item.name,
    item.system?.category,
    item.system?.subtype,
    ...normalizeKeywords(item.system?.keywords)
  ].join(" ");

  const slots = new Set();
  for (const [slot, matcher] of Object.entries(SLOT_MATCHERS)) {
    if (matcher.test(text)) slots.add(slot);
  }

  if (/\b(equipment|equip|armor|armour|fashion|weapon)\b/i.test(text)) slots.add("equipment");
  return slots;
}

function createRuneItemData() {
  return {
    name: "New Rune",
    type: "item",
    img: "icons/svg/aura.svg",
    system: {
      quantity: 1,
      cost: 0,
      category: RUNE_CATEGORY,
      keywords: ["Mixed Rune"],
      effect: "",
      snippet: "",
      referenceEffect: ""
    },
    flags: {
      [MODULE_ID]: {
        isRune: true,
        slotRune: 1,
        runeSubname: "Rune",
        runeCategory: "General",
        primaryKeyword: "Mixed Rune",
        linkedEffect: ""
      }
    }
  };
}

async function ensureActorRuneCategory(actor) {
  if (!actor?.isOwner || actor.type !== "character") return;

  const updates = {};
  if (foundry.utils.getProperty(actor, "system.item_categories.Rune") !== true) {
    updates["system.item_categories.Rune"] = true;
  }

  const columns = foundry.utils.deepClone(actor.getFlag("ptu", "itemColumns") ?? DEFAULT_ITEM_COLUMNS);
  columns.one ??= [];
  columns.two ??= [];
  columns.available ??= [];
  if (![...columns.one, ...columns.two, ...columns.available].includes(RUNE_CATEGORY)) {
    columns.available.push(RUNE_CATEGORY);
    updates["flags.ptu.itemColumns"] = columns;
  }

  if (Object.keys(updates).length) await actor.update(updates);
}

async function cleanupDeletedItemReferences(item) {
  const actor = item?.actor;
  if (!actor || actor.type !== "character") return;

  const config = normalizeRunicConfig(actor.getFlag(MODULE_ID, RUNIC_FLAG));
  let changed = false;

  for (const slot of Object.values(config)) {
    if (slot.itemId === item.id) {
      slot.itemId = null;
      slot.runes = [];
      changed = true;
      continue;
    }

    const nextRunes = slot.runes.filter((assignment) => assignment.runeItemId !== item.id);
    if (nextRunes.length !== slot.runes.length) {
      slot.runes = nextRunes;
      changed = true;
    }
  }

  if (changed) await saveRunicConfig(actor, config);
}

async function cleanupRuneAssignmentsForItem(actor, itemId) {
  const config = normalizeRunicConfig(actor.getFlag(MODULE_ID, RUNIC_FLAG));
  let changed = false;

  for (const slot of Object.values(config)) {
    const nextRunes = slot.runes.filter((assignment) => assignment.runeItemId !== itemId);
    if (nextRunes.length !== slot.runes.length) {
      slot.runes = nextRunes;
      changed = true;
    }
  }

  if (changed) await saveRunicConfig(actor, config);
}

function bindFoundryTabs(app, root) {
  if (root.dataset.ptrRunicTabsBound === "true") return;
  root.dataset.ptrRunicTabsBound = "true";

  for (const tab of app?._tabs ?? []) {
    if (tab?.bind instanceof Function) tab.bind(root);
  }

  const runicNav = root.querySelector("[data-ptr-runic-nav]");
  if (!runicNav) return;

  runicNav.addEventListener("click", (event) => {
    event.preventDefault();
    rememberActiveTab(app, "runic");
    activateRunicTab(root);
  });

  root.querySelectorAll("nav.tabs [data-tab]:not([data-tab='runic'])").forEach((tab) => {
    tab.addEventListener("click", () => {
      rememberActiveTab(app, tab.dataset.tab);
      deactivateRunicTab(root);
    });
  });
}

function dedupeRunicElements(root) {
  for (const selector of ["[data-ptr-runic-nav]", "[data-ptr-runic-tab]"]) {
    const elements = Array.from(root.querySelectorAll(selector));
    for (const element of elements.slice(1)) element.remove();
  }
}

function rerenderRunicTab(app) {
  rememberActiveTab(app, "runic");
  for (const tab of app?._tabs ?? []) {
    if ("active" in tab) tab.active = "runic";
  }
  app.render(false);
}

function rememberActiveTab(app, tab) {
  if (!app) return;
  app[MODULE_ID] ??= {};
  app[MODULE_ID].activeTab = tab;
  app[MODULE_ID].activateRunicAfterRender = tab === "runic";
}

function activateRunicAfterRender(app, root) {
  const state = app?.[MODULE_ID];
  if (state?.activateRunicAfterRender || state?.activeTab === "runic") {
    activateRunicTab(root);
    state.activateRunicAfterRender = false;
  }
}

function activateRunicTab(root) {
  root.querySelectorAll("nav.tabs [data-tab]").forEach((el) => el.classList.toggle("active", el.dataset.tab === "runic"));
  root.querySelectorAll(".sheet-body > .tab[data-tab]").forEach((el) => el.classList.toggle("active", el.dataset.tab === "runic"));
}

function deactivateRunicTab(root) {
  root.querySelector("[data-ptr-runic-nav]")?.classList.remove("active");
  root.querySelector("[data-ptr-runic-tab]")?.classList.remove("active");
}

function getSheetRoot(app, html) {
  if (html?.jquery) return html[0];
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (app?.element?.jquery) return app.element[0];
  if (app?.element instanceof HTMLElement) return app.element;
  if (app?.element?.[0] instanceof HTMLElement) return app.element[0];
  return document.getElementById(app?.id) ?? null;
}

async function renderModuleTemplate(path, data) {
  const renderer = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  return renderer(path, data);
}

function getLabels() {
  return {
    equipment: label("PTR_RUNIC.Equipment", "Equipment"),
    none: label("PTR_RUNIC.None", "None"),
    weaponType: label("PTR_RUNIC.WeaponType", "Weapon Type"),
    orientation: label("PTR_RUNIC.Orientation", "Orientation"),
    assignedRunes: label("PTR_RUNIC.AssignedRunes", "Assigned Runes"),
    noAssignedRunes: label("PTR_RUNIC.NoAssignedRunes", "No rune assigned."),
    selectRune: label("PTR_RUNIC.SelectRune", "Select a Rune"),
    assign: label("PTR_RUNIC.Assign", "Assign"),
    remove: label("PTR_RUNIC.Remove", "Remove"),
    edit: label("PTR_RUNIC.Edit", "Edit"),
    runeInventory: label("PTR_RUNIC.RuneInventory", "Rune Inventory"),
    noRunes: label("PTR_RUNIC.NoRunes", "No Rune item found on this Trainer.")
  };
}

function label(key, fallback) {
  const value = game.i18n.localize(key);
  return value && value !== key ? value : fallback;
}

function format(key, data, fallback) {
  const template = game.i18n.localize(key);
  if (!template || template === key) return fallback;
  return game.i18n.format(key, data);
}

function randomID() {
  return foundry.utils.randomID?.() ?? Math.random().toString(36).slice(2, 18);
}

function clampInt(value, min, max) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function warn(scope, error) {
  console.warn(`${MODULE_ID} | ${scope}`, error);
}

function exposeApi() {
  game.ptrRunic = {
    getConfig: (actor) => normalizeRunicConfig(actor?.getFlag?.(MODULE_ID, RUNIC_FLAG)),
    setConfig: saveRunicConfig,
    createRuneItemData,
    isRuneItem,
    getRuneMetadata
  };
}
