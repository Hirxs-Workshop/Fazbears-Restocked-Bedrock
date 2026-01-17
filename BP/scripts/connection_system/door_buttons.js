import { EquipmentSlot, system, world, BlockPermutation } from "@minecraft/server";
/**
 * FAZBEAR'S RESTOCKED - BEDROCK
 * ©2025
 * This code is the property of Fazbear's Restocked.
 * Unauthorized copying, modification, distribution, or use of this code,
 * via any medium, is strictly prohibited without explicit permission.
 * All rights reserved.
 */

import { ModalFormData, ActionFormData } from "@minecraft/server-ui";
import FaceSelectionPlains from "./face_selection_plains";
import { dynamicToast, getExistingVfxEntity, VFX_ENTITY_TYPES, findAnyVfxEntityAtLocation } from "./utils.js";
import { SelectionType, setSelection, getSelection, clearSelection, hasSelectionOfType } from "./selection_manager.js";
import { isLightType, LIGHT_TYPES, CONNECTIONS_KEY, DOOR_BUTTON_GENERATOR_LINKS_KEY, getVfxEntityForLight } from "./connection_types.js";
import { getGeneratorLimit, getSwitchConnections } from "./main_system.js";
import { getChunkedData, setChunkedData, initializeStorage, STORAGE_KEYS } from "./chunked_storage.js";
import * as FRAPI from "../fr_api.js";

const ANIMATION_DELAY_TICKS = 2;
let hallwayLampVfxEntities = {};

export function clearDoorButtonVfxCache() {
  hallwayLampVfxEntities = {};
}

export function rebuildDoorButtonVfxCache() {
  hallwayLampVfxEntities = {};
  const connections = getConnections();
  
  for (const conn of connections) {
    try {
      const lightData = conn.lightBlock || conn.officeLightBlock;
      if (!lightData) continue;
      
      const dimension = world.getDimension(lightData.dimensionId);
      const location = { x: lightData.x + 0.5, y: lightData.y + 0.5, z: lightData.z + 0.5 };
      const key = `${lightData.dimensionId}_${lightData.x}_${lightData.y}_${lightData.z}`;
      
      const found = findAnyVfxEntityAtLocation(dimension, location);
      if (found) {
        hallwayLampVfxEntities[key] = { vfxType: found.vfxType, entity: found.entity };
      }
    } catch { }
  }
}

const DEFAULT_DOOR_BUTTON_LIMIT = 5;

function getDoorButtonLimit() {
  return world.getDynamicProperty("fr:door_button_limit") ?? DEFAULT_DOOR_BUTTON_LIMIT;
}

export function setDoorButtonLimit(value) {
  world.setDynamicProperty("fr:door_button_limit", value);
}



system.beforeEvents.startup.subscribe(() => {
  try {
    initializeStorage(STORAGE_KEYS.DOOR_BUTTON_CONNECTIONS);
    initializeStorage(STORAGE_KEYS.WOODEN_DOOR_CLAIMS);
  } catch { }
  selectedDoorButton.clear();
});

const getConnections = () => getChunkedData(STORAGE_KEYS.DOOR_BUTTON_CONNECTIONS);
const setConnections = (connections) => setChunkedData(STORAGE_KEYS.DOOR_BUTTON_CONNECTIONS, connections);


export function isLightConnectedToDoorButton(lightPos, dimensionId) {
  const connections = getConnections();
  return connections.some(conn => {
    const lightData = conn.lightBlock || conn.officeLightBlock;
    return lightData &&
      lightData.x === lightPos.x &&
      lightData.y === lightPos.y &&
      lightData.z === lightPos.z &&
      lightData.dimensionId === dimensionId;
  });
}


function isLightConnectedToSwitch(lightPos, dimensionId) {
  const switchConnections = getChunkedData(STORAGE_KEYS.SWITCH_CONNECTIONS);
  return switchConnections.some(conn =>
    conn.light &&
    conn.light.x === lightPos.x &&
    conn.light.y === lightPos.y &&
    conn.light.z === lightPos.z &&
    conn.light.dimensionId === dimensionId
  );
}

export const getDoorButtonGeneratorLinks = () => getChunkedData(STORAGE_KEYS.DOOR_BUTTON_GENERATOR_LINKS);
export const setDoorButtonGeneratorLinks = (links) => setChunkedData(STORAGE_KEYS.DOOR_BUTTON_GENERATOR_LINKS, links);

export function addDoorButtonGeneratorLink(link) {
  const links = getDoorButtonGeneratorLinks();

  const existingLink = links.find(l =>
    l.doorButtonPos.x === link.doorButtonPos.x &&
    l.doorButtonPos.y === link.doorButtonPos.y &&
    l.doorButtonPos.z === link.doorButtonPos.z &&
    l.doorButtonPos.dimensionId === link.doorButtonPos.dimensionId
  );

  if (existingLink) {
    return false;
  }

  const newLink = {
    ...link,
    linkedAt: link.linkedAt || Date.now()
  };

  links.push(newLink);
  setDoorButtonGeneratorLinks(links);
  return true;
}

export function removeDoorButtonGeneratorLink(doorButtonPos) {
  const links = getDoorButtonGeneratorLinks();
  const index = links.findIndex(l =>
    l.doorButtonPos.x === doorButtonPos.x &&
    l.doorButtonPos.y === doorButtonPos.y &&
    l.doorButtonPos.z === doorButtonPos.z &&
    l.doorButtonPos.dimensionId === doorButtonPos.dimensionId
  );

  if (index === -1) {
    return false;
  }

  links.splice(index, 1);
  setDoorButtonGeneratorLinks(links);
  return true;
}

export function getDoorButtonGeneratorLink(doorButtonPos) {
  const links = getDoorButtonGeneratorLinks();
  return links.find(l =>
    l.doorButtonPos.x === doorButtonPos.x &&
    l.doorButtonPos.y === doorButtonPos.y &&
    l.doorButtonPos.z === doorButtonPos.z &&
    l.doorButtonPos.dimensionId === doorButtonPos.dimensionId
  ) || null;
}

export function getGeneratorLinkedDoorButtons(generatorPos) {
  const links = getDoorButtonGeneratorLinks();
  return links.filter(l =>
    l.generatorPos.x === generatorPos.x &&
    l.generatorPos.y === generatorPos.y &&
    l.generatorPos.z === generatorPos.z &&
    l.generatorPos.dimensionId === generatorPos.dimensionId
  );
}

function getGeneratorAt(pos) {
  try {
    const generators = getChunkedData(STORAGE_KEYS.GENERATORS);
    return generators.find(gen =>
      gen.pos.x === pos.x &&
      gen.pos.y === pos.y &&
      gen.pos.z === pos.z &&
      gen.pos.dimensionId === pos.dimensionId
    ) || null;
  } catch {
    return null;
  }
}

export function canDoorButtonOperate(doorButtonPos) {
  const link = getDoorButtonGeneratorLink(doorButtonPos);

  if (!link) {
    return {
      canOperate: true,
      reason: "unlimited"
    };
  }

  const generatorData = getGeneratorAt(link.generatorPos);

  if (!generatorData) {
    return {
      canOperate: true,
      reason: "unlimited"
    };
  }

  if (!generatorData.active) {
    return {
      canOperate: false,
      reason: "generator_off",
      generatorEnergy: generatorData.energy
    };
  }

  if (generatorData.energy <= 0) {
    return {
      canOperate: false,
      reason: "no_energy",
      generatorEnergy: 0
    };
  }

  return {
    canOperate: true,
    reason: "ok",
    generatorEnergy: generatorData.energy
  };
}

export function getDoorButtonEnergyMode(doorButtonPos) {
  const link = getDoorButtonGeneratorLink(doorButtonPos);

  if (link) {
    const generatorData = getGeneratorAt(link.generatorPos);
    if (generatorData) {
      return "dependent";
    }
  }

  return "unlimited";
}


