﻿﻿﻿/**
 * FAZBEAR'S RESTOCKED - BEDROCK
 * §2025
 * 
 * If you want to modify or use this system as a base, contact the code developer, 
 * Hyrxs (discord: hyrxs), for more information and authorization
 * 
 * DO NOT COPY OR STEAL, ty :>
 *  
*/


import { world, system, BlockPermutation, Direction, EquipmentSlot, GameMode } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { dynamicToast, dynamicToastEvent, cleanupLampVfxEntitiesOnReload, cleanupLampVfxEntitiesSilent, getLinePoints, turnOffLight, lampVfxEntities, getExistingVfxEntity, VFX_ENTITY_TYPES, rebuildVfxCache, findAnyVfxEntityAtLocation } from "./utils.js";
import { LIGHT_TYPES, SWITCH_TYPES, GENERATOR_TYPES, LIGHT_ALIASES, SWITCH_ALIASES, GENERATOR_ALIASES, LIGHT_ICONS, SWITCH_ICONS, GENERATOR_ICONS, CONNECTIONS_KEY, GENERATORS_KEY, MAX_ENERGY, DEFAULT_CONSUMPTION_RATE, CONSUMPTION_MULTIPLIER, NEAR_DISTANCE, getAllLightTypes, getAllSwitchTypes, isLightType, isSwitchType, getBlockAlias, getBlockIcon, DOOR_BUTTON_GENERATOR_LINKS_KEY, getVfxEntityForLight } from "./connection_types.js";
import { isPlayerInCamera } from "../camera_system/security_camera_system.js";
import { getChunkedData, setChunkedData, initializeStorage, STORAGE_KEYS } from "./chunked_storage.js";

const DEFAULT_SWITCH_LIMIT = 15;
const DEFAULT_GENERATOR_LIMIT = 40;

export function getSwitchLimit() {
  return world.getDynamicProperty("fr:switch_limit") ?? DEFAULT_SWITCH_LIMIT;
}

export function getGeneratorLimit() {
  return world.getDynamicProperty("fr:generator_limit") ?? DEFAULT_GENERATOR_LIMIT;
}

export function setSwitchLimit(value) {
  world.setDynamicProperty("fr:switch_limit", value);
}

export function setGeneratorLimit(value) {
  world.setDynamicProperty("fr:generator_limit", value);
}

import { SelectionType, setSelection, getSelection, clearSelection, hasSelectionOfType, registerCleanupHandler } from "./selection_manager.js";
import { getGeneratorLinkedDoorButtons, getDoorButtonConnections, removeDoorButtonGeneratorLink, openConnectedDoors, isLightConnectedToDoorButton, clearDoorButtonVfxCache, rebuildDoorButtonVfxCache } from './door_buttons.js'

let selections = {};

const playerHudState = new Map();

function sendDebug(player, message) {
  if (player.hasTag("debug_energy")) {
    player.sendMessage(`§7[DEBUG] ${message}`);
  }
}


registerCleanupHandler(SelectionType.SWITCH, (playerId, data) => {
  if (selections[playerId]) {
    delete selections[playerId];
  }
});

registerCleanupHandler(SelectionType.GENERATOR, (playerId, data) => {
  if (selections[playerId]) {
    delete selections[playerId];
  }
});


export function clearSwitchSelection(playerId) {
  if (selections[playerId]) {
    try {
      const oldPos = selections[playerId].pos;
      const oldDim = world.getDimension(oldPos.dimensionId);
      oldDim.runCommand(`execute at @e[type=fr:selection] positioned ${oldPos.x} ${oldPos.y} ${oldPos.z} run event entity @e[r=1] destroy`);
    } catch { }
    delete selections[playerId];
  }
}

export function clearGeneratorSelectionForCamera(playerId) {
  if (selections[playerId] && selections[playerId].category === "generator") {
    try {
      const oldPos = selections[playerId].pos;
      const oldDim = world.getDimension(oldPos.dimensionId);
      oldDim.runCommand(`execute at @e[type=fr:selection] positioned ${oldPos.x} ${oldPos.y} ${oldPos.z} run event entity @e[r=1] destroy`);
    } catch { }
    delete selections[playerId];
    clearSelection(playerId);
  }
}


export function hasSwitchSelection(playerId) {
  return !!selections[playerId];
}

// Reconstruir cache de entidades VFX al cargar (NO limpiar, reutilizar existentes)
system.runTimeout(() => {
  const connections = getConnections();
  rebuildVfxCache(connections, getVfxEntityForLight);
  rebuildDoorButtonVfxCache();
  
  const players = world.getPlayers();
  if (players.length > 0) {
    players.forEach(player => {
      player.sendMessage(dynamicToast(
        "§l§qSUCCESS",
        `§qScripts reloaded...`,
        "textures/fr_ui/approve_icon",
        "textures/fr_ui/approve_ui"
      ));
    });
  }
}, 5);
// Ya no limpiamos el cache, lo reconstruimos arriba

function clearAllHudsOnReload() {
  for (const key in selections) {
    delete selections[key];
  }
  playerHudState.clear();
}
clearAllHudsOnReload();

world.afterEvents.worldLoad?.subscribe?.(() => {
  try {
    for (const player of world.getPlayers()) {
      player.runCommand(`title @s title §e§n§e§r§g§y§p §r`);
    }
    system.runTimeout(() => {
      try {
        for (const player of world.getPlayers()) {
          player.runCommand(`title @s title §e§n§e§r§g§y§l§o§w §r`);
        }
      } catch { }
    }, 20);
  } catch { }
});

system.runTimeout(() => {
  try {
    for (const player of world.getPlayers()) {
      player.runCommand(`title @s title §e§n§e§r§g§y§p §r`);
    }
    system.runTimeout(() => {
      try {
        for (const player of world.getPlayers()) {
          player.runCommand(`title @s title §e§n§e§r§g§y§l§o§w §r`);
        }
      } catch { }
    }, 20);
  } catch { }
}, 20);

system.afterEvents.scriptEventReceive.subscribe((data) => {
  const { id, sourceEntity, message } = data;
  if (id === 'cn:main') {
    sourceEntity.sendMessage(dynamicToastEvent(message));
  }
  if (id === 'fr:debug_connections' && sourceEntity) {
    const doorButtonConns = getDoorButtonConnections();
    const switchConns = getConnections();
    sourceEntity.sendMessage(`§e=== Door Button Connections (${doorButtonConns.length}) ===`);
    doorButtonConns.slice(0, 10).forEach((conn, i) => {
      const lightData = conn.lightBlock || conn.officeLightBlock;
      if (lightData) {
        sourceEntity.sendMessage(`§7[${i}] Light: ${lightData.x},${lightData.y},${lightData.z}`);
      }
    });
    if (doorButtonConns.length > 10) sourceEntity.sendMessage(`§7... and ${doorButtonConns.length - 10} more`);
    sourceEntity.sendMessage(`§e=== Switch/Generator Connections (${switchConns.length}) ===`);
    switchConns.slice(0, 10).forEach((conn, i) => {
      sourceEntity.sendMessage(`§7[${i}] Light: ${conn.light.x},${conn.light.y},${conn.light.z}`);
    });
    if (switchConns.length > 10) sourceEntity.sendMessage(`§7... and ${switchConns.length - 10} more`);
  }
  if (id === 'fr:check_light' && sourceEntity) {
    const parts = message.split(' ');
    if (parts.length >= 3) {
      const x = parseInt(parts[0]), y = parseInt(parts[1]), z = parseInt(parts[2]);
      const dimId = sourceEntity.dimension.id;
      const doorButtonConns = getDoorButtonConnections();
      const found = doorButtonConns.find(conn => {
        const lightData = conn.lightBlock || conn.officeLightBlock;
        return lightData && lightData.x === x && lightData.y === y && lightData.z === z && lightData.dimensionId === dimId;
      });
      if (found) {
        sourceEntity.sendMessage(`§c[FOUND] Light at ${x},${y},${z} IS connected to door button at ${found.doorBlock.x},${found.doorBlock.y},${found.doorBlock.z}`);
      } else {
        sourceEntity.sendMessage(`§a[OK] Light at ${x},${y},${z} is NOT connected to any door button`);
      }
    }
  }
  if (id === 'fr:clear_door_button_conn' && sourceEntity) {
    const parts = message.split(' ');
    if (parts.length >= 3) {
      const x = parseInt(parts[0]), y = parseInt(parts[1]), z = parseInt(parts[2]);
      const dimId = sourceEntity.dimension.id;
      let doorButtonConns = getDoorButtonConnections();
      const before = doorButtonConns.length;
      doorButtonConns = doorButtonConns.filter(conn => {
        const lightData = conn.lightBlock || conn.officeLightBlock;
        return !(lightData && lightData.x === x && lightData.y === y && lightData.z === z && lightData.dimensionId === dimId);
      });
      setChunkedData(STORAGE_KEYS.DOOR_BUTTON_CONNECTIONS, doorButtonConns);
      sourceEntity.sendMessage(`§aRemoved ${before - doorButtonConns.length} connection(s) for light at ${x},${y},${z}`);
    }
  }
  if (id === 'fr:show_generator_hud') {
    const parts = message.split(' ');
    if (parts.length >= 4) {
      const playerName = parts[0];
      const x = parseInt(parts[1]);
      const y = parseInt(parts[2]);
      const z = parseInt(parts[3]);
      const player = world.getPlayers().find(p => p.name === playerName);
      if (player) {
        const blockPos = { x, y, z, dimensionId: player.dimension.id };
        const generatorData = getGeneratorAt(blockPos);
        if (generatorData) {
          if (selections[player.id]) {
            const oldPos = selections[player.id].pos;
            const oldDim = world.getDimension(oldPos.dimensionId);
            oldDim.runCommand(`execute at @e[type=fr:selection] positioned ${oldPos.x} ${oldPos.y} ${oldPos.z} run event entity @e[r=1] destroy`);
          }
          selections[player.id] = { pos: blockPos, category: "generator" };
          setSelection(player.id, SelectionType.GENERATOR, { pos: blockPos, category: "generator" });
          const dimension = world.getDimension(blockPos.dimensionId);
          dimension.runCommand(`execute positioned ${blockPos.x} ${blockPos.y} ${blockPos.z} run summon fr:selection ~ ~ ~ 0 0`);
          updateGeneratorTitle(player, generatorData);
        }
      }
    }
  }
});

