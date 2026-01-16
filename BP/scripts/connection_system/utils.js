/**
 * FAZBEAR'S RESTOCKED - BEDROCK
 * ©2025
 * 
 * If you want to modify or use this system as a base, contact the code developer, 
 * Hyrxs (discord: hyrxs), for more information and authorization
 * 
 * DO NOT COPY OR STEAL, ty :>ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ 
 *  
*/

import { system, world, BlockPermutation } from "@minecraft/server";
import { getVfxEntityForLight } from "./connection_types.js";

export function adjustTextLength(text = '', totalLength = 100) {
  return (text.slice(0, totalLength)).padEnd(totalLength, '\t');
}

export function dynamicToast(title = '', message = '', icon = '', background = 'textures/ui/greyBorder') {
  return "§我§的§我§国" +
    adjustTextLength(title, 100) +
    adjustTextLength(message, 200) +
    adjustTextLength(icon, 100) +
    adjustTextLength(background, 100);
}

export function dynamicToastEvent(text) {
  const contents = text.split('|');
  if (contents[3] === undefined) { contents[3] = 'textures/ui/greyBorder'; }
  return "§我§的§我§国" +
    adjustTextLength(contents[0], 100) +
    adjustTextLength(contents[1], 200) +
    adjustTextLength(contents[2], 100) +
    adjustTextLength(contents[3], 100);
}

export let lampVfxEntities = {};

const VFX_ENTITY_TYPES = [
  "fr:office_lamp_vfx",
  "fr:stage_spotlight_vfx",
  "fr:hallway_lamp_vfx",
  "fr:pizzeria_lamp_vfx",
  "fr:ceiling_light_vfx",
  "fr:pirate_cove_light_entity"
];

export { VFX_ENTITY_TYPES };

export function getExistingVfxEntity(dimension, location, vfxType) {
  try {
    const entities = dimension.getEntities({ 
      type: vfxType, 
      location: location, 
      maxDistance: 1.5 
    });
    return entities.length > 0 ? entities[0] : null;
  } catch {
    return null;
  }
}

export function findAnyVfxEntityAtLocation(dimension, location) {
  for (const vfxType of VFX_ENTITY_TYPES) {
    const entity = getExistingVfxEntity(dimension, location, vfxType);
    if (entity) return { entity, vfxType };
  }
  return null;
}

export function rebuildVfxCache(connections, getVfxEntityForLight) {
  lampVfxEntities = {};
  
  for (const conn of connections) {
    try {
      const dimension = world.getDimension(conn.light.dimensionId);
      const location = { x: conn.light.x + 0.5, y: conn.light.y + 0.5, z: conn.light.z + 0.5 };
      const key = `${conn.light.dimensionId}_${conn.light.x}_${conn.light.y}_${conn.light.z}`;
      
      const found = findAnyVfxEntityAtLocation(dimension, location);
      if (found) {
        lampVfxEntities[key] = { vfxType: found.vfxType, entity: found.entity };
      }
    } catch { }
  }
}

export function hasExistingVfxAtLocation(dimension, location) {
  for (const vfxType of VFX_ENTITY_TYPES) {
    try {
      const entities = dimension.getEntities({ 
        type: vfxType, 
        location: location, 
        maxDistance: 1.5 
      });
      if (entities.length > 0) return true;
    } catch { }
  }
  return false;
}

export function cleanupLampVfxEntitiesSilent() {
  const dimensions = ["overworld", "nether", "the_end"];
  dimensions.forEach(dimName => {
    try {
      const dimension = world.getDimension(dimName);
      VFX_ENTITY_TYPES.forEach(vfxType => {
        try {
          // Usar getEntities para eliminar entidades cargadas
          const entities = dimension.getEntities({ type: vfxType });
          entities.forEach(entity => {
            try {
              entity.triggerEvent("destroy");
            } catch {
              try { entity.remove(); } catch { }
            }
          });
        } catch { }
        try {
          // Fallback con comando para entidades que no se alcanzaron
          dimension.runCommand(`event entity @e[type=${vfxType}] destroy`);
        } catch { }
      });
    } catch { }
  });
  lampVfxEntities = {};
}

export function cleanupLampVfxEntitiesOnReload() {
  system.runTimeout(() => {
    cleanupLampVfxEntitiesSilent();
    
    const elapsedTime = Date.now();
    world.getPlayers().forEach(player => {
      player.sendMessage(dynamicToast(
        "§l§qSUCCESS",
        `§qScripts reloaded...\n§7Time: ${elapsedTime}ms`,
        "textures/fr_ui/approve_icon",
        "textures/fr_ui/approve_ui"
      ));
    });
  }, 3);
}

export function getLinePoints(pos1, pos2, numPoints) {
  const start = { x: pos1.x + 0.5, y: pos1.y + 0.5, z: pos1.z + 0.5 };
  const end = { x: pos2.x + 0.5, y: pos2.y + 0.5, z: pos2.z + 0.5 };
  const points = [];
  const dx = (end.x - start.x) / (numPoints - 1);
  const dy = (end.y - start.y) / (numPoints - 1);
  const dz = (end.z - start.z) / (numPoints - 1);
  for (let i = 0; i < numPoints; i++) {
    points.push({
      x: start.x + dx * i,
      y: start.y + dy * i,
      z: start.z + dz * i,
    });
  }
  return points;
}

export function turnOffLight(connection, LIGHT_TYPES) {
  const lightDimension = world.getDimension(connection.light.dimensionId);
  const lightBlock = lightDimension.getBlock({
    x: connection.light.x,
    y: connection.light.y,
    z: connection.light.z,
  });
  if (lightBlock && LIGHT_TYPES.has(lightBlock.typeId)) {
    const newPerm = lightBlock.permutation.withState("fr:lit", false);
    lightBlock.setPermutation(newPerm);
  }

  const dimension = world.getDimension(connection.light.dimensionId);
  const location = { x: connection.light.x + 0.5, y: connection.light.y + 0.5, z: connection.light.z + 0.5 };

  let vfxType = null;
  const key = `${connection.light.dimensionId}_${connection.light.x}_${connection.light.y}_${connection.light.z}`;

  if (lampVfxEntities[key]) {
    vfxType = lampVfxEntities[key].vfxType || (lampVfxEntities[key].isStageSpotlight ? "fr:stage_spotlight_vfx" : "fr:office_lamp_vfx");
    delete lampVfxEntities[key];
  } else if (lightBlock) {
    vfxType = getVfxEntityForLight(lightBlock.typeId);
  }

  if (vfxType) {
    if (vfxType === "fr:pirate_cove_light_entity") {
      const pirateLocation = { x: connection.light.x + 0.5, y: connection.light.y + 0.4, z: connection.light.z + 0.5 };
      dimension.runCommand(`execute at @e[type=${vfxType}] positioned ${pirateLocation.x} ${pirateLocation.y} ${pirateLocation.z} run event entity @e[r=1.5] destroy`);
    } else {
      dimension.runCommand(`execute at @e[type=${vfxType}] positioned ${location.x} ${location.y} ${location.z} run event entity @e[r=0.5] destroy`);
    }
  }
}