export { getConnections as getDoorButtonConnections };
const addConnection = (connection) => {
  const connections = getConnections();
  connections.push(connection);
  setConnections(connections);
  return true;
};
const removeConnection = (connection) => {
  let connections = getConnections();

  const connLightData = connection.lightBlock || connection.officeLightBlock;

  const index = connections.findIndex(conn => {
    const lightData = conn.lightBlock || conn.officeLightBlock;
    return conn.doorBlock.x === connection.doorBlock.x &&
      conn.doorBlock.y === connection.doorBlock.y &&
      conn.doorBlock.z === connection.doorBlock.z &&
      conn.doorBlock.dimensionId === connection.doorBlock.dimensionId &&
      lightData && connLightData &&
      lightData.x === connLightData.x &&
      lightData.y === connLightData.y &&
      lightData.z === connLightData.z &&
      lightData.dimensionId === connLightData.dimensionId;
  });
  if (index !== -1) {
    connections.splice(index, 1);
    setConnections(connections);
    return true;
  }
  return false;
};
const getConnectionByLightBlock = (block, dimension) => {
  if (!dimension?.id) {
    return undefined;
  }
  const connections = getConnections();
  return connections.find(conn =>
    conn.lightBlock &&
    conn.lightBlock.x === block.location.x &&
    conn.lightBlock.y === block.location.y &&
    conn.lightBlock.z === block.location.z &&
    conn.lightBlock.dimensionId === dimension.id
  );
};

const getConnectionByOfficeLightBlock = (block, dimension) => {
  if (!dimension?.id) {
    return undefined;
  }
  const connections = getConnections();
  return connections.find(conn =>
    (conn.lightBlock &&
      conn.lightBlock.x === block.location.x &&
      conn.lightBlock.y === block.location.y &&
      conn.lightBlock.z === block.location.z &&
      conn.lightBlock.dimensionId === dimension.id) ||
    (conn.officeLightBlock &&
      conn.officeLightBlock.x === block.location.x &&
      conn.officeLightBlock.y === block.location.y &&
      conn.officeLightBlock.z === block.location.z &&
      conn.officeLightBlock.dimensionId === dimension.id)
  );
};

export const getWoodenDoorConnections = () => {
  return getChunkedData(STORAGE_KEYS.WOODEN_DOOR_CLAIMS);
};

export function closeConnectedDoors(doorButtonPos, dimension) {
  const connections = getWoodenDoorConnections().filter(conn =>
    conn.doorBlock.x === doorButtonPos.x &&
    conn.doorBlock.y === doorButtonPos.y &&
    conn.doorBlock.z === doorButtonPos.z &&
    conn.doorBlock.dimensionId === doorButtonPos.dimensionId
  );

  for (const connection of connections) {
    const doorDim = dimension;
    const officeDoorBlock = doorDim.getBlock({
      x: connection.woodenDoorBlock.x,
      y: connection.woodenDoorBlock.y,
      z: connection.woodenDoorBlock.z,
    });

    if (officeDoorBlock && officeDoorBlock.typeId === "fr:office_door") {
      applyOfficeDoorState(officeDoorBlock, false);
      doorDim.playSound("fr:toggle_door", officeDoorBlock.center());
    }
  }
}

export function openConnectedDoors(doorButtonPos, dimension) {
  const connections = getWoodenDoorConnections().filter(conn =>
    conn.doorBlock.x === doorButtonPos.x &&
    conn.doorBlock.y === doorButtonPos.y &&
    conn.doorBlock.z === doorButtonPos.z &&
    conn.doorBlock.dimensionId === doorButtonPos.dimensionId
  );

  for (const connection of connections) {
    const doorDim = dimension;
    const officeDoorBlock = doorDim.getBlock({
      x: connection.woodenDoorBlock.x,
      y: connection.woodenDoorBlock.y,
      z: connection.woodenDoorBlock.z,
    });

    if (officeDoorBlock && officeDoorBlock.typeId === "fr:office_door") {
      applyOfficeDoorState(officeDoorBlock, true);
      doorDim.playSound("fr:toggle_door", officeDoorBlock.center());
    }
  }
}
function sendDebug(player, message) {
  if (player.hasTag("debug_door")) {
    player.sendMessage(`§7[DEBUG-DOOR] ${message}`);
  }
}

const setWoodenDoorConnections = (connections) => {
  setChunkedData(STORAGE_KEYS.WOODEN_DOOR_CLAIMS, connections);
};
const addWoodenDoorConnection = (connection) => {
  const connections = getWoodenDoorConnections();
  connections.push(connection);
  setWoodenDoorConnections(connections);
  
  const verify = getWoodenDoorConnections();
  world.getPlayers().forEach(p => {
    sendDebug(p, `Added connection. Total now: ${verify.length}`);
    sendDebug(p, `Connection: ${JSON.stringify(connection)}`);
  });
  
  return true;
};
const removeWoodenDoorConnection = (connection) => {
  let connections = getWoodenDoorConnections();
  const index = connections.findIndex(conn =>
    conn.doorBlock.x === connection.doorBlock.x &&
    conn.doorBlock.y === connection.doorBlock.y &&
    conn.doorBlock.z === connection.doorBlock.z &&
    conn.doorBlock.dimensionId === connection.doorBlock.dimensionId &&
    conn.woodenDoorBlock &&
    conn.woodenDoorBlock.x === connection.woodenDoorBlock.x &&
    conn.woodenDoorBlock.y === connection.woodenDoorBlock.y &&
    conn.woodenDoorBlock.z === connection.woodenDoorBlock.z &&
    conn.woodenDoorBlock.dimensionId === connection.woodenDoorBlock.dimensionId
  );
  if (index !== -1) {
    connections.splice(index, 1);
    setWoodenDoorConnections(connections);
    return true;
  }
  return false;
};
const getConnectionByWoodenDoorBlock = (block, dimension) => {
  if (!dimension?.id) {
    return undefined;
  }
  const connections = getWoodenDoorConnections();
  const result = connections.find(conn =>
    conn.woodenDoorBlock.x === block.location.x &&
    conn.woodenDoorBlock.y === block.location.y &&
    conn.woodenDoorBlock.z === block.location.z &&
    conn.woodenDoorBlock.dimensionId === dimension.id
  );
  return result;
};