const getConnections = () => getChunkedData(STORAGE_KEYS.SWITCH_CONNECTIONS);
const setConnections = (connections) => setChunkedData(STORAGE_KEYS.SWITCH_CONNECTIONS, connections);


export function isLightConnectedToSwitch(lightPos, dimensionId) {
  const connections = getConnections();
  return connections.some(conn =>
    conn.light.x === lightPos.x &&
    conn.light.y === lightPos.y &&
    conn.light.z === lightPos.z &&
    conn.light.dimensionId === dimensionId
  );
}


export { getConnections as getSwitchConnections };

function cleanupOrphanedConnections() {
  let connections = getConnections();
  let changed = false;
  connections = connections.filter(conn => {
    try {
      const dimension = world.getDimension(conn.switch.dimensionId);
      const switchPos = { x: conn.switch.x, y: conn.switch.y, z: conn.switch.z };
      const lightPos = { x: conn.light.x, y: conn.light.y, z: conn.light.z };


      let switchBlock, lightBlock;
      try {
        switchBlock = dimension.getBlock(switchPos);
      } catch {

        return true;
      }
      try {
        lightBlock = world.getDimension(conn.light.dimensionId).getBlock(lightPos);
      } catch {

        return true;
      }


      if (!switchBlock || !lightBlock) {
        return true;
      }


      const switchValid = isSwitchType(switchBlock.typeId) || GENERATOR_TYPES.has(switchBlock.typeId);
      const lightValid = isLightType(lightBlock.typeId);

      if (!switchValid || !lightValid) {
        changed = true;
        return false;
      }
      return true;
    } catch {

      return true;
    }
  });
  if (changed) {
    setConnections(connections);
  }
}

function cleanupOrphanedGenerators() {
  let generators = getGenerators();
  let changed = false;
  generators = generators.filter(gen => {
    try {
      const dimension = world.getDimension(gen.pos.dimensionId);
      const pos = { x: gen.pos.x, y: gen.pos.y, z: gen.pos.z };

      let block;
      try {
        block = dimension.getBlock(pos);
      } catch {

        return true;
      }


      if (!block) {
        return true;
      }


      if (!GENERATOR_TYPES.has(block.typeId)) {
        changed = true;
        return false;
      }
      return true;
    } catch {

      return true;
    }
  });
  if (changed) {
    setGenerators(generators);
  }
}
const getGenerators = () => getChunkedData(STORAGE_KEYS.GENERATORS);
const setGenerators = (generators) => setChunkedData(STORAGE_KEYS.GENERATORS, generators);

export function setGeneratorDrainRate(x, y, z, dimensionId, rate) {
  const blockPos = { x, y, z, dimensionId };
  const generators = getGenerators();
  const genIndex = generators.findIndex(gen =>
    gen.pos.x === blockPos.x &&
    gen.pos.y === blockPos.y &&
    gen.pos.z === blockPos.z &&
    gen.pos.dimensionId === blockPos.dimensionId
  );

  if (genIndex === -1) {
    return { success: false, message: 'No generator found at position' };
  }

  const clampedRate = Math.max(10, Math.min(200, rate));
  const drainRate = clampedRate / 100;

  generators[genIndex].consumptionRate = drainRate;
  setGenerators(generators);

  return { success: true, message: `Generator drain rate set to ${clampedRate}%` };
}

export function getGeneratorAt(pos) {
  const generators = getGenerators();
  return generators.find(gen =>
    gen.pos.x === pos.x &&
    gen.pos.y === pos.y &&
    gen.pos.z === pos.z &&
    gen.pos.dimensionId === pos.dimensionId
  );
}
function updateGenerator(updatedGen) {
  let generators = getGenerators();
  generators = generators.map(gen => {
    if (
      gen.pos.x === updatedGen.pos.x &&
      gen.pos.y === updatedGen.pos.y &&
      gen.pos.z === updatedGen.pos.z &&
      gen.pos.dimensionId === updatedGen.pos.dimensionId
    ) {
      return updatedGen;
    }
    return gen;
  });
  setGenerators(generators);
}
function disconnectSingleConnection(player, connection) {
  let connections = getConnections();
  const index = connections.findIndex(conn =>
    conn.switch.x === connection.switch.x &&
    conn.switch.y === connection.switch.y &&
    conn.switch.z === connection.switch.z &&
    conn.switch.dimensionId === connection.switch.dimensionId &&
    conn.light.x === connection.light.x &&
    conn.light.y === connection.light.y &&
    conn.light.z === connection.light.z &&
    conn.light.dimensionId === connection.light.dimensionId
  );
  if (index !== -1) {
    connections.splice(index, 1);
    setConnections(connections);
    turnOffLight(connection, LIGHT_TYPES);
    player.sendMessage(dynamicToast("§l§qSUCCESS", "§qConnection removed §7", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
  }
}
function disconnectSingleConnectionNoMessage(player, connection) {
  let connections = getConnections();
  const index = connections.findIndex(conn =>
    conn.switch.x === connection.switch.x &&
    conn.switch.y === connection.switch.y &&
    conn.switch.z === connection.switch.z &&
    conn.switch.dimensionId === connection.switch.dimensionId &&
    conn.light.x === connection.light.x &&
    conn.light.y === connection.light.y &&
    conn.light.z === connection.light.z &&
    conn.light.dimensionId === connection.light.dimensionId
  );
  if (index !== -1) {
    connections.splice(index, 1);
    setConnections(connections);
    turnOffLight(connection, LIGHT_TYPES);
  }
}
function disconnectConnections(player, connectionsToDisconnect) {
  let connections = getConnections();
  connectionsToDisconnect.forEach(conn => {
    turnOffLight(conn, LIGHT_TYPES);
  });
  connections = connections.filter(conn =>
    !connectionsToDisconnect.some(disconn =>
      disconn.switch.x === conn.switch.x &&
      disconn.switch.y === conn.switch.y &&
      disconn.switch.z === conn.switch.z &&
      disconn.switch.dimensionId === conn.switch.dimensionId &&
      disconn.light.x === conn.light.x &&
      disconn.light.y === conn.light.y &&
      disconn.light.z === conn.light.z &&
      disconn.light.dimensionId === conn.light.dimensionId
    )
  );
  setConnections(connections);
  player.sendMessage(dynamicToast("§l§qSUCCESS", "§qConnection removed §7", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
}
function showDisconnectSubmenu(player, connection) {
  const form = new ActionFormData()
    .title("Connection")
    .body(
      `Block: (${connection.light.x}, ${connection.light.y}, ${connection.light.z})\n` +
      `Switch block: (${connection.switch.x}, ${connection.switch.y}, ${connection.switch.z})\n` +
      "Disconnect this connection?"
    )
    .button("Disconnect")
    .button("Back");
  form.show(player).then(response => {
    if (response.selection === 0) {
      disconnectSingleConnection(player, connection);
    }
  });
}
function showDisconnectMenu(player, connectionsList) {
  const form = new ActionFormData()
    .title("Current Connections")
    .body("Select a connection or choose 'Disconnect All'.");
  connectionsList.forEach((conn, index) => {
    const label = `Block: (${conn.light.x}, ${conn.light.y}, ${conn.light.z})\n` +
      `Switch/Generator: (${conn.switch.x}, ${conn.switch.y}, ${conn.switch.z})`;
    form.button(`#${index + 1}: ${label}`);
  });
  form.button("Disconnect All");
  form.show(player).then(response => {
    if (response.selection === connectionsList.length) {
      disconnectConnections(player, connectionsList);
    } else if (response.selection !== undefined && response.selection < connectionsList.length) {
      const selectedConnection = connectionsList[response.selection];
      showDisconnectSubmenu(player, selectedConnection);
    }
  });
}

function showGeneratorConnectionsMenu(player, generatorData, lightConns, doorButtonLinks) {
  const form = new ActionFormData()
    .title("Generator Connections")
    .body("Manage all devices linked to this generator:");

  const menuItems = [];

  lightConns.forEach(conn => {
    menuItems.push({
      type: "light",
      data: conn,
      label: `Light at (${conn.light.x}, ${conn.light.y}, ${conn.light.z})`
    });
  });

  doorButtonLinks.forEach(link => {
    menuItems.push({
      type: "door_button",
      data: link,
      label: `Door Button at (${link.doorButtonPos.x}, ${link.doorButtonPos.y}, ${link.doorButtonPos.z})`
    });
  });

  menuItems.forEach(item => {
    form.button(item.label);
  });

  form.button("Disconnect All");
  form.button("Back");

  form.show(player).then(response => {
    if (response.selection === undefined) return;

    if (response.selection === menuItems.length) {
      if (lightConns.length > 0) disconnectConnections(player, lightConns);
      doorButtonLinks.forEach(link => removeDoorButtonGeneratorLink(link.doorButtonPos));
      player.sendMessage(dynamicToast("§l§qSUCCESS", "§qAll connections removed", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
      return;
    }

    if (response.selection === menuItems.length + 1) {
      showGeneratorMenu(player, generatorData);
      return;
    }

    const selectedItem = menuItems[response.selection];
    if (selectedItem.type === "light") {
      showDisconnectSubmenu(player, selectedItem.data);
    } else {
      const link = selectedItem.data;
      const confirmForm = new ActionFormData()
        .title("Disconnect Door Button")
        .body(`Are you sure you want to disconnect the Door Button at (${link.doorButtonPos.x}, ${link.doorButtonPos.y}, ${link.doorButtonPos.z})?`)
        .button("Disconnect")
        .button("Back");

      confirmForm.show(player).then(confirmResponse => {
        if (confirmResponse.selection === 0) {
          if (removeDoorButtonGeneratorLink(link.doorButtonPos)) {
            player.sendMessage(dynamicToast("§l§qSUCCESS", "§qDoor button disconnected", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
          }
        }
      });
    }
  });
}

function showAdjustTimeForm(player, generatorData) {
  const form = new ModalFormData()
    .title("Adjust Drain Rate")
    .slider("Consumption Speed (lower = lasts longer)", 0.1, 1, 0.05, generatorData.consumptionRate || DEFAULT_CONSUMPTION_RATE);
  form.show(player).then(response => {
    if (response.formValues && response.formValues.length > 0) {
      let newRate = response.formValues[0];
      generatorData.consumptionRate = newRate;
      updateGenerator(generatorData);
      player.sendMessage(`Drain rate adjusted to +${(newRate * 100).toFixed(0)}%`);
    }
  });
}

function showAdjustRadiusForm(player, generatorData) {
  const radii = [8, 16, 32, 48, 64];
  const effectList = radii.map(r => r.toString());
  const currentRadius = generatorData.radius || 32;
  let defaultIndex = radii.indexOf(currentRadius);
  if (defaultIndex === -1) defaultIndex = 0;

  const form = new ModalFormData()
    .title("Set Power Range")
    .dropdown("Power Range", effectList, { defaultValueIndex: defaultIndex });


  form.show(player).then(response => {
    if (response.formValues && response.formValues.length > 0) {
      let selectedIndex = response.formValues[0];
      let newRadius = radii[selectedIndex];

      if (newRadius < currentRadius) {
        let connections = getConnections();
        let generatorConnections = connections.filter(conn =>
          conn.switch.x === generatorData.pos.x &&
          conn.switch.y === generatorData.pos.y &&
          conn.switch.z === generatorData.pos.z &&
          conn.switch.dimensionId === generatorData.pos.dimensionId
        );
        let toDisconnect = [];
        for (let conn of generatorConnections) {
          let dx = conn.light.x - generatorData.pos.x;
          let dy = conn.light.y - generatorData.pos.y;
          let dz = conn.light.z - generatorData.pos.z;
          let distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (distance > newRadius) {
            toDisconnect.push(conn);
          }
        }
        let desc = "The following lights are switched off:\n";
        if (toDisconnect.length === 0) {
          desc += "Blocks no detected";
        } else {
          toDisconnect.forEach(conn => {
            desc += `- Connection in (${conn.light.x}, ${conn.light.y}, ${conn.light.z})\n`;
          });
        }
        desc += "\nDo you want to continue?";

        let confirmForm = new MessageFormData();
        confirmForm.title("Confirm radius change");
        confirmForm.body(desc);
        confirmForm.button1("No, cancel");
        confirmForm.button2("Yes, disconnect");
        confirmForm.show(player).then(confirmResponse => {
          if (confirmResponse.selection === 1) {
            if (toDisconnect.length > 5) {
              for (let conn of toDisconnect) {
                disconnectSingleConnectionNoMessage(player, conn);
              }
              player.sendMessage(dynamicToast("§l§qSUCCESS", `§q${toDisconnect.length} Connections removed §7`, "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
            } else {
              for (let conn of toDisconnect) {
                disconnectSingleConnection(player, conn);
              }
            }
            generatorData.radius = newRadius;
            updateGenerator(generatorData);
            player.sendMessage(dynamicToast("§l§7INFO", `§7Radius changed to ${newRadius}`, "textures/fr_ui/selection_icon", "textures/fr_ui/default_ui"));
          } else {
            player.sendMessage(dynamicToast("§l§cERROR", "§cRadius change canceled", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
          }
        });
      } else {
        generatorData.radius = newRadius;
        updateGenerator(generatorData);
        player.sendMessage(dynamicToast("§l§7INFO", `§7Radius changed to ${newRadius}`, "textures/fr_ui/selection_icon", "textures/fr_ui/default_ui"));
      }
    }
  });
}
function showGeneratorIndicatorMenu(player, generatorData) {
  const form = new ActionFormData()
    .title("Power Indicator")
    .body("Show or hide the power HUD indicator for this generator")
    .button("Show HUD")
    .button("Hide HUD")
    .button("Back");


  form.show(player).then(response => {
    if (response.selection === undefined) return;
    switch (response.selection) {
      case 0:
        {
          const blockPos = generatorData.pos;
          if (selections[player.id]) {
            const oldPos = selections[player.id].pos;
            const oldDim = world.getDimension(oldPos.dimensionId);
            oldDim.runCommand(`execute at @e[type=fr:selection] positioned ${oldPos.x} ${oldPos.y} ${oldPos.z} run event entity @e[r=1] destroy`);
          }
          selections[player.id] = { pos: blockPos, category: "generator" };
          setSelection(player.id, SelectionType.GENERATOR, { pos: blockPos, category: "generator" });
          const dimension = world.getDimension(blockPos.dimensionId);
          dimension.runCommand(`execute positioned ${blockPos.x} ${blockPos.y} ${blockPos.z} run summon fr:selection ~ ~ ~ 0 0`);
          updateGeneratorTitle(player, generatorData);

        }
        break;
      case 1:
        {
          const dimension = world.getDimension(generatorData.pos.dimensionId);
          dimension.runCommand(`title "${player.name}" title §e§n§e§r§g§y§p`);
          dimension.runCommand(`title "${player.name}" title §e§n§e§n§e§r§g§y§p§y§l§o§w`);
          if (selections[player.id]) {
            const oldPos = selections[player.id].pos;
            const oldDim = world.getDimension(oldPos.dimensionId);
            oldDim.runCommand(`execute at @e[type=fr:selection] positioned ${oldPos.x} ${oldPos.y} ${oldPos.z} run event entity @e[r=1] destroy`);
            delete selections[player.id];
          }
          clearSelection(player.id);

        }
        break;
      case 2:
        showGeneratorMenu(player, generatorData);
        break;
    }
  });
}

function showGeneratorMenu(player, generatorData) {
  const consumoPorcentaje = (generatorData.consumptionRate || DEFAULT_CONSUMPTION_RATE) * 100;
  const currentRadius = generatorData.radius || 32;
  const dimension = world.getDimension(generatorData.pos.dimensionId);
  const activeConsumers = getActiveGeneratorConsumers(generatorData, dimension);

  let usageBar = "";
  if (activeConsumers >= 1) usageBar += "";
  if (activeConsumers >= 2) usageBar += "";
  if (activeConsumers >= 3) usageBar += "";
  if (activeConsumers >= 4) usageBar += "";
  if (usageBar === "") usageBar = "";

  const infiniteStatus = generatorData.infiniteEnergy ? "§a[ON]" : "§c[OFF]";
  const powerDisplay = generatorData.infiniteEnergy ? "§aINFINITE" : generatorData.energy;

  const connections = getConnections();
  const lightConnsCount = connections.filter(conn => {
    return (
      conn.switch.x === generatorData.pos.x &&
      conn.switch.y === generatorData.pos.y &&
      conn.switch.z === generatorData.pos.z &&
      conn.switch.dimensionId === generatorData.pos.dimensionId
    );
  }).length;
  const linkedDoorButtonsCount = getGeneratorLinkedDoorButtons(generatorData.pos).length;
  const totalConnections = lightConnsCount + linkedDoorButtonsCount;
  const limit = getGeneratorLimit();

  const form = new ActionFormData()
    .title("Generator")
    .body(`Available Power: ${powerDisplay}\nDrain Rate: +${consumoPorcentaje.toFixed(0)}%\nPower Range: ${currentRadius}\nCurrent Usage: ${usageBar}\nInfinite Energy: ${infiniteStatus}\nConnections: ${totalConnections}/${limit}\n\nSelect an option:`)
    .button("Refill Fuel")

    .button("Set Range");


  if (generatorData.active) {
    form.button("Turn off");
  } else {
    form.button("Turn on");
  }

  form.button("HUD Display")
    .button("Current Connections")
    .button(generatorData.infiniteEnergy ? "§cDisable Infinite Energy" : "§qEnable Infinite Energy")
    .button("Cancel");


  form.show(player).then(response => {
    if (response.selection === undefined) return;
    switch (response.selection) {
      case 0:
        generatorData.energy = MAX_ENERGY;
        generatorData.accumulator = 0;
        generatorData.active = true;
        updateGenerator(generatorData);
        player.sendMessage(dynamicToast("§l§cINFO", `§cThe generator has been refilled`, "textures/fr_ui/warning_icon", "textures/fr_ui/warning_ui"));

        break;
      case 1:
        showAdjustRadiusForm(player, generatorData);
        break;
      case 2:
        generatorData.active = !generatorData.active;
        if (!generatorData.active) {
          disableGeneratorConnections(generatorData.pos, generatorData.pos.dimensionId);
        }
        player.sendMessage(generatorData.active ? "Generator [ON]" : "Generator [OFF]");
        updateGenerator(generatorData);
        break;
      case 3:
        showGeneratorIndicatorMenu(player, generatorData);
        break;
      case 4:
        {
          const connections = getConnections();
          const lightConns = connections.filter(conn => {
            return (
              conn.switch.x === generatorData.pos.x &&
              conn.switch.y === generatorData.pos.y &&
              conn.switch.z === generatorData.pos.z &&
              conn.switch.dimensionId === generatorData.pos.dimensionId
            );
          });

          const linkedDoorButtons = getGeneratorLinkedDoorButtons(generatorData.pos);

          if (lightConns.length === 0 && linkedDoorButtons.length === 0) {
            player.sendMessage(dynamicToast("§l§6INFO", "§6No connections found", "textures/fr_ui/unlinked_icon", "textures/fr_ui/unlinked_ui"));
          } else {
            showGeneratorConnectionsMenu(player, generatorData, lightConns, linkedDoorButtons);
          }
        }
        break;
      case 5:
        generatorData.infiniteEnergy = !generatorData.infiniteEnergy;
        if (generatorData.infiniteEnergy) {
          generatorData.energy = MAX_ENERGY;
          generatorData.active = true;
          player.sendMessage(dynamicToast("§l§aINFINITE", "§aInfinite energy enabled", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
        } else {
          player.sendMessage(dynamicToast("§l§cINFINITE", "§cInfinite energy disabled", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
        }
        updateGenerator(generatorData);
        break;

      default:
        break;
    }
  });
}
function showTestLightMenu(player, blockPos) {
  const connections = getConnections();
  const connection = connections.find(conn =>
    conn.light.x === blockPos.x &&
    conn.light.y === blockPos.y &&
    conn.light.z === blockPos.z &&
    conn.light.dimensionId === blockPos.dimensionId
  );
  if (!connection) {
    player.sendMessage(dynamicToast("§l§6INFO", "§6This block is not linked", "textures/fr_ui/unlinked_icon", "textures/fr_ui/unlinked_ui"));
    return;
  }
  const form = new ActionFormData()
    .title("Block settings")
    .body("Choose one!");
  form.button("Disconnect");
  form.button("Show connection line");
  form.button("TP to block");
  form.button("Back");
  form.show(player).then(response => {
    if (response.selection === 0) {
      disconnectSingleConnection(player, connection);
    } else if (response.selection === 1) {
      showParticleLine(player, connection);
    } else if (response.selection === 2) {
      const targetPos = connection.switch;
      const dimension = world.getDimension(targetPos.dimensionId);
      dimension.runCommand(`camera "${player.name}" fade time 1 3 1 color 0 0 0`);
      player.sendMessage(dynamicToast("§l§sAction", "§sYou are being teleported...", "textures/fr_ui/tp_player_icon", "textures/fr_ui/tp_player_ui"));
      system.runTimeout(() => {
        player.sendMessage(dynamicToast("§l§sAction", "§sYou have been teleported to the block", "textures/fr_ui/tp_player_icon", "textures/fr_ui/tp_player_ui"));
        dimension.runCommand(`tp "${player.name}" ${targetPos.x + 0.5} ${targetPos.y + 1} ${targetPos.z + 0.5}`);
      }, 70);
    }
  });
}
function showParticleLine(player, connection) {
  const points = getLinePoints(connection.switch, connection.light, 30);
  const dimension = world.getDimension(connection.light.dimensionId);
  player.sendMessage(dynamicToast("§l§7Action", "§7Showing connection points for 3s", "textures/fr_ui/path_icon", "textures/fr_ui/default_ui"));
  for (const point of points) {
    dimension.spawnParticle("fr:raytest", {
      x: point.x,
      y: point.y,
      z: point.z,
    });
  }
}
function showGlobalMenu(player) {
  const form = new ActionFormData()
    .title("Global Functions")
    .body("Select a global action:")
    .button("Disconnect all connections")
    .button("Increase power drain rate for all generators")
    .button("Remove all generators")
    .button("Cancel");
  form.show(player).then(response => {
    switch (response.selection) {
      case 0:
        {
          const connections = getConnections();
          connections.forEach(conn => {
            turnOffLight(conn, LIGHT_TYPES);
          });
          setConnections([]);
          player.sendMessage("All connections have been disconnected.");
        }
        break;
      case 1:
        {
          let generators = getGenerators();
          generators.forEach(gen => {
            gen.consumptionRate = (gen.consumptionRate || DEFAULT_CONSUMPTION_RATE) * 1.2;
          });
          setGenerators(generators);
          player.sendMessage("The power drain rate for all generators has been increased.");
        }
        break;
      case 2:
        {
          let generators = getGenerators();
          const overworld = world.getDimension("overworld");
          generators.forEach(gen => {
            overworld.runCommand(`setblock ${gen.pos.x} ${gen.pos.y} ${gen.pos.z} minecraft:air`);
          });
          let connections = getConnections();
          connections = connections.filter(conn => {
            return !generators.some(gen =>
              gen.pos.x === conn.switch.x &&
              gen.pos.y === conn.switch.y &&
              gen.pos.z === conn.switch.z &&
              gen.pos.dimensionId === conn.switch.dimensionId
            );
          });
          setConnections(connections);
          setGenerators([]);
          player.sendMessage("All generators have been removed.");
        }
        break;
      default:
        break;
    }
  });
}


world.afterEvents.playerInteractWithBlock.subscribe(event => {
  const player = event.player;
  const block = event.block;
  const blockPos = {
    dimensionId: block.dimension.id,
    x: block.location.x,
    y: block.location.y,
    z: block.location.z,
  };
  const item = event.itemStack;

  if (item && (item.typeId === "fr:faz-diver_security")) {
    const category = (function getBlockCategory(block) {
      if (isLightType(block.typeId)) return "light";
      if (isSwitchType(block.typeId)) return "switch";
      if (GENERATOR_TYPES.has(block.typeId)) return "generator";
      return null;
    })(block);
    if (category === "switch" || category === "generator") {
      if (selections[player.id]) {
        const oldPos = selections[player.id].pos;
        const oldDim = world.getDimension(oldPos.dimensionId);
        oldDim.runCommand(`execute at @e[type=fr:selection] positioned ${oldPos.x} ${oldPos.y} ${oldPos.z} run event entity @e[r=1] destroy`);
      }
      selections[player.id] = { pos: blockPos, category: category };


      const selectionType = category === "switch" ? SelectionType.SWITCH : SelectionType.GENERATOR;
      setSelection(player.id, selectionType, { pos: blockPos, category: category });

      if (category === "generator") {
        let generators = getGenerators();
        let gen = generators.find(g =>
          g.pos.x === blockPos.x &&
          g.pos.y === blockPos.y &&
          g.pos.z === blockPos.z &&
          g.pos.dimensionId === blockPos.dimensionId
        );
        if (!gen) {
          gen = {
            id: generators.length + 1,
            pos: blockPos,
            energy: MAX_ENERGY,
            accumulator: 0,
            consumptionRate: DEFAULT_CONSUMPTION_RATE,
            active: true,
            radius: 32
          };
          generators.push(gen);
          setGenerators(generators);
          player.sendMessage("Generator activated.");
        }

      }
      const dimension = world.getDimension(blockPos.dimensionId);
      dimension.runCommand(`execute positioned ${blockPos.x} ${blockPos.y} ${blockPos.z} run summon fr:selection ~ ~ ~ 0 0`);
      let iconToUse = "textures/fr_ui/selection_icon";
      let messageText = "§9Block selected";
      if (isSwitchType(block.typeId)) {
        iconToUse = getBlockIcon(block.typeId);
        messageText = `§9The ${getBlockAlias(block.typeId)} block has been selected`;
      } else if (GENERATOR_TYPES.has(block.typeId)) {
        iconToUse = GENERATOR_ICONS[block.typeId] || "textures/fr_ui/placeholder_icon";
        messageText = `§9The ${GENERATOR_ALIASES[block.typeId] || "Generator"} block has been selected`;
      }
      player.sendMessage(dynamicToast("§l§9INFO", messageText, iconToUse, "textures/fr_ui/selection_ui"));

      sendDebug(player, `Source selected: ${category} at (${blockPos.x}, ${blockPos.y}, ${blockPos.z}) in ${blockPos.dimensionId}`);
      if (category === "generator") {
        const gen = getGeneratorAt(blockPos);
        if (gen) {
          sendDebug(player, `Generator data: energy=${gen.energy}, active=${gen.active}, radius=${gen.radius || 32}`);
        }
      }
      return;
    }
    if (category === "light") {

      const currentSelection = getSelection(player.id);
      if (currentSelection && (currentSelection.type === SelectionType.DOOR_BUTTON_LIGHT || currentSelection.type === SelectionType.DOOR_BUTTON_DOOR)) {

        if (selections[player.id]) {
          const oldPos = selections[player.id].pos;
          const oldDim = world.getDimension(oldPos.dimensionId);
          oldDim.runCommand(`execute at @e[type=fr:selection] positioned ${oldPos.x} ${oldPos.y} ${oldPos.z} run event entity @e[r=1] destroy`);
          delete selections[player.id];
        }

        return;
      }

      if (selections[player.id] && (selections[player.id].category === "switch" || selections[player.id].category === "generator")) {
        const source = selections[player.id].pos;
        const dx = blockPos.x - source.x;
        const dy = blockPos.y - source.y;
        const dz = blockPos.z - source.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const dimension = world.getDimension(source.dimensionId);
        const sourceBlock = dimension.getBlock({ x: source.x, y: source.y, z: source.z });
        let allowedRadius = 64;
        if (sourceBlock) {
          if (isSwitchType(sourceBlock.typeId)) {
          } else if (GENERATOR_TYPES.has(sourceBlock.typeId)) {
            const generatorData = getGeneratorAt(source);
            allowedRadius = generatorData ? (generatorData.radius || 32) : 32;
          }
        }
        if (blockPos.dimensionId !== source.dimensionId) {
          player.sendMessage(dynamicToast("§l§cERROR", "§cSource and Light must be in the same dimension", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
          return;
        }

        if (distance > allowedRadius) {
          player.sendMessage(dynamicToast("§l§cERROR", `§cBlock outside ${allowedRadius} block radius (Dist: ${distance.toFixed(1)})`, "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
          return;
        }

        if (isLightConnectedToDoorButton(blockPos, blockPos.dimensionId)) {
          player.sendMessage(dynamicToast("§l§cERROR", "§cThis light is already connected to a door button", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
          return;
        }

        const isGenerator = selections[player.id].category === "generator";
        const limit = isGenerator ? getGeneratorLimit() : getSwitchLimit();
        let connections = getConnections();

        let currentCount = 0;
        let lightConnsCount = 0;
        let doorButtonLinksCount = 0;

        if (isGenerator) {
          lightConnsCount = connections.filter(conn =>
            conn.switch.x === source.x &&
            conn.switch.y === source.y &&
            conn.switch.z === source.z &&
            conn.switch.dimensionId === source.dimensionId
          ).length;
          doorButtonLinksCount = getGeneratorLinkedDoorButtons(source).length;
          currentCount = lightConnsCount + doorButtonLinksCount;
        } else {
          currentCount = connections.filter(conn =>
            conn.switch.x === source.x &&
            conn.switch.y === source.y &&
            conn.switch.z === source.z &&
            conn.switch.dimensionId === source.dimensionId
          ).length;
        }

        if (currentCount >= limit) {
          player.sendMessage(dynamicToast("§l§cLIMIT REACHED", `§cMaximum connections reached for this ${isGenerator ? 'Generator' : 'Switch'} (${currentCount}/${limit})`, "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
          return;
        }

        connections.push({ switch: source, light: blockPos });
        setConnections(connections);

        sendDebug(player, `Attempting connection: ${source.x},${source.y},${source.z} -> ${blockPos.x},${blockPos.y},${blockPos.z}`);
        sendDebug(player, `Current counts: Lights=${lightConnsCount}, DoorButtons=${doorButtonLinksCount}, Total=${currentCount}/${limit}`);

        const verifyConns = getConnections();
        const isSaved = verifyConns.some(c =>
          c.light.x === blockPos.x && c.light.y === blockPos.y && c.light.z === blockPos.z &&
          c.switch.x === source.x && c.switch.y === source.y && c.switch.z === source.z
        );

        if (!isSaved) {
          player.sendMessage(dynamicToast("§l§cSTORAGE ERROR", "§cFailed to save connection to world. Limit reached?", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
          return;
        }

        sendDebug(player, "Connection successfully verified in chunked storage.");
        let isActive = false;
        const switchBlock = world.getDimension(source.dimensionId).getBlock({ x: source.x, y: source.y, z: source.z });
        if (switchBlock) {
          if (isSwitchType(switchBlock.typeId)) {
            isActive = switchBlock.permutation.getState("fr:switch_type") === true;
          } else if (GENERATOR_TYPES.has(switchBlock.typeId)) {
            const gen = getGeneratorAt(source);
            if (gen && gen.active && gen.energy > 0) {
              isActive = true;
            }
          }
        }
        const dimensionLight = world.getDimension(blockPos.dimensionId);
        const lightBlock = dimensionLight.getBlock(blockPos);
        if (lightBlock && isLightType(lightBlock.typeId)) {
          try {
            const newPerm = lightBlock.permutation.withState("fr:lit", isActive);
            lightBlock.setPermutation(newPerm);
          } catch { }
        }
        if (isActive) {
          player.sendMessage(dynamicToast("§l§qSUCCESS", "§qConnection established (On)", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
        } else {
          player.sendMessage(dynamicToast("§l§qSUCCESS", "§qConnection established (Off)", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
        }
      } else {
        player.sendMessage(dynamicToast("§l§9INFO", "§9Select a Switch or Generator first", "textures/fr_ui/selection_icon", "textures/fr_ui/selection_ui"));
      }
    }
  }

  if (item && item.typeId === "minecraft:lk") {
    showGlobalMenu(player);
    return;
  }
  if (isLightType(block.typeId)) {
    if (item && (item.typeId === "fr:faz-diver_security")) return;
    showTestLightMenu(player, blockPos);
    return;
  }
  if (GENERATOR_TYPES.has(block.typeId)) {
    let generators = getGenerators();
    let gen = generators.find(g =>
      g.pos.x === blockPos.x &&
      g.pos.y === blockPos.y &&
      g.pos.z === blockPos.z &&
      g.pos.dimensionId === blockPos.dimensionId
    );
    if (gen) {
      showGeneratorMenu(player, gen);
    } else {
      gen = {
        id: generators.length + 1,
        pos: blockPos,
        energy: MAX_ENERGY,
        accumulator: 0,
        consumptionRate: DEFAULT_CONSUMPTION_RATE,
        active: true,
        radius: 32
      };
      generators.push(gen);
      setGenerators(generators);
      player.sendMessage("Generator enabled");
    }
    return;
  }
});

world.afterEvents.playerBreakBlock.subscribe(event => {
  const { block, brokenBlockPermutation, player } = event;
  const blockPos = {
    dimensionId: block.dimension.id,
    x: block.location.x,
    y: block.location.y,
    z: block.location.z,
  };
  const blockType = brokenBlockPermutation.type.id;

  if (isLightType(blockType)) {
    let connections = getConnections();
    const lightConnections = connections.filter(conn =>
      conn.light.x === blockPos.x &&
      conn.light.y === blockPos.y &&
      conn.light.z === blockPos.z &&
      conn.light.dimensionId === blockPos.dimensionId
    );

    if (lightConnections.length > 0) {
      const key = `${blockPos.dimensionId}_${blockPos.x}_${blockPos.y}_${blockPos.z}`;
      if (lampVfxEntities[key]) {
        const dimension = world.getDimension(blockPos.dimensionId);
        const location = { x: blockPos.x + 0.5, y: blockPos.y + 0.5, z: blockPos.z + 0.5 };

        if (lampVfxEntities[key].isStageSpotlight) {
          dimension.runCommand(`execute at @e[type=fr:stage_spotlight_vfx] positioned ${location.x} ${location.y} ${location.z} run event entity @e[r=0.5] destroy`);
        } else {
          dimension.runCommand(`execute at @e[type=fr:office_lamp_vfx] positioned ${location.x} ${location.y} ${location.z} run event entity @e[r=0.5] destroy`);
        }
        delete lampVfxEntities[key];
      }

      connections = connections.filter(conn =>
        !(conn.light.x === blockPos.x &&
          conn.light.y === blockPos.y &&
          conn.light.z === blockPos.z &&
          conn.light.dimensionId === blockPos.dimensionId)
      );
      setConnections(connections);
    }
  }

  if (isSwitchType(blockType)) {
    let connections = getConnections();
    const switchConnections = connections.filter(conn =>
      conn.switch.x === blockPos.x &&
      conn.switch.y === blockPos.y &&
      conn.switch.z === blockPos.z &&
      conn.switch.dimensionId === blockPos.dimensionId
    );

    if (switchConnections.length > 0) {
      switchConnections.forEach(conn => turnOffLight(conn, LIGHT_TYPES));

      connections = connections.filter(conn =>
        !(conn.switch.x === blockPos.x &&
          conn.switch.y === blockPos.y &&
          conn.switch.z === blockPos.z &&
          conn.switch.dimensionId === blockPos.dimensionId)
      );
      setConnections(connections);
    }

    if (selections[player.id]) {
      const selPos = selections[player.id].pos;
      if (selPos.x === blockPos.x && selPos.y === blockPos.y && selPos.z === blockPos.z && selPos.dimensionId === blockPos.dimensionId) {
        delete selections[player.id];
        clearSelection(player.id);
      }
    }
  }

  if (GENERATOR_TYPES.has(blockType)) {
    let connections = getConnections();
    const generatorConnections = connections.filter(conn =>
      conn.switch.x === blockPos.x &&
      conn.switch.y === blockPos.y &&
      conn.switch.z === blockPos.z &&
      conn.switch.dimensionId === blockPos.dimensionId
    );

    if (generatorConnections.length > 0) {
      generatorConnections.forEach(conn => turnOffLight(conn, LIGHT_TYPES));

      connections = connections.filter(conn =>
        !(conn.switch.x === blockPos.x &&
          conn.switch.y === blockPos.y &&
          conn.switch.z === blockPos.z &&
          conn.switch.dimensionId === blockPos.dimensionId)
      );
      setConnections(connections);
    }

    const linkedDoorButtons = getGeneratorLinkedDoorButtons(blockPos);
    if (linkedDoorButtons.length > 0) {
      linkedDoorButtons.forEach(link => {
        removeDoorButtonGeneratorLink(link.doorButtonPos);
      });
      if (player) {
        player.sendMessage(dynamicToast("§l§7INFO", `§7${linkedDoorButtons.length} door button(s) disconnected`, "textures/fr_ui/selection_icon", "textures/fr_ui/default_ui"));
      }
    }

    let generators = getGenerators();
    generators = generators.filter(gen =>
      !(gen.pos.x === blockPos.x &&
        gen.pos.y === blockPos.y &&
        gen.pos.z === blockPos.z &&
        gen.pos.dimensionId === blockPos.dimensionId)
    );
    setGenerators(generators);

    if (selections[player.id]) {
      const selPos = selections[player.id].pos;
      if (selPos.x === blockPos.x && selPos.y === blockPos.y && selPos.z === blockPos.z && selPos.dimensionId === blockPos.dimensionId) {
        delete selections[player.id];
        clearSelection(player.id);
      }
    }
  }
});

system.runInterval(() => {
  cleanupOrphanedConnections();
  cleanupOrphanedGenerators();
}, 600);

system.runInterval(() => {
  const connections = getConnections();
  if (connections.length === 0) return;
  for (const conn of connections) {
    try {
      const switchBlock = world.getDimension(conn.switch.dimensionId).getBlock({
        x: conn.switch.x,
        y: conn.switch.y,
        z: conn.switch.z,
      });
      const lightBlock = world.getDimension(conn.light.dimensionId).getBlock({
        x: conn.light.x,
        y: conn.light.y,
        z: conn.light.z,
      });
      if (switchBlock && lightBlock && isLightType(lightBlock.typeId)) {
        let isActive = false;
        if (isSwitchType(switchBlock.typeId)) {
          isActive = switchBlock.permutation.getState("fr:switch_type") === true;
        } else if (GENERATOR_TYPES.has(switchBlock.typeId)) {
          const gen = getGeneratorAt(conn.switch);
          if (gen && gen.active && gen.energy > 0) {
            isActive = true;
          }
        }
        let currentLightState = false;
        try {
          currentLightState = lightBlock.permutation.getState("fr:lit") === true;
        } catch { }
        if (isActive && !currentLightState) {
          try {
            const newPerm = lightBlock.permutation.withState("fr:lit", true);
            lightBlock.setPermutation(newPerm);
          } catch { }
        } else if (!isActive && currentLightState) {
          try {
            const newPerm = lightBlock.permutation.withState("fr:lit", false);
            lightBlock.setPermutation(newPerm);
          } catch { }
        }
        const key = `${conn.light.dimensionId}_${conn.light.x}_${conn.light.y}_${conn.light.z}`;
        if (isActive) {
          if (!lampVfxEntities[key]) {
            const dimension = world.getDimension(conn.light.dimensionId);
            const location = { x: conn.light.x + 0.5, y: conn.light.y + 0, z: conn.light.z + 0.5 };
            const vfxEntityType = getVfxEntityForLight(lightBlock.typeId);

            // Verificar si ya existe CUALQUIER entidad VFX en esta posición
            const existingVfx = findAnyVfxEntityAtLocation(dimension, location);
            if (existingVfx) {
              lampVfxEntities[key] = { vfxType: existingVfx.vfxType, entity: existingVfx.entity };
            } else if (lightBlock.typeId === "fr:stage_spotlight") {
              const blockFace = lightBlock.permutation.getState("minecraft:block_face") || "down";
              let angle;
              if (blockFace === "down") {
                const angles = [180, 200, 225, 250, 270, 290, 315, 335, 0, 25, 45, 70, 90, 115, 135, 160];
                const rotationState = lightBlock.permutation.getState("fr:rotation") || 0;
                angle = angles[rotationState];
              } else {
                const faceAngles = { north: 180, east: 270, south: 0, west: 90 };
                angle = faceAngles[blockFace] ?? 0;
              }
              dimension.runCommand(`summon ${vfxEntityType} ${location.x} ${location.y} ${location.z} ${angle} 0`);
              const blockColor = lightBlock.permutation.getState("fr:color") ?? 4;
              const spawnedEntities = dimension.getEntities({ type: vfxEntityType, location: location, maxDistance: 0.5 });
              for (const entity of spawnedEntities) {
                const colorComponent = entity.getComponent("minecraft:color");
                if (colorComponent) colorComponent.value = blockColor;
              }
              lampVfxEntities[key] = { vfxType: vfxEntityType };
            } else if (lightBlock.typeId === "fr:ceiling_light") {
              const cardinal = lightBlock.permutation.getState("minecraft:cardinal_direction") || "north";
              const isNorthSouth = cardinal === "north" || cardinal === "south";
              const rotation = isNorthSouth ? 0 : 90;
              const entity = dimension.spawnEntity(vfxEntityType, location);
              entity.setRotation({ x: 0, y: rotation });
              lampVfxEntities[key] = { vfxType: vfxEntityType, entity };
            } else if (lightBlock.typeId === "fr:pirate_cove_light") {
              const cardinal = lightBlock.permutation.getState("minecraft:cardinal_direction") || "south";
              let offsetX = 0, offsetZ = 0, yRot = 0;
              switch (cardinal) {
                case 'north': offsetZ = -0.3; yRot = 180; break;
                case 'south': offsetZ = 0.3; yRot = 0; break;
                case 'east': offsetX = 0.3; yRot = 90; break;
                case 'west': offsetX = -0.3; yRot = -90; break;
              }
              const spawnPos = { x: conn.light.x + 0.5 + offsetX, y: conn.light.y + 0.4, z: conn.light.z + 0.5 + offsetZ };
              const entity = dimension.spawnEntity(vfxEntityType, spawnPos);
              if (entity) entity.setRotation({ x: 0, y: yRot });
              lampVfxEntities[key] = { vfxType: vfxEntityType, entity };
            } else {
              const entity = dimension.spawnEntity(vfxEntityType, location);
              lampVfxEntities[key] = { vfxType: vfxEntityType, entity };
            }
          }
        } else {
          if (lampVfxEntities[key]) {
            const dimension = world.getDimension(conn.light.dimensionId);
            const location = { x: conn.light.x + 0.5, y: conn.light.y + 0.5, z: conn.light.z + 0.5 };
            const vfxEntityType = getVfxEntityForLight(lightBlock?.typeId || "fr:office_light");

            if (vfxEntityType === "fr:pirate_cove_light_entity") {
              const pirateLocation = { x: conn.light.x + 0.5, y: conn.light.y + 0.4, z: conn.light.z + 0.5 };
              dimension.runCommand(`execute at @e[type=${vfxEntityType}] positioned ${pirateLocation.x} ${pirateLocation.y} ${pirateLocation.z} run event entity @e[r=1.5] destroy`);
            } else {
              dimension.runCommand(`execute at @e[type=${vfxEntityType}] positioned ${location.x} ${location.y} ${location.z} run event entity @e[r=0.5] destroy`);
            }
            delete lampVfxEntities[key];
          }
        }
      }
    } catch { }
  }
}, 20);

let particleTick = 0;
system.runInterval(() => {
  const players = world.getPlayers();
  if (players.length === 0) return;
  for (const player of players) {
    const inventory = player.getComponent("minecraft:inventory").container;
    const slot = player.selectedSlot;
    let item = null;
    if (typeof slot === "number" && slot >= 0 && slot < inventory.size) {
      item = inventory.getItem(slot);
    }
    if (item && (item.typeId === "fr:faz-diver_security")) {
      const connections = getConnections();
      for (const conn of connections) {
        if (
          conn.switch.dimensionId === player.dimension.id &&
          conn.light.dimensionId === player.dimension.id
        ) {
          const points = getLinePoints(conn.switch, conn.light, 10);
          const currentIndex = particleTick % points.length;
          const point = points[currentIndex];
        }
      }
    }
  }
  particleTick++;
}, 20);

const BASE_CONSUMPTION = 0.5;

system.runInterval(() => {
  let generators = getGenerators();
  if (generators.length === 0) return;

  generators.forEach(gen => {
    if (gen.active && gen.energy > 0) {
      const dim = world.getDimension(gen.pos.dimensionId);

      const activeConsumers = getActiveGeneratorConsumers(gen, dim);

      const hadEnergy = gen.energy > 0;

      if (gen.infiniteEnergy) {
        gen.energy = MAX_ENERGY;
        return;
      }

      gen.accumulator += (activeConsumers + BASE_CONSUMPTION) * (gen.consumptionRate || DEFAULT_CONSUMPTION_RATE) * CONSUMPTION_MULTIPLIER;

      while (gen.accumulator >= 1 && gen.energy > 0) {
        gen.energy--;
        gen.accumulator -= 1;
      }
      if (gen.energy < 0) gen.energy = 0;

      if (hadEnergy && gen.energy === 0) {
        disableGeneratorConnections(gen.pos, gen.pos.dimensionId);
      }

      const block = dim.getBlock(gen.pos);
      if (block && GENERATOR_TYPES.has(block.typeId)) {
        try {
          const newPerm = block.permutation.withState("fr:energy_level", gen.energy);
          block.setPermutation(newPerm);
        } catch { }
      }
    }
  });
  setGenerators(generators);
}, 10);



function disableGeneratorConnections(generatorPos, dimensionId) {
  const linkedDoorButtons = getGeneratorLinkedDoorButtons(generatorPos);
  const doorButtonConnections = getDoorButtonConnections();

  for (const link of linkedDoorButtons) {
    try {
      const dim = world.getDimension(link.doorButtonPos.dimensionId);
      const doorButtonBlock = dim.getBlock({
        x: link.doorButtonPos.x,
        y: link.doorButtonPos.y,
        z: link.doorButtonPos.z,
      });

      if (doorButtonBlock && doorButtonBlock.typeId === "fr:door_buttons") {
        let permutation = doorButtonBlock.permutation;
        let modified = false;

        const currentLightState = permutation.getState("fr:bottom");
        if (currentLightState === true) {
          permutation = permutation.withState("fr:bottom", false);
          modified = true;

          const doorButtonLightConns = doorButtonConnections.filter(conn =>
            conn.doorBlock.x === link.doorButtonPos.x &&
            conn.doorBlock.y === link.doorButtonPos.y &&
            conn.doorBlock.z === link.doorButtonPos.z &&
            conn.doorBlock.dimensionId === link.doorButtonPos.dimensionId
          );

          for (const conn of doorButtonLightConns) {
            const lightData = conn.lightBlock || conn.officeLightBlock;
            if (lightData) {
              const lightBlock = dim.getBlock({
                x: lightData.x,
                y: lightData.y,
                z: lightData.z,
              });
              if (lightBlock && lightBlock.typeId !== "minecraft:air") {
                try {
                  const newPerm = lightBlock.permutation.withState("fr:lit", false);
                  lightBlock.setPermutation(newPerm);
                  turnOffLight({ light: lightData }, LIGHT_TYPES);
                } catch { }
              } else if (lightData) {
                turnOffLight({ light: lightData }, LIGHT_TYPES);
              }
            }
          }
        }

        const currentDoorState = permutation.getState("fr:upper");
        if (currentDoorState === false) {
          permutation = permutation.withState("fr:upper", true);
          modified = true;

          openConnectedDoors(link.doorButtonPos, dim);
        }

        if (modified) {
          doorButtonBlock.setPermutation(permutation);
        }
      }
    } catch { }
  }
}

export function getActiveGeneratorConsumers(generatorData, dimension) {
  let activeConsumers = 0;

  const allConnections = getConnections();
  for (const conn of allConnections) {
    if (
      conn.switch.x === generatorData.pos.x &&
      conn.switch.y === generatorData.pos.y &&
      conn.switch.z === generatorData.pos.z &&
      conn.switch.dimensionId === generatorData.pos.dimensionId
    ) {
      const lightBlock = dimension.getBlock(conn.light);
      if (lightBlock && isLightType(lightBlock.typeId)) {
        try {
          if (lightBlock.permutation.getState("fr:lit") === true) {
            activeConsumers++;
          }
        } catch { }
      }
    }
  }

  const linkedDoorButtons = getGeneratorLinkedDoorButtons(generatorData.pos);
  for (const link of linkedDoorButtons) {
    try {
      const doorButtonBlock = dimension.getBlock(link.doorButtonPos);
      if (doorButtonBlock && doorButtonBlock.typeId === "fr:door_buttons") {
        const perm = doorButtonBlock.permutation;
        if (perm.getState("fr:bottom") === true) activeConsumers++;
        if (perm.getState("fr:upper") === false) activeConsumers++;
      }
    } catch { }
  }

  return activeConsumers;
}

const playerHudContent = new Map();

function getHudContent(playerId) {
  if (!playerHudContent.has(playerId)) {
    playerHudContent.set(playerId, { generator: "", clock: "" });
  }
  return playerHudContent.get(playerId);
}

function flushHud(player) {
  const content = getHudContent(player.id);
  const generatorText = content.generator || "";
  const clockText = content.clock || "";
  const hasGen = generatorText !== "";
  const hasClock = clockText !== "";

  if (hasGen && hasClock) {
    const now = system.currentTick;
    const phase = Math.floor(now / 60) % 2;

    if (phase === 0) {
      player.runCommand(`title "${player.name}" title ${generatorText}`);
    } else {
      player.runCommand(`title "${player.name}" title ${clockText}`);
    }
  } else if (hasGen) {
    player.runCommand(`title "${player.name}" title ${generatorText}`);
  } else if (hasClock) {
    player.runCommand(`title "${player.name}" title ${clockText}`);
  }
}

function updateGeneratorTitle(player, generatorData) {
  const energyPercentage = Math.floor((generatorData.energy / MAX_ENERGY) * 100);
  const dimension = world.getDimension(generatorData.pos.dimensionId);

  const isWarning = !generatorData.infiniteEnergy && energyPercentage < 20;
  const activeConsumers = getActiveGeneratorConsumers(generatorData, dimension);

  let usageBar = "";
  if (activeConsumers >= 1) usageBar += "";
  if (activeConsumers >= 2) usageBar += "";
  if (activeConsumers >= 3) usageBar += "";
  if (activeConsumers >= 4) usageBar += "";
  if (usageBar === "") usageBar = "";

  const powerColor = isWarning ? "§c" : "§f";
  const powerDisplay = generatorData.infiniteEnergy ? "§aINF" : `${energyPercentage}%`;

  const hudText = `§e§n§e§r§g§y§p${powerColor}Power left: §l${powerDisplay}§r\nUsage: §r${usageBar}`;
  getHudContent(player.id).generator = hudText;
  flushHud(player);
}

export function showGeneratorHud(player, blockPos) {
  const generatorData = getGeneratorAt(blockPos);
  if (!generatorData) {
    player.sendMessage(dynamicToast("§l§cERROR", "§cNo generator found at position", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
    return;
  }
  if (selections[player.id]) {
    const oldPos = selections[player.id].pos;
    try {
      const oldDim = world.getDimension(oldPos.dimensionId);
      oldDim.runCommand(`execute at @e[type=fr:selection] positioned ${oldPos.x} ${oldPos.y} ${oldPos.z} run event entity @e[r=1] destroy`);
    } catch { }
  }
  selections[player.id] = { pos: blockPos, category: "generator" };
  setSelection(player.id, SelectionType.GENERATOR, { pos: blockPos, category: "generator" });
  const dimension = world.getDimension(blockPos.dimensionId);
  dimension.runCommand(`execute positioned ${blockPos.x} ${blockPos.y} ${blockPos.z} run summon fr:selection ~ ~ ~ 0 0`);

  updateGeneratorTitle(player, generatorData);
}

export function getPlayerGeneratorHud(playerId) {
  if (selections[playerId] && selections[playerId].category === "generator") {
    return selections[playerId].pos;
  }
  return null;
}

export function hideGeneratorHud(player, silent = false) {
  getHudContent(player.id).generator = "";
  const content = getHudContent(player.id);
  const generatorErase = "§e§n§e§r§g§y§p §r";

  let combined = generatorErase;
  if (content.clock) combined += "\n" + content.clock;

  try { player.runCommand(`title @s title ${combined}`); } catch { }

  playerHudState.delete(player.id);
  if (selections[player.id]) {
    const oldPos = selections[player.id].pos;
    try {
      const oldDim = world.getDimension(oldPos.dimensionId);
      oldDim.runCommand(`execute at @e[type=fr:selection] positioned ${oldPos.x} ${oldPos.y} ${oldPos.z} run event entity @e[r=1] destroy`);
    } catch { }
    delete selections[player.id];
  }
  clearSelection(player.id);
}

const playerClockState = new Map();
const playerCustomNight = new Map();

export function setCustomNight(playerId, nightNum) {
  if (nightNum !== undefined && nightNum !== null) {
    playerCustomNight.set(playerId, nightNum);
  } else {
    playerCustomNight.delete(playerId);
  }
}

export function getPlayerClockHud(playerId) {
  if (!playerClockState.has(playerId)) return null;
  return { night: playerCustomNight.get(playerId) };
}

function getWorldTimeFormatted(dimension, playerId) {
  const timeOfDay = world.getTimeOfDay();
  let hours = Math.floor(timeOfDay / 1000) + 6;
  if (hours >= 24) hours -= 24;
  const ampm = hours >= 12 ? "PM" : "AM";
  let displayHours = hours % 12;
  if (displayHours === 0) displayHours = 12;
  const isDay = timeOfDay < 12000;

  let nightNum;
  if (playerCustomNight.has(playerId)) {
    nightNum = playerCustomNight.get(playerId);
  } else {
    nightNum = world.getDay() + 1;
  }

  const dayNight = isDay ? `Day ${nightNum}` : `Night ${nightNum}`;

  return { time: `${displayHours} ${ampm}`, dayNight };
}

function updateClockTitle(player) {
  const { time, dayNight } = getWorldTimeFormatted(player.dimension, player.id);
  const hudText = `§e§n§e§r§g§y§l§o§w§f${time}\n${dayNight}`;
  getHudContent(player.id).clock = hudText;
  flushHud(player);
}

export function showClockHud(player) {
  playerClockState.set(player.id, true);
  updateClockTitle(player);
}

export function hideClockHud(player, silent = false) {
  getHudContent(player.id).clock = "";
  playerClockState.delete(player.id);
  playerCustomNight.delete(player.id);

  const content = getHudContent(player.id);
  const clockErase = "§e§n§e§r§g§y§l§o§w";

  let combined = "";
  if (content.generator) combined += content.generator + "\n";
  combined += clockErase;

  try { player.runCommand(`title @s title ${combined}`); } catch { }
}

system.runInterval(() => {
  for (const player of world.getPlayers()) {
    if (playerClockState.has(player.id) && !isPlayerInCamera(player.id)) {
      updateClockTitle(player);
    }
  }
}, 20);
export function setGeneratorEnergy(x, y, z, dimensionId, percentage) {
  const blockPos = { x, y, z, dimensionId };
  const generators = getGenerators();
  const genIndex = generators.findIndex(gen =>
    gen.pos.x === blockPos.x &&
    gen.pos.y === blockPos.y &&
    gen.pos.z === blockPos.z &&
    gen.pos.dimensionId === blockPos.dimensionId
  );

  if (genIndex === -1) {
    return { success: false, message: 'No generator found at position' };
  }

  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const energy = Math.floor((clampedPercentage / 100) * MAX_ENERGY);

  generators[genIndex].energy = energy;
  generators[genIndex].accumulator = 0;
  setGenerators(generators);

  try {
    const dimension = world.getDimension(dimensionId);
    const block = dimension.getBlock({ x, y, z });
    if (block) {
      const newPerm = block.permutation.withState("fr:energy_level", energy);
      block.setPermutation(newPerm);
    }
  } catch { }

  return { success: true, message: `Generator energy set to ${clampedPercentage}% (${energy}/${MAX_ENERGY})` };
}

let lastTitleUpdate = new Map();
system.runInterval(() => {
  const players = world.getPlayers();
  if (players.length === 0) return;

  for (const player of players) {
    const inCamera = isPlayerInCamera(player.id);

    if (selections[player.id] && selections[player.id].category === "generator" && !inCamera) {
      const generatorData = getGeneratorAt(selections[player.id].pos);
      if (generatorData) {
        updateGeneratorTitle(player, generatorData);
      }
    }
  }
}, 10);


function updateLightTestActionBarForPlayer(player) {
  function isPlayerNearPoint(player, point, maxDistance) {
    const playerPos = player.location;
    const dx = playerPos.x - point.x;
    const dy = playerPos.y - point.y;
    const dz = playerPos.z - point.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return distance <= maxDistance;
  }
  const inventory = player.getComponent("minecraft:inventory").container;
  const slot = player.selectedSlot;
  let item = null;
  if (typeof slot === "number" && slot >= 0 && slot < inventory.size) {
    item = inventory.getItem(slot);
  }
  if (!item || (item.typeId !== "fr:faz-diver_security")) return;
  let message = "";
  const viewDistance = 7.5;
  const blockData = player.getBlockFromViewDirection({ maxDistance: viewDistance });
  const block = blockData?.block;
  if (block && (
    isSwitchType(block.typeId) ||
    GENERATOR_TYPES.has(block.typeId) ||
    isLightType(block.typeId)
  )) {
    if (isLightType(block.typeId)) {
      const blockPos = { x: block.location.x, y: block.location.y, z: block.location.z, dimensionId: player.dimension.id };
      const connections = getConnections();
      const connection = connections.find(conn =>
        conn.light.x === blockPos.x &&
        conn.light.y === blockPos.y &&
        conn.light.z === blockPos.z &&
        conn.light.dimensionId === blockPos.dimensionId
      );
      if (connection) {
        const dx = blockPos.x - connection.switch.x;
        const dy = blockPos.y - connection.switch.y;
        const dz = blockPos.z - connection.switch.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (distance > 64) {
          message = "? §l§6Unlinked a§r";
        } else {
          const switchBlock = world.getDimension(connection.switch.dimensionId).getBlock({
            x: connection.switch.x,
            y: connection.switch.y,
            z: connection.switch.z,
          });
          let switchName = "Manual";
          let isSwitchActive = false;
          if (switchBlock) {
            if (isSwitchType(switchBlock.typeId)) {
              switchName = getBlockAlias(switchBlock.typeId);
              isSwitchActive = switchBlock.permutation.getState("fr:switch_type") === true;
            } else if (GENERATOR_TYPES.has(switchBlock.typeId)) {
              switchName = GENERATOR_ALIASES[switchBlock.typeId] || "Generator";
              const gen = getGeneratorAt(connection.switch);
              isSwitchActive = gen && gen.active && gen.energy > 0;
            }
          }
          const linkedColor = isSwitchActive ? "§q?" : "§c?";
          message = `§l${linkedColor} Linked to ${switchName}§r\n? §7Coords (${connection.switch.x}, ${connection.switch.y}, ${connection.switch.z})`;
          const isLit = block.permutation.getState("fr:lit") === true;
          const stateText = isLit ? "On" : "Off";
          const stateColor = isLit ? "§q? " : "§c? ";
          message += `\n${stateColor}State: ${stateText}§r`;
        }
      } else {
        if (isLightConnectedToDoorButton(blockPos, blockPos.dimensionId)) {
          message = "§l§c? Linked to Door Button§r";
        } else {
          message = "? §l§6Unlinked§r";
        }
      }
    }
    else if (isSwitchType(block.typeId) || GENERATOR_TYPES.has(block.typeId)) {
      const blockPos = { x: block.location.x, y: block.location.y, z: block.location.z, dimensionId: player.dimension.id };
      const connections = getConnections();
      let numConnections = connections.filter(conn =>
        conn.switch.x === blockPos.x &&
        conn.switch.y === blockPos.y &&
        conn.switch.z === blockPos.z &&
        conn.switch.dimensionId === blockPos.dimensionId
      ).length;

      const isGenerator = GENERATOR_TYPES.has(block.typeId);
      if (isGenerator) {
        numConnections += getGeneratorLinkedDoorButtons(blockPos).length;
      }
      let blockName = "";
      if (isSwitchType(block.typeId)) {
        blockName = `§l§f${getBlockAlias(block.typeId)}§r`;
      } else if (GENERATOR_TYPES.has(block.typeId)) {
        blockName = `§l§f${GENERATOR_ALIASES[block.typeId] || "Generator"}§r`;
      }
      const limit = GENERATOR_TYPES.has(block.typeId) ? getGeneratorLimit() : getSwitchLimit();
      let connectionsText = `${numConnections}/${limit}`;
      if (numConnections >= limit) {
        connectionsText = `§c${numConnections}/${limit} §l?§r`;
      }
      const selection = getSelection(player.id);
      const isSelected = selection && selection.type === (GENERATOR_TYPES.has(block.typeId) ? SelectionType.GENERATOR : SelectionType.SWITCH) &&
        selection.data.pos.x === block.location.x && selection.data.pos.y === block.location.y && selection.data.pos.z === block.location.z;
      const selectionHint = isSelected ? "" : "\n§7(No device selected)";

      if (GENERATOR_TYPES.has(block.typeId)) {
        const generatorData = getGeneratorAt(blockPos);
        const energyInfo = generatorData ? generatorData.energy : "N/A";
        const radiusInfo = generatorData ? (generatorData.radius || 32) : 32;
        message = `${blockName}\n?§p Energy: ${energyInfo}/500§r\n?§7 Connections: ${connectionsText}\n?§7 Radius: ${radiusInfo}${selectionHint}`;
      } else {
        message = `${blockName}\n?§7 Connections: ${connectionsText}${selectionHint}`;
      }
    }
  }
  if (selections[player.id]) {
    const selPos = selections[player.id].pos;
    let isLookingAtSelected = false;
    if (blockData && blockData.block) {
      if (Math.floor(blockData.block.location.x) === selPos.x &&
        Math.floor(blockData.block.location.y) === selPos.y &&
        Math.floor(blockData.block.location.z) === selPos.z) {
        isLookingAtSelected = true;
      }
    }
    if (!isLookingAtSelected) {
      const dimension = world.getDimension(selPos.dimensionId);
      const selectedBlock = dimension.getBlock({ x: selPos.x, y: selPos.y, z: selPos.z });
      let selectedMessage = "";
      if (selectedBlock) {
        if (isSwitchType(selectedBlock.typeId) || GENERATOR_TYPES.has(selectedBlock.typeId)) {
          let blockName = "";
          if (isSwitchType(selectedBlock.typeId)) {
            blockName = `§l§f${getBlockAlias(selectedBlock.typeId)}§r`;
          } else if (GENERATOR_TYPES.has(selectedBlock.typeId)) {
            blockName = `§l§f${GENERATOR_ALIASES[selectedBlock.typeId] || "Generator"}§r`;
          }
          selectedMessage = blockName;
          const limit = GENERATOR_TYPES.has(selectedBlock.typeId) ? getGeneratorLimit() : getSwitchLimit();
          if (GENERATOR_TYPES.has(selectedBlock.typeId)) {
            const generatorData = getGeneratorAt(selPos);
            const energyInfo = generatorData ? generatorData.energy : "N/A";
            const radiusInfo = generatorData ? (generatorData.radius || 32) : 32;
            selectedMessage += `\n?§p Energy: ${energyInfo}/500§r`;
            selectedMessage += `\n?§7 Radius: ${radiusInfo}`;
          }
          const isGenerator = GENERATOR_TYPES.has(selectedBlock.typeId);
          let selConnections = getConnections().filter(conn =>
            conn.switch.x === selPos.x &&
            conn.switch.y === selPos.y &&
            conn.switch.z === selPos.z &&
            conn.switch.dimensionId === selPos.dimensionId
          ).length;

          if (isGenerator) {
            selConnections += getGeneratorLinkedDoorButtons(selPos).length;
          }
          let connectionsText = `${selConnections}/${limit}`;
          if (selConnections >= limit) {
            connectionsText = `§c${selConnections}/${limit} §l?§r`;
          }
          selectedMessage += `\n?§7 Connections: ${connectionsText}`;
          selectedMessage += `\n§7? Coords: (${selPos.x}, ${selPos.y}, ${selPos.z})`;

        } else {
          selectedMessage = `§cOutside the radius\n§7? Selected block at (${selPos.x}, ${selPos.y}, ${selPos.z})`;
        }
      } else {
        selectedMessage = `§cOutside the radius\n§7? Selected block at (${selPos.x}, ${selPos.y}, ${selPos.z})`;
      }
      if (message !== "") {
        message += "\n\n" + selectedMessage;
      } else {
        message = selectedMessage;
      }
    }
  }
  if (message !== "") {
    player.onScreenDisplay.setActionBar({
      rawtext: [
        { text: message }
      ],
    });
  }
}

let lastActionBarUpdate = new Map();
system.runInterval(() => {
  const players = world.getPlayers();
  if (players.length === 0) return;
  for (let i = 0; i < players.length; i++) {
    updateLightTestActionBarForPlayer(players[i]);
  }
}, 10);