function connectDoorToLight(doorBlock, lightBlock, doorDimension, player) {
  const connections = getConnections();
  const lightConnections = connections.filter(conn =>
    conn.doorBlock.x === doorBlock.location.x &&
    conn.doorBlock.y === doorBlock.location.y &&
    conn.doorBlock.z === doorBlock.location.z &&
    conn.doorBlock.dimensionId === doorDimension.id
  );
  const woodenConnections = getWoodenDoorConnections().filter(conn =>
    conn.doorBlock.x === doorBlock.location.x &&
    conn.doorBlock.y === doorBlock.location.y &&
    conn.doorBlock.z === doorBlock.location.z &&
    conn.doorBlock.dimensionId === doorDimension.id
  );
  const totalConnections = lightConnections.length + woodenConnections.length;
  const limit = getDoorButtonLimit();
  if (totalConnections >= limit) {
    player.sendMessage(dynamicToast("§l§cERROR", `§cMaximum connections (${limit}) reached`, "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
    return;
  }



  const lightPos = { x: lightBlock.location.x, y: lightBlock.location.y, z: lightBlock.location.z };
  if (isLightConnectedToSwitch(lightPos, doorDimension.id)) {
    player.sendMessage(dynamicToast("§l§cERROR", "§cThis light is already connected to a switch", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
    return;
  }


  const existingConnection = connections.find(conn =>
    conn.doorBlock.x === doorBlock.location.x &&
    conn.doorBlock.y === doorBlock.location.y &&
    conn.doorBlock.z === doorBlock.location.z &&
    conn.doorBlock.dimensionId === doorDimension.id &&
    ((conn.lightBlock &&
      conn.lightBlock.x === lightBlock.location.x &&
      conn.lightBlock.y === lightBlock.location.y &&
      conn.lightBlock.z === lightBlock.location.z &&
      conn.lightBlock.dimensionId === doorDimension.id) ||
      (conn.officeLightBlock &&
        conn.officeLightBlock.x === lightBlock.location.x &&
        conn.officeLightBlock.y === lightBlock.location.y &&
        conn.officeLightBlock.z === lightBlock.location.z &&
        conn.officeLightBlock.dimensionId === doorDimension.id))
  );

  if (existingConnection) {
    player.sendMessage(dynamicToast("§l§cERROR", "§cThis connection already exists", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
    return;
  }


  const lightAlreadyConnected = connections.find(conn =>
    (conn.lightBlock &&
      conn.lightBlock.x === lightBlock.location.x &&
      conn.lightBlock.y === lightBlock.location.y &&
      conn.lightBlock.z === lightBlock.location.z &&
      conn.lightBlock.dimensionId === doorDimension.id) ||
    (conn.officeLightBlock &&
      conn.officeLightBlock.x === lightBlock.location.x &&
      conn.officeLightBlock.y === lightBlock.location.y &&
      conn.officeLightBlock.z === lightBlock.location.z &&
      conn.officeLightBlock.dimensionId === doorDimension.id)
  );

  if (lightAlreadyConnected) {
    player.sendMessage(dynamicToast("§l§cERROR", "§cThis light is already connected to another button", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
    return;
  }

  const connection = {
    doorBlock: {
      dimensionId: doorDimension.id,
      x: doorBlock.location.x,
      y: doorBlock.location.y,
      z: doorBlock.location.z
    },
    lightBlock: {
      dimensionId: doorDimension.id,
      x: lightBlock.location.x,
      y: lightBlock.location.y,
      z: lightBlock.location.z,
      typeId: lightBlock.typeId
    }
  };
  if (!addConnection(connection)) {
    player.sendMessage(dynamicToast("§l§cERROR", "§cCould not add the connection", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
    return;
  }
  player.sendMessage(dynamicToast("§l§qSUCCESS", "§qLight linked successfully", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
  doorDimension.playSound("fr:connect_office_light", lightBlock.center());
}


function connectDoorToOfficeLight(doorBlock, officeLightBlock, doorDimension, player) {
  connectDoorToLight(doorBlock, officeLightBlock, doorDimension, player);
}

function syncLightState(block, dimension, player) {
  const doorBlockPos = {
    x: block.location.x,
    y: block.location.y,
    z: block.location.z,
    dimensionId: dimension.id,
  };

  const operationStatus = canDoorButtonOperate(doorBlockPos);

  const rawDoorState = block.permutation.getState("fr:bottom") === true;

  const doorState = operationStatus.canOperate ? rawDoorState : false;

  const connections = getConnections().filter(conn =>
    conn.doorBlock.x === doorBlockPos.x &&
    conn.doorBlock.y === doorBlockPos.y &&
    conn.doorBlock.z === doorBlockPos.z &&
    conn.doorBlock.dimensionId === doorBlockPos.dimensionId
  );
  connections.forEach(connection => {

    const lightData = connection.lightBlock || connection.officeLightBlock;
    if (!lightData) return;

    const lightBlock = dimension.getBlock({
      x: lightData.x,
      y: lightData.y,
      z: lightData.z,
    });
    if (lightBlock && lightBlock.typeId !== "minecraft:air") {
      try {
        const newPerm = lightBlock.permutation.withState("fr:lit", doorState);
        lightBlock.setPermutation(newPerm);
      } catch { }

      const key = `${lightData.dimensionId}_${lightData.x}_${lightData.y}_${lightData.z}`;
      const lightTypeId = lightData.typeId || lightBlock.typeId;
      const location = {
        x: lightData.x + 0.5,
        y: lightData.y,
        z: lightData.z + 0.5
      };

      if (doorState) {

        if (!hallwayLampVfxEntities[key]) {
          try {
            const vfxEntityType = getVfxEntityForLight(lightTypeId);
            
            const existingVfx = findAnyVfxEntityAtLocation(dimension, location);
            if (existingVfx) {
              hallwayLampVfxEntities[key] = { vfxType: existingVfx.vfxType, entity: existingVfx.entity };
            } else if (lightTypeId === "fr:stage_spotlight") {
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
              dimension.runCommand(`summon fr:stage_spotlight_vfx ${location.x} ${location.y} ${location.z} ${angle} 0`);
              const blockColor = lightBlock.permutation.getState("fr:color") ?? 4;
              const spawnedEntities = dimension.getEntities({
                type: "fr:stage_spotlight_vfx",
                location: location,
                maxDistance: 0.5
              });
              for (const entity of spawnedEntities) {
                const colorComponent = entity.getComponent("minecraft:color");
                if (colorComponent) colorComponent.value = blockColor;
              }
              hallwayLampVfxEntities[key] = { vfxType: "stage_spotlight" };
            } else if (lightTypeId === "fr:pizzeria_lamp") {
              const entity = dimension.spawnEntity("fr:pizzeria_lamp_vfx", location);
              hallwayLampVfxEntities[key] = { vfxType: "pizzeria_lamp", entity };
            } else if (lightTypeId === "fr:ceiling_light") {
              const cardinal = lightBlock.permutation.getState("minecraft:cardinal_direction") || "north";
              const isNorthSouth = cardinal === "north" || cardinal === "south";
              const rotation = isNorthSouth ? 0 : 90;
              const entity = dimension.spawnEntity("fr:ceiling_light_vfx", location);
              entity.setRotation({ x: 0, y: rotation });
              hallwayLampVfxEntities[key] = { vfxType: "ceiling_light", entity };
            } else if (lightTypeId === "fr:pirate_cove_light") {
              const cardinal = lightBlock.permutation.getState("minecraft:cardinal_direction") || "south";
              let offsetX = 0, offsetZ = 0, yRot = 0;
              switch (cardinal) {
                case 'north': offsetZ = -0.3; yRot = 180; break;
                case 'south': offsetZ = 0.3; yRot = 0; break;
                case 'east': offsetX = 0.3; yRot = 90; break;
                case 'west': offsetX = -0.3; yRot = -90; break;
              }
              const spawnPos = { x: lightData.x + 0.5 + offsetX, y: lightData.y + 0.4, z: lightData.z + 0.5 + offsetZ };
              const entity = dimension.spawnEntity("fr:pirate_cove_light_entity", spawnPos);
              if (entity) entity.setRotation({ x: 0, y: yRot });
              hallwayLampVfxEntities[key] = { vfxType: "fr:pirate_cove_light_entity", entity };
            } else if (lightTypeId === "fr:office_light") {
              const entity = dimension.spawnEntity("fr:hallway_lamp_vfx", location);
              hallwayLampVfxEntities[key] = { vfxType: "hallway_lamp", entity };
            } else if (lightTypeId === "fr:office_lamp" || lightTypeId === "fr:supply_room_lightbulb") {
              const entity = dimension.spawnEntity("fr:office_lamp_vfx", location);
              hallwayLampVfxEntities[key] = { vfxType: "office_lamp", entity };
            } else {

              const vfxEntityType = getVfxEntityForLight(lightTypeId);
              const entity = dimension.spawnEntity(vfxEntityType, location);
              hallwayLampVfxEntities[key] = { vfxType: vfxEntityType, entity };
            }
          } catch (e) { }
        }
      } else {

        const locationCenter = {
          x: lightData.x + 0.5,
          y: lightData.y + 0.5,
          z: lightData.z + 0.5
        };
        try {
          const storedVfx = hallwayLampVfxEntities[key];
          const vfxType = storedVfx?.vfxType;

          if (vfxType === "stage_spotlight") {
            dimension.runCommand(`execute at @e[type=fr:stage_spotlight_vfx] positioned ${locationCenter.x} ${locationCenter.y} ${locationCenter.z} run event entity @e[r=0.5] destroy`);
          } else if (vfxType === "pizzeria_lamp") {
            dimension.runCommand(`execute at @e[type=fr:pizzeria_lamp_vfx] positioned ${locationCenter.x} ${locationCenter.y} ${locationCenter.z} run event entity @e[r=0.5] destroy`);
          } else if (vfxType === "ceiling_light") {
            dimension.runCommand(`execute at @e[type=fr:ceiling_light_vfx] positioned ${locationCenter.x} ${locationCenter.y} ${locationCenter.z} run event entity @e[r=0.5] destroy`);
          } else if (vfxType === "fr:pirate_cove_light_entity") {
            const pirateLocation = { x: lightData.x + 0.5, y: lightData.y + 0.4, z: lightData.z + 0.5 };
            dimension.runCommand(`execute at @e[type=fr:pirate_cove_light_entity] positioned ${pirateLocation.x} ${pirateLocation.y} ${pirateLocation.z} run event entity @e[r=1.5] destroy`);
          } else if (vfxType === "hallway_lamp") {
            dimension.runCommand(`execute at @e[type=fr:hallway_lamp_vfx] positioned ${locationCenter.x} ${locationCenter.y} ${locationCenter.z} run event entity @e[r=0.5] destroy`);
          } else if (vfxType === "office_lamp") {
            dimension.runCommand(`execute at @e[type=fr:office_lamp_vfx] positioned ${locationCenter.x} ${locationCenter.y} ${locationCenter.z} run event entity @e[r=0.5] destroy`);
          } else {

            const vfxEntityType = getVfxEntityForLight(lightTypeId);
            dimension.runCommand(`execute at @e[type=${vfxEntityType}] positioned ${locationCenter.x} ${locationCenter.y} ${locationCenter.z} run event entity @e[r=0.5] destroy`);
          }
        } catch { }
        if (hallwayLampVfxEntities[key]) {
          delete hallwayLampVfxEntities[key];
        }
      }
    }
  });
}

function connectDoorToWoodenDoor(doorBlock, woodenDoorBlock, doorDimension, player) {
  sendDebug(player, `=== connectDoorToWoodenDoor START ===`);
  sendDebug(player, `doorBlock location: ${JSON.stringify(doorBlock.location)}`);
  sendDebug(player, `woodenDoorBlock location: ${JSON.stringify(woodenDoorBlock.location)}`);
  sendDebug(player, `doorDimension.id: ${doorDimension.id}`);
  
  const connections = getWoodenDoorConnections();
  sendDebug(player, `Current connections count: ${connections.length}`);
  
  const woodenConnections = connections.filter(conn =>
    conn.doorBlock.x === doorBlock.location.x &&
    conn.doorBlock.y === doorBlock.location.y &&
    conn.doorBlock.z === doorBlock.location.z &&
    conn.doorBlock.dimensionId === doorDimension.id
  );
  const lightConnections = getConnections().filter(conn =>
    conn.doorBlock.x === doorBlock.location.x &&
    conn.doorBlock.y === doorBlock.location.y &&
    conn.doorBlock.z === doorBlock.location.z &&
    conn.doorBlock.dimensionId === doorDimension.id
  );
  const totalConnections = woodenConnections.length + lightConnections.length;
  const limit = getDoorButtonLimit();
  sendDebug(player, `Total connections for this button: ${totalConnections}, limit: ${limit}`);
  
  if (totalConnections >= limit) {
    player.sendMessage(dynamicToast("§l§cERROR", `§cMaximum connections (${limit}) reached`, "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
    return;
  }

  const connection = {
    doorBlock: {
      dimensionId: doorDimension.id,
      x: doorBlock.location.x,
      y: doorBlock.location.y,
      z: doorBlock.location.z
    },
    woodenDoorBlock: {
      dimensionId: doorDimension.id,
      x: woodenDoorBlock.location.x,
      y: woodenDoorBlock.location.y,
      z: woodenDoorBlock.location.z
    }
  };
  
  sendDebug(player, `New connection to add: ${JSON.stringify(connection)}`);
  
  if (!addWoodenDoorConnection(connection)) {
    player.sendMessage(dynamicToast("§l§cERROR", "§cCould not add wooden door connection", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
    return;
  }
  
  sendDebug(player, `=== connectDoorToWoodenDoor SUCCESS ===`);
  player.sendMessage(dynamicToast("§l§qSUCCESS", "§qOffice door linked successfully", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
  doorDimension.playSound("fr:connect_office_light", woodenDoorBlock.center());
}

function findOfficeDoorUpperBlock(clickedBlock) {
  if (!clickedBlock || clickedBlock.typeId !== "fr:office_door") return null;
  const dim = clickedBlock.dimension;
  const x = clickedBlock.location.x;
  const z = clickedBlock.location.z;
  let isUpper = false;
  try {
    isUpper = clickedBlock.permutation.getState("fr:upper") === true;
  } catch (_) { }
  if (isUpper) return clickedBlock;
  let y = clickedBlock.location.y + 1;
  while (true) {
    const b = dim.getBlock({ x, y, z });
    if (!b || b.typeId !== "fr:office_door") break;
    try {
      if (b.permutation.getState("fr:upper") === true) return b;
    } catch (_) { }
    y++;
  }
  return null;
}

export function applyOfficeDoorState(officeDoorBlock, open) {
  if (!officeDoorBlock) return;
  const dim = officeDoorBlock.dimension;
  const x = officeDoorBlock.location.x;
  const z = officeDoorBlock.location.z;

  let cardinalDirection = "south";
  try {
    cardinalDirection = officeDoorBlock.permutation.getState("minecraft:cardinal_direction") || "south";
  } catch (e) {
  }

  const updateUpperBlock = (delayTicks = 0) => {
    system.runTimeout(() => {
      try {
        const doorOpenState = !open;
        const permUpper = BlockPermutation.resolve("fr:office_door", {
          "fr:door_open": doorOpenState,
          "fr:bottom": false,
          "fr:middle": false,
          "fr:upper": true,
          "minecraft:cardinal_direction": cardinalDirection,
        });
        const block = dim.getBlock({ x, y: officeDoorBlock.location.y, z });
        if (block) {
          block.setPermutation(permUpper);
        }
      } catch (e) {
        try {
          const block = dim.getBlock({ x, y: officeDoorBlock.location.y, z });
          if (block) {
            const doorOpenState = !open;
            let p = block.permutation.withState("fr:door_open", doorOpenState);
            p = p.withState("fr:bottom", false);
            p = p.withState("fr:middle", false);
            p = p.withState("fr:upper", true);
            block.setPermutation(p);
          }
        } catch { }
      }
    }, delayTicks);
  };

  if (open) {
    const segmentsToRemove = [];
    let y = officeDoorBlock.location.y - 1;
    while (true) {
      const b = dim.getBlock({ x, y, z });
      if (!b) break;
      if (b.typeId !== "fr:office_door") break;
      let isMiddle = false, isBottom = false;
      try {
        isMiddle = b.permutation.getState("fr:middle") === true;
        isBottom = b.permutation.getState("fr:bottom") === true;
      } catch (e) { }
      if (!isMiddle && !isBottom) break;
      segmentsToRemove.push(y);
      y--;
    }
    segmentsToRemove.reverse();
    segmentsToRemove.forEach((segY, index) => {
      system.runTimeout(() => {
        const target = dim.getBlock({ x, y: segY, z });
        if (target && target.typeId === "fr:office_door") {
          target.setType("minecraft:air");
        }
      }, index * ANIMATION_DELAY_TICKS);
    });
    const totalDelay = segmentsToRemove.length * ANIMATION_DELAY_TICKS;
    updateUpperBlock(totalDelay);

    system.runTimeout(() => {
      dim.playSound("office_door", { x: x + 0.5, y: officeDoorBlock.location.y, z: z + 0.5 });
    }, totalDelay);
    return;
  }

  let y = officeDoorBlock.location.y - 1;
  let lastAirY = null;
  while (true) {
    const b = dim.getBlock({ x, y, z });
    if (!b) break;
    if (b.typeId === "minecraft:air") {
      lastAirY = y;
      y--;
      continue;
    }
    break;
  }

  if (lastAirY !== null) {
    const segmentsToPlace = [];
    for (let yy = officeDoorBlock.location.y - 1; yy >= lastAirY; yy--) {
      const isBottom = yy === lastAirY;
      const isMiddle = !isBottom;
      segmentsToPlace.push({ y: yy, isMiddle, isBottom });
    }
    updateUpperBlock(0);
    segmentsToPlace.forEach((segment, index) => {
      system.runTimeout(() => {
        try {
          const permSeg = BlockPermutation.resolve("fr:office_door", {
            "fr:door_open": true,
            "fr:upper": false,
            "fr:middle": segment.isMiddle,
            "fr:bottom": segment.isBottom,
            "minecraft:cardinal_direction": cardinalDirection,
          });
          const target = dim.getBlock({ x, y: segment.y, z });
          if (target) {
            target.setPermutation(permSeg);
          }
        } catch {
          const target = dim.getBlock({ x, y: segment.y, z });
          if (target && target.typeId === "minecraft:air") {
            try {
              target.setType("fr:office_door");
              let p = target.permutation.withState("fr:door_open", true)
                .withState("fr:upper", false)
                .withState("fr:middle", segment.isMiddle)
                .withState("fr:bottom", segment.isBottom)
                .withState("minecraft:cardinal_direction", cardinalDirection);
              target.setPermutation(p);
            } catch { }
          }
        }
      }, index * ANIMATION_DELAY_TICKS);
    });

    const totalClosingDelay = segmentsToPlace.length * ANIMATION_DELAY_TICKS;
    system.runTimeout(() => {
      dim.playSound("office_door", { x: x + 0.5, y: officeDoorBlock.location.y, z: z + 0.5 });
    }, totalClosingDelay);
  } else {
    updateUpperBlock(0);
  }
}

const pendingConnections = new Map();
const pendingWoodenDoorConnections = new Map();

function getButtonSelections(blockY) {
  if (blockY >= 0) {
    return new FaceSelectionPlains(
      { origin: [5, 0], size: [6, 6], name: "door" },
      { origin: [5, 9], size: [6, 6], name: "light" }
    );
  } else {
    return new FaceSelectionPlains(
      { origin: [5, 9], size: [6, 6], name: "door" },
      { origin: [5, 0], size: [6, 6], name: "light" }
    );
  }
}

const selectedDoorButton = new Map();

function showRemoveAllConnectionsModal(player) {
  const form = new ActionFormData()
    .title("Remove All Connections")
    .body("Are you sure you want to remove all connections?\nThis will remove both office light and wooden door connections.")
    .button("Remove All")
    .button("Cancel");
  form.show(player).then(response => {
    if (response.selection === 0) {
      setConnections([]);
      setWoodenDoorConnections([]);
      player.sendMessage(dynamicToast("§l§qSUCCESS", "§qAll connections removed", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
    } else {
      player.sendMessage(dynamicToast("§l§7INFO", "§7Operation cancelled", "textures/fr_ui/selection_icon", "textures/fr_ui/default_ui"));
    }
  })
}

function showRemoveConnectionModal(player) {
  const connections = getConnections();
  if (connections.length === 0) {
    player.sendMessage(dynamicToast("§l§6INFO", "§6No connections to remove", "textures/fr_ui/unlinked_icon", "textures/fr_ui/unlinked_ui"));
    return;
  }
  const options = connections.map((conn, index) =>
    `${index + 1}: Door (${conn.doorBlock.x},${conn.doorBlock.y},${conn.doorBlock.z}) - OfficeLight (${conn.officeLightBlock.x},${conn.officeLightBlock.y},${conn.officeLightBlock.z})`
  );
  const form = new ModalFormData()
    .title("Remove Connection")
    .dropdown("Select a connection to remove", options)
    .button("Cancel", "textures/fr_ui/deny_icon")
    .button("Remove", "textures/fr_ui/approve_icon");
  form.show(player).then(response => {
    if (response.formValues && typeof response.formValues[0] === "number") {
      const index = response.formValues[0];
      const connections = getConnections();
      if (index >= 0 && index < connections.length) {
        connections.splice(index, 1);
        setConnections(connections);
        player.sendMessage(dynamicToast("§l§qSUCCESS", "§qConnection removed", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
      }
    }
  })
}

function showDisconnectModal(player, connection) {
  const form = new ActionFormData()
    .title("Disconnect Connection")
    .body(
      `Do you want to disconnect the connection?\n` +
      `Door: (${connection.doorBlock.x}, ${connection.doorBlock.y}, ${connection.doorBlock.z})\n` +
      `Office Light: (${connection.officeLightBlock ? connection.officeLightBlock.x + ", " + connection.officeLightBlock.y + ", " + connection.officeLightBlock.z : "N/A"})\n` +
      `Wooden Door: (${connection.woodenDoorBlock ? connection.woodenDoorBlock.x + ", " + connection.woodenDoorBlock.y + ", " + connection.woodenDoorBlock.z : "N/A"})`
    )
    .button("Disconnect")
    .button("Cancel");
  form.show(player).then(response => {
    if (response.selection === 0) {
      let disconnected = false;
      if (connection.officeLightBlock) {
        if (removeConnection(connection)) {
          player.sendMessage(dynamicToast("§l§qSUCCESS", "§qOffice light disconnected", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
          disconnected = true;
        }
      }
      if (connection.woodenDoorBlock) {
        if (removeWoodenDoorConnection(connection)) {
          player.sendMessage(dynamicToast("§l§qSUCCESS", "§qOffice door disconnected", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
          disconnected = true;
        }
      }
      if (!disconnected) {
        player.sendMessage(dynamicToast("§l§cERROR", "§cFailed to disconnect", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
      }
    } else {
      player.sendMessage(dynamicToast("§l§7INFO", "§7Operation cancelled", "textures/fr_ui/selection_icon", "textures/fr_ui/default_ui"));
    }
  })
}

function showDoorButtonDisconnectMenu(player, link, block, dimension) {
  const generatorPos = link.generatorPos;
  const form = new ActionFormData()
    .title("Disconnect from Generator")
    .body(
      `This door button is connected to a generator.\n\n` +
      `Generator Location:\n` +
      `X: ${generatorPos.x}, Y: ${generatorPos.y}, Z: ${generatorPos.z}\n\n` +
      `Do you want to disconnect it?`
    )
    .button("Disconnect")
    .button("Cancel");

  form.show(player).then(response => {
    if (response.canceled) return;

    if (response.selection === 0) {
      const doorButtonPos = {
        x: link.doorButtonPos.x,
        y: link.doorButtonPos.y,
        z: link.doorButtonPos.z,
        dimensionId: link.doorButtonPos.dimensionId
      };

      const success = removeDoorButtonGeneratorLink(doorButtonPos);
      if (success) {
        player.sendMessage(dynamicToast("§l§qSUCCESS", "§qDoor button disconnected from generator", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
        dimension.playSound("fr:disconnect", block.center());
      } else {
        player.sendMessage(dynamicToast("§l§cERROR", "§cFailed to disconnect", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
      }
    } else {
      player.sendMessage(dynamicToast("§l§7INFO", "§7Operation cancelled", "textures/fr_ui/selection_icon", "textures/fr_ui/default_ui"));
    }
  });
}

function handleDoorButtonsInteract({ block, face, faceLocation, dimension, player }) {
  if (!player) return;

  let selectedZone = null;

  if (block.typeId === "fr:door_button_door") {
    selectedZone = "door";
  } else if (block.typeId === "fr:door_button_light") {
    selectedZone = "light";
  } else {
    const relativeFaceLocation = {
      x: faceLocation.x - block.location.x,
      y: faceLocation.y - block.location.y,
      z: faceLocation.z - block.location.z,
    };

    const buttonSelections = getButtonSelections(block.location.y);
    selectedZone = buttonSelections.getSelected({ face, faceLocation: relativeFaceLocation });
  }

  const equippable = player.getComponent("minecraft:equippable");
  if (!equippable) {
    return;
  }
  const mainhand = equippable.getEquipmentSlot(EquipmentSlot.Mainhand);

  if (mainhand.hasItem() && mainhand.typeId === "minecraft:blaze_rod") {
    showRemoveAllConnectionsModal(player);
    return;
  }

  if (mainhand.hasItem() && mainhand.typeId === "fr:faz-diver_security") {
    if (player.isSneaking) {
      const doorButtonPos = {
        x: block.location.x,
        y: block.location.y,
        z: block.location.z,
        dimensionId: block.dimension.id
      };
      const existingLink = getDoorButtonGeneratorLink(doorButtonPos);
      if (existingLink) {
        showDoorButtonDisconnectMenu(player, existingLink, block, dimension);
        return;
      }
    }

    const currentSelection = getSelection(player.id);

    if (currentSelection && currentSelection.type === SelectionType.GENERATOR) {
      if (player.hasTag("debug_energy")) {
        player.sendMessage(`§7[DEBUG] Door button interact with security tool.`);
        player.sendMessage(`§7[DEBUG] Selection found: GENERATOR at (${currentSelection.data.pos.x}, ${currentSelection.data.pos.y}, ${currentSelection.data.pos.z})`);
      }
      const generatorPos = currentSelection.data.pos;
      const doorButtonPos = {
        x: block.location.x,
        y: block.location.y,
        z: block.location.z,
        dimensionId: block.dimension.id
      };

      const existingLink = getDoorButtonGeneratorLink(doorButtonPos);
      if (existingLink &&
        existingLink.generatorPos.x === generatorPos.x &&
        existingLink.generatorPos.y === generatorPos.y &&
        existingLink.generatorPos.z === generatorPos.z &&
        existingLink.generatorPos.dimensionId === generatorPos.dimensionId) {
        clearSelection(player.id);
        player.sendMessage(dynamicToast("§l§6INFO", "§6Already connected - selection cancelled", "textures/fr_ui/unlinked_icon", "textures/fr_ui/unlinked_ui"));
        return;
      }

      if (existingLink) {
        player.sendMessage(dynamicToast("§l§cERROR", "§cThis door button is already connected to another generator", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
        return;
      }

      const dx = doorButtonPos.x - generatorPos.x;
      const dy = doorButtonPos.y - generatorPos.y;
      const dz = doorButtonPos.z - generatorPos.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const generatorData = getGeneratorAt(generatorPos);
      const allowedRadius = generatorData ? (generatorData.radius || 32) : 32;

      if (distance > allowedRadius) {
        if (player.hasTag("debug_energy")) {
          player.sendMessage(`§7[DEBUG] Out of radius: dist=${distance.toFixed(1)}, allowed=${allowedRadius}`);
        }
        player.sendMessage(dynamicToast("§l§cERROR", `§cBlock outside ${allowedRadius} block radius`, "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
        return;
      }

      const limit = getGeneratorLimit();
      const connections = getSwitchConnections();
      let currentCount = connections.filter(conn =>
        conn.switch.x === generatorPos.x &&
        conn.switch.y === generatorPos.y &&
        conn.switch.z === generatorPos.z &&
        conn.switch.dimensionId === generatorPos.dimensionId
      ).length;
      currentCount += getGeneratorLinkedDoorButtons(generatorPos).length;

      if (player.hasTag("debug_energy")) {
        player.sendMessage(`§7[DEBUG] Generator connection check: count=${currentCount}, limit=${limit}`);
      }

      if (currentCount >= limit) {
        player.sendMessage(dynamicToast("§l§cLIMIT REACHED", `§cMaximum connections reached for this Generator (${currentCount}/${limit})`, "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
        return;
      }

      const link = {
        doorButtonPos: doorButtonPos,
        generatorPos: generatorPos
      };

      const success = addDoorButtonGeneratorLink(link);
      if (success) {
        player.sendMessage(dynamicToast("§l§qSUCCESS", "§qDoor button connected to generator", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
        dimension.playSound("fr:connect_office_light", block.center());

        clearSelection(player.id);
      } else {
        player.sendMessage(dynamicToast("§l§cERROR", "§cCould not create connection", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
      }
      return;
    }

    if (selectedZone === "light") {
      pendingWoodenDoorConnections.delete(player.name);
      pendingConnections.set(player.name, { doorBlock: block, doorDimension: block.dimension });
      selectedDoorButton.set(player.name, {
        x: block.location.x,
        y: block.location.y,
        z: block.location.z,
        dimensionId: block.dimension.id,
      });

      setSelection(player.id, SelectionType.DOOR_BUTTON_LIGHT, {
        pos: { x: block.location.x, y: block.location.y, z: block.location.z, dimensionId: block.dimension.id }
      });

      player.sendMessage(dynamicToast("§l§9INFO", "§9The Door Buttons block has been selected (Light)", "textures/fr_ui/door_buttons_office", "textures/fr_ui/selection_ui"));
      return;
    }
    if (selectedZone === "door") {
      pendingConnections.delete(player.name);
      pendingWoodenDoorConnections.set(player.name, { doorBlock: block, doorDimension: block.dimension });
      selectedDoorButton.set(player.name, {
        x: block.location.x,
        y: block.location.y,
        z: block.location.z,
        dimensionId: block.dimension.id,
      });

      setSelection(player.id, SelectionType.DOOR_BUTTON_DOOR, {
        pos: { x: block.location.x, y: block.location.y, z: block.location.z, dimensionId: block.dimension.id }
      });

      player.sendMessage(dynamicToast("§l§9INFO", "§9The Door Buttons block has been selected (Door)", "textures/fr_ui/door_buttons_office", "textures/fr_ui/selection_ui"));
      return;
    }
    return;
  }

  if (selectedZone === "door") {
    const doorButtonPos = {
      x: block.location.x,
      y: block.location.y,
      z: block.location.z,
      dimensionId: dimension.id,
    };
    const operationStatus = canDoorButtonOperate(doorButtonPos);

    if (!operationStatus.canOperate) {
      player.sendMessage(dynamicToast("§l§cNO ENERGY", "§cThe generator has no power", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
      dimension.playSound("note.bass", block.center());
      return;
    }

    const currentState = block.permutation.getState("fr:upper");
    const newState = !currentState;
    block.setPermutation(block.permutation.withState("fr:upper", newState));
    dimension.playSound("door_button", block.center());
    dimension.playSound("fr:toggle_door", block.center());

    const allConnections = getWoodenDoorConnections();
    sendDebug(player, `All wooden door connections: ${allConnections.length}`);
    sendDebug(player, `Looking for doorButtonPos: ${JSON.stringify(doorButtonPos)}`);
    
    const connections = allConnections.filter(conn => {
      const match = conn.doorBlock.x === doorButtonPos.x &&
        conn.doorBlock.y === doorButtonPos.y &&
        conn.doorBlock.z === doorButtonPos.z &&
        conn.doorBlock.dimensionId === doorButtonPos.dimensionId;
      sendDebug(player, `Checking conn: ${JSON.stringify(conn.doorBlock)} -> match: ${match}`);
      return match;
    });
    
    sendDebug(player, `Filtered connections for this button: ${connections.length}`);
    
    const desiredOpen = newState;
    for (const connection of connections) {
      const doorDim = block.dimension;
      sendDebug(player, `Trying to get door at: ${JSON.stringify(connection.woodenDoorBlock)}`);
      const officeDoorBlock = doorDim.getBlock({
        x: connection.woodenDoorBlock.x,
        y: connection.woodenDoorBlock.y,
        z: connection.woodenDoorBlock.z,
      });
      sendDebug(player, `officeDoorBlock found: ${officeDoorBlock ? officeDoorBlock.typeId : 'null'}`);
      if (officeDoorBlock) {
        applyOfficeDoorState(officeDoorBlock, desiredOpen);
        doorDim.playSound("fr:toggle_door", officeDoorBlock.center());
      }
    }
    return;
  } else if (selectedZone === "light") {
    const doorButtonPos = {
      x: block.location.x,
      y: block.location.y,
      z: block.location.z,
      dimensionId: dimension.id,
    };
    const operationStatus = canDoorButtonOperate(doorButtonPos);

    if (!operationStatus.canOperate) {
      player.sendMessage(dynamicToast("§l§cNO ENERGY", "§cThe generator has no power", "textures/fr_ui/deny_icon", "textures/fr_ui/deny_ui"));
      dimension.playSound("note.bass", block.center());
      return;
    }

    const currentState = block.permutation.getState("fr:bottom");
    const newState = !currentState;
    block.setPermutation(block.permutation.withState("fr:bottom", newState));
    dimension.playSound("door_button", block.center());
    dimension.playSound("fr:toggle_light", block.center());
    syncLightState(block, dimension, player);
  }
  if (block && (block.typeId === "fr:door_buttons" || block.typeId === "fr:door_button_door" || block.typeId === "fr:door_button_light")) {
    const doorBlockPos = {
      x: block.location.x,
      y: block.location.y,
      z: block.location.z,
      dimensionId: dimension.id,
    };
    selectedDoorButton.set(player.name, doorBlockPos);
  }
}


const DoorButtonsComponent = {
  onPlayerInteract: handleDoorButtonsInteract,
};

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("fr:door_buttons", DoorButtonsComponent);
});

world.afterEvents.playerInteractWithBlock.subscribe(event => {
  const { player, block, itemStack } = event;
  const blockDimension = block.dimension;
  if (!player) return;


  if (itemStack && itemStack.typeId === "fr:faz-diver_security" && isLightType(block.typeId)) {

    const currentSelection = getSelection(player.id);
    const hasDoorButtonLightSelection = currentSelection && currentSelection.type === SelectionType.DOOR_BUTTON_LIGHT;

    if (hasDoorButtonLightSelection && pendingConnections.has(player.name)) {
      const pending = pendingConnections.get(player.name);
      connectDoorToLight(pending.doorBlock, block, pending.doorDimension, player);
      pendingConnections.delete(player.name);
      selectedDoorButton.delete(player.name);
      clearSelection(player.id);
    } else if (!hasDoorButtonLightSelection) {

      const connection = getConnectionByLightBlock(block, blockDimension);
      if (connection) {
        showDisconnectModal(player, connection);
      }
    }
    return;
  }

  if (itemStack && itemStack.typeId === "fr:faz-diver_security" && block.typeId === "fr:office_door") {
    const upperBlock = findOfficeDoorUpperBlock(block);
    if (!upperBlock) {
      return;
    }
    if (pendingWoodenDoorConnections.has(player.name)) {
      const pending = pendingWoodenDoorConnections.get(player.name);
      connectDoorToWoodenDoor(pending.doorBlock, upperBlock, pending.doorDimension, player);
      pendingWoodenDoorConnections.delete(player.name);
      selectedDoorButton.delete(player.name);
      clearSelection(player.id);
    } else {
      const connection = getConnectionByWoodenDoorBlock(upperBlock, blockDimension);
      if (connection) {
        showDisconnectModal(player, connection);
      }
    }
    return;
  }

});

function removeEntireOfficeDoor(upperBlock, dimension) {
  if (!upperBlock) return;
  const x = upperBlock.location.x;
  const z = upperBlock.location.z;
  let y = upperBlock.location.y - 1;
  let removedCount = 0;
  while (true) {
    const b = dimension.getBlock({ x, y, z });
    if (!b || b.typeId !== "fr:office_door") break;
    let isMiddle = false, isBottom = false;
    try {
      isMiddle = b.permutation.getState("fr:middle") === true;
      isBottom = b.permutation.getState("fr:bottom") === true;
    } catch (e) { }
    if (!isMiddle && !isBottom) break;
    b.setType("minecraft:air");
    removedCount++;
    y--;
  }
  upperBlock.setType("minecraft:air");
}

world.afterEvents.playerBreakBlock.subscribe(event => {
  const { block, player, brokenBlockPermutation } = event;
  const dimension = block.dimension;
  const brokenBlockType = brokenBlockPermutation.type.id;



  if (isLightType(brokenBlockType)) {

    let connections = getConnections();
    const connectionsToRemove = connections.filter(conn => {
      const lightData = conn.lightBlock || conn.officeLightBlock;
      return lightData &&
        lightData.x === block.location.x &&
        lightData.y === block.location.y &&
        lightData.z === block.location.z &&
        lightData.dimensionId === dimension.id;
    });

    if (connectionsToRemove.length > 0) {

      connections = connections.filter(conn => {
        const lightData = conn.lightBlock || conn.officeLightBlock;
        return !(lightData &&
          lightData.x === block.location.x &&
          lightData.y === block.location.y &&
          lightData.z === block.location.z &&
          lightData.dimensionId === dimension.id);
      });
      setConnections(connections);
      if (player) player.sendMessage(`${connectionsToRemove.length} connection(s) removed: light block destroyed.`);
    }
  }

  if (brokenBlockType === "fr:office_door") {
    let wasUpper = false;
    try {
      wasUpper = brokenBlockPermutation.getState("fr:upper") === true;
    } catch (e) { }

    if (wasUpper) {
      const fakeBlock = {
        location: block.location,
        dimension: dimension,
        typeId: "fr:office_door",
        permutation: brokenBlockPermutation
      };
      const connection = getConnectionByWoodenDoorBlock(fakeBlock, dimension);
      if (connection) {
        removeWoodenDoorConnection(connection);
        if (player) player.sendMessage("§cOffice door connection removed.");
      }
      system.runTimeout(() => {
        const x = block.location.x;
        const z = block.location.z;
        let y = block.location.y - 1;
        while (true) {
          const b = dimension.getBlock({ x, y, z });
          if (!b || b.typeId !== "fr:office_door") break;
          let isMiddle = false, isBottom = false;
          try {
            isMiddle = b.permutation.getState("fr:middle") === true;
            isBottom = b.permutation.getState("fr:bottom") === true;
          } catch (e) { }
          if (!isMiddle && !isBottom) break;
          b.setType("minecraft:air");
          y--;
        }
      }, 1);
    } else {
      const x = block.location.x;
      const z = block.location.z;
      let upperBlock = null;
      let y = block.location.y + 1;
      while (true) {
        const b = dimension.getBlock({ x, y, z });
        if (!b || b.typeId !== "fr:office_door") break;
        try {
          if (b.permutation.getState("fr:upper") === true) {
            upperBlock = b;
            break;
          }
        } catch (e) { }
        y++;
      }
      if (upperBlock) {
        const connection = getConnectionByWoodenDoorBlock(upperBlock, dimension);
        if (connection) {
          removeWoodenDoorConnection(connection);
          if (player) player.sendMessage("§cOffice door connection removed.");
        }
        system.runTimeout(() => {
          const brokenY = block.location.y;
          let yBelow = brokenY - 1;
          let removedBelow = 0;
          while (true) {
            const b = dimension.getBlock({ x, y: yBelow, z });
            if (!b || b.typeId !== "fr:office_door") break;
            b.setType("minecraft:air");
            removedBelow++;
            yBelow--;
          }
          removeEntireOfficeDoor(upperBlock, dimension);
        }, 1);
      }
    }
  }


  if (brokenBlockType === "fr:door_buttons") {
    const doorBlockPos = {
      x: block.location.x,
      y: block.location.y,
      z: block.location.z,
      dimensionId: dimension.id
    };


    let connections = getConnections();
    const lightConnectionsToRemove = connections.filter(conn =>
      conn.doorBlock.x === doorBlockPos.x &&
      conn.doorBlock.y === doorBlockPos.y &&
      conn.doorBlock.z === doorBlockPos.z &&
      conn.doorBlock.dimensionId === doorBlockPos.dimensionId
    );

    if (lightConnectionsToRemove.length > 0) {

      lightConnectionsToRemove.forEach(conn => {
        try {

          const lightData = conn.lightBlock || conn.officeLightBlock;
          if (!lightData) return;

          const lightBlock = dimension.getBlock({
            x: lightData.x,
            y: lightData.y,
            z: lightData.z
          });
          if (lightBlock && isLightType(lightBlock.typeId)) {
            try {
              const newPerm = lightBlock.permutation.withState("fr:lit", false);
              lightBlock.setPermutation(newPerm);
            } catch { }
          }

          const key = `${lightData.dimensionId}_${lightData.x}_${lightData.y}_${lightData.z}`;
          const location = {
            x: lightData.x + 0.5,
            y: lightData.y + 0.5,
            z: lightData.z + 0.5
          };

          const storedVfx = hallwayLampVfxEntities[key];
          const vfxType = storedVfx?.vfxType || getVfxEntityForLight(lightData.typeId || (lightBlock ? lightBlock.typeId : "fr:office_light"));
          try {
            dimension.runCommand(`execute at @e[type=${vfxType}] positioned ${location.x} ${location.y} ${location.z} run event entity @e[r=0.5] destroy`);
          } catch { }
          if (hallwayLampVfxEntities[key]) {
            delete hallwayLampVfxEntities[key];
          }
        } catch { }
      });

      connections = connections.filter(conn =>
        !(conn.doorBlock.x === doorBlockPos.x &&
          conn.doorBlock.y === doorBlockPos.y &&
          conn.doorBlock.z === doorBlockPos.z &&
          conn.doorBlock.dimensionId === doorBlockPos.dimensionId)
      );
      setConnections(connections);
    }


    let woodenDoorConnections = getWoodenDoorConnections();
    const doorConnectionsToRemove = woodenDoorConnections.filter(conn =>
      conn.doorBlock.x === doorBlockPos.x &&
      conn.doorBlock.y === doorBlockPos.y &&
      conn.doorBlock.z === doorBlockPos.z &&
      conn.doorBlock.dimensionId === doorBlockPos.dimensionId
    );

    if (doorConnectionsToRemove.length > 0) {
      woodenDoorConnections = woodenDoorConnections.filter(conn =>
        !(conn.doorBlock.x === doorBlockPos.x &&
          conn.doorBlock.y === doorBlockPos.y &&
          conn.doorBlock.z === doorBlockPos.z &&
          conn.doorBlock.dimensionId === doorBlockPos.dimensionId)
      );
      setWoodenDoorConnections(woodenDoorConnections);
    }

    const totalRemoved = lightConnectionsToRemove.length + doorConnectionsToRemove.length;
    if (totalRemoved > 0 && player) {
      player.sendMessage(`§c${totalRemoved} connection(s) removed: door_buttons block destroyed.`);
    }

    const generatorLinkRemoved = removeDoorButtonGeneratorLink(doorBlockPos);
    if (generatorLinkRemoved && player) {
      player.sendMessage(`§7Generator connection removed: door_buttons block destroyed.`);
    }

    if (player) {
      pendingConnections.delete(player.name);
      pendingWoodenDoorConnections.delete(player.name);
      selectedDoorButton.delete(player.name);
      clearSelection(player.id);
    }
  }
});

function updateLightTestActionBarForPlayer(player) {
  const viewData = player.getBlockFromViewDirection({ maxDistance: 7.5 });
  const block = viewData?.block;
  const dimension = player.dimension;
  let message = "";
  const equippable = player.getComponent("minecraft:equippable");
  const mainhand = equippable?.getEquipmentSlot(EquipmentSlot.Mainhand);
  const heldId = mainhand?.hasItem() ? mainhand.typeId : null;
  const isFazDiver = typeof heldId === "string" && heldId.startsWith("fr:faz-diver_");

  if ((pendingConnections.has(player.name) || pendingWoodenDoorConnections.has(player.name)) && (!block || (block.typeId !== "fr:office_light" && block.typeId !== "fr:office_door" && block.typeId !== "fr:door_buttons"))) {
    if (!isFazDiver) {
      player.onScreenDisplay.setActionBar({ rawtext: [{ text: "" }] });
      return;
    }
    let doorBlockPos = selectedDoorButton.get(player.name) || { x: 0, y: 0, z: 0, dimensionId: dimension.id };

    const lightConnections = getConnections().filter(conn =>
      conn.doorBlock.x === doorBlockPos.x &&
      conn.doorBlock.y === doorBlockPos.y &&
      conn.doorBlock.z === doorBlockPos.z &&
      conn.doorBlock.dimensionId === doorBlockPos.dimensionId
    ).length;
    const doorConnections = getWoodenDoorConnections().filter(conn =>
      conn.doorBlock.x === doorBlockPos.x &&
      conn.doorBlock.y === doorBlockPos.y &&
      conn.doorBlock.z === doorBlockPos.z &&
      conn.doorBlock.dimensionId === doorBlockPos.dimensionId
    ).length;

    const title = "§l§fDoor Buttons§r";
    const coords = `(${doorBlockPos.x}, ${doorBlockPos.y}, ${doorBlockPos.z})`;
    const selection = pendingConnections.has(player.name) ? "Light" : "Door";

    message = `${title}\n §7Door Links: ${doorConnections}/5\n §7Light Links: ${lightConnections}/5\n §7Coords: ${coords}\n §7Selection: ${selection}`;
  } else {
    if (!isFazDiver) {
      if (!pendingConnections.has(player.name) && !pendingWoodenDoorConnections.has(player.name)) {
        selectedDoorButton.delete(player.name);
        player.onScreenDisplay.setActionBar({ rawtext: [{ text: "" }] });
      }
      return;
    }

    if (block) {
      if (block.typeId === "fr:office_light") {
        const connection = getConnectionByOfficeLightBlock(block, dimension);
        if (connection) {
          const isLit = block.permutation.getState("fr:lit") === true;
          const stateText = isLit ? "On" : "Off";
          const stateColor = isLit ? "§q" : "§c";
          const linkedColor = isLit ? "§q§l" : "§c§l";
          const coords = `(${connection.doorBlock.x}, ${connection.doorBlock.y}, ${connection.doorBlock.z})`;
          message = `${linkedColor} Linked to Door buttons§r\n §7Coords: ${coords}\n${stateColor} Status: ${stateText}`;
          if (pendingConnections.has(player.name) || pendingWoodenDoorConnections.has(player.name)) {
            const selection = pendingConnections.has(player.name) ? "Light" : "Door";
            message += `\n §7Selection: ${selection}`;
          }
        } else {
          message = " §l§6Unlinked§r";
        }
      } else if (block.typeId === "fr:office_door") {
        const connection = getConnectionByWoodenDoorBlock(block, dimension);
        if (connection) {
          const isOpen = block.permutation.getState("fr:door_open") === true;
          const stateText = isOpen ? "Open" : "Closed";
          const stateColor = isOpen ? "§q" : "§c";
          const linkedColor = isOpen ? "§q§l" : "§c§l";
          const coords = `(${connection.doorBlock.x}, ${connection.doorBlock.y}, ${connection.doorBlock.z})`;
          message = `${linkedColor} Linked to Door buttons§r\n §7Coords: ${coords}\n${stateColor} Status: ${stateText}`;
          if (pendingConnections.has(player.name) || pendingWoodenDoorConnections.has(player.name)) {
            const selection = pendingConnections.has(player.name) ? "Light" : "Door";
            message += `\n §7Selection: ${selection}`;
          }
        } else {
          message = " §l§6Unlinked§r";
        }
      } else if (block.typeId === "fr:door_buttons") {
        const doorBlockPos = {
          x: block.location.x,
          y: block.location.y,
          z: block.location.z,
          dimensionId: dimension.id,
        };
        const lightConnections = getConnections().filter(conn =>
          conn.doorBlock.x === doorBlockPos.x &&
          conn.doorBlock.y === doorBlockPos.y &&
          conn.doorBlock.z === doorBlockPos.z &&
          conn.doorBlock.dimensionId === doorBlockPos.dimensionId
        ).length;
        const doorConnections = getWoodenDoorConnections().filter(conn =>
          conn.doorBlock.x === doorBlockPos.x &&
          conn.doorBlock.y === doorBlockPos.y &&
          conn.doorBlock.z === doorBlockPos.z &&
          conn.doorBlock.dimensionId === doorBlockPos.dimensionId
        ).length;
        const totalConnections = lightConnections + doorConnections;
        const title = "§l§fDoor Buttons§r";
        const coords = `(${doorBlockPos.x}, ${doorBlockPos.y}, ${doorBlockPos.z})`;
        const limit = getDoorButtonLimit();
        message = `${title}\n §7Total Links: ${totalConnections}/${limit}\n §7(Doors: ${doorConnections}, Lights: ${lightConnections})`;

        if (pendingConnections.has(player.name) || pendingWoodenDoorConnections.has(player.name)) {
          const selection = pendingConnections.has(player.name) ? "Light" : "Door";
          message += `\n §7Selection: ${selection}`;
        }
        selectedDoorButton.set(player.name, doorBlockPos);
      } else {
        selectedDoorButton.delete(player.name);
        message = "";
      }
    } else {
      selectedDoorButton.delete(player.name);
      message = "";
    }
  }

  system.run(() => {
    try {
      player.onScreenDisplay.setActionBar({ rawtext: [{ text: message }] });
    } catch { }
  });
}



system.runInterval(() => {
  const players = world.getPlayers();
  if (players.length === 0) return;
  for (const player of players) {
    updateLightTestActionBarForPlayer(player);
  }
}, 20);
