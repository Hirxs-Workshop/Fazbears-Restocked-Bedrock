/**
 * FAZBEAR'S RESTOCKED - BEDROCK
 * ©2026
 *
 * If you want to modify or use this system as a base, contact the code developer,
 * Hyrxs (discord: hyrxs), for more information and authorization
 *
 * DO NOT COPY OR STEAL, ty :>ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ
 *
*/

import { world, system, ItemStack, BlockPermutation } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import {
  startAStarRouteTest,
  cancelAStarRouteTest,
  initAStarPathfinding,
  getActiveAStarRouteTests,
  startPathfinding,
  stopPathfinding,
  hasActivePathfinding,
  getSessionByEntityId,
} from "./astar_pathfinding.js";
import {
  broadcastDebug,
  isCreativeMode,
  safeRun,
  safeGet,
  distance3D as getDistance
} from "../utils.js";
import { dynamicToast } from "../connection_system/utils.js";
const DEBUG_MODE = false;
function debugLog(message, ...args) {
  if (DEBUG_MODE) {
    const details = args.map(a => {
      if (Array.isArray(a) && a.length > 3) return `[Array(${a.length})]`;
      return typeof a === 'object' ? JSON.stringify(a) : a;
    }).join(' ');
    broadcastDebug(`${message} ${details}`, "§b[NightMode]");
  }
}
function debugWarn(...args) {
  if (DEBUG_MODE) console.warn("[NightMode]", ...args);
}
const STATUE_TO_ANIMATRONIC = {
  "fr:bonnie_statue": "fr:fnaf1_bonnie_entity",
  "fr:chica_statue": "fr:fnaf1_chica_entity",
  "fr:foxy_statue": "fr:fnaf1_foxy_entity",
  "fr:freddy_fazbear_statue": "fr:fnaf1_freddy_entity",
  "fr:sparky_statue": "fr:fnaf1_sparky_entity",
};
const ANIMATRONIC_TO_STATUE = {
  "fr:fnaf1_bonnie_entity": "fr:bonnie_statue",
  "fr:fnaf1_chica_entity": "fr:chica_statue",
  "fr:fnaf1_foxy_entity": "fr:foxy_statue",
  "fr:fnaf1_freddy_entity": "fr:freddy_fazbear_statue",
  "fr:fnaf1_sparky_entity": "fr:sparky_statue",
};
export const NIGHT_START_TICKS = 13000;
export const NIGHT_END_TICKS = 23000;
export const MAX_ROUTE_POINTS = 64;
export const MAX_ANIMATRONICS_PER_STAGEPLATE = 1;
export const MIN_WAIT_TIME = 60;
export const MAX_WAIT_TIME = 12000;
export const DEFAULT_WAIT_TIME = 200;
export const AI_LEVEL_CONFIG = {
  MIN_LEVEL: 0,
  MAX_LEVEL: 20,
  DEFAULT_LEVEL: 10,
  MOVE_SPEED_MULTIPLIER: 0.05,
  WAIT_TIME_REDUCTION: 0.03,
  DETECTION_RANGE_BONUS: 0.5,
  AGGRESSION_CHANCE: 0.02,
  BASE_MOVE_SPEED: 0.06,
  BASE_WAIT_TIME_MULTIPLIER: 1.5,
  BASE_DETECTION_RANGE: 15,
};
const DETECTION_INTERVAL_TICKS = 20;

function isSurvival(player) {
  try {
    const gm = player.getGameMode();
    const gmStr = String(gm).toLowerCase();

    if (gmStr === "creative" || gmStr === "1" || gmStr === "spectator" || gmStr === "3") {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

function findNearestSurvivalPlayer(sourceEntity, maxRange) {
  try {
    const dimension = sourceEntity.dimension;
    const position = sourceEntity.location;
    const players = dimension.getPlayers({
      location: position,
      maxDistance: maxRange,
    });
    let nearestResult = null;
    let minDistance = Infinity;

    const rotation = sourceEntity.getRotation();
    const yawRad = (rotation.y + 90) * (Math.PI / 180);
    const forward = {
      x: -Math.cos(yawRad),
      z: Math.sin(yawRad)

    };

    const ry = -rotation.y * (Math.PI / 180);

    const viewDir = {
      x: -Math.sin(rotation.y * (Math.PI / 180)),
      z: Math.cos(rotation.y * (Math.PI / 180))
    };

    for (const player of players) {
      if (!isSurvival(player)) continue;

      let effectiveRange = maxRange;
      const isSneaking = player.isSneaking;

      const dx = player.location.x - position.x;
      const dz = player.location.z - position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= 0.1) {
        effectiveRange = maxRange;
      } else {

        const dirToPlayer = { x: dx / dist, z: dz / dist };
        const dot = viewDir.x * dirToPlayer.x + viewDir.z * dirToPlayer.z;

        const inFov = dot > 0.4;

        if (isSneaking) {
          if (inFov) {
            effectiveRange = maxRange * 0.6;
          } else {
            effectiveRange = 0;
          }
        } else {
          if (inFov) {
            effectiveRange = maxRange;
          } else {
            effectiveRange = maxRange * 0.3;
          }
        }
      }

      if (dist < minDistance && dist <= effectiveRange) {
        minDistance = dist;
        nearestResult = { player, distance: dist };
      }
    }
    return nearestResult;
  } catch { return null; }
}
export const NIGHT_MODE_CONFIG = {
  USE_RANDOM_WAYPOINTS: true,
  RANDOM_CHANCE: 0.7,
  REVISIT_COOLDOWN_MS: 30000,
  MIN_ACTIVE_TIME_MS: 5000,
  MAX_IDLE_TIME_MS: 60000,
};
export const PATHING_CONFIG = {
  MOVE_SPEED: 0.08,
  ARRIVAL_DISTANCE: 2.0,
  STUCK_TIMEOUT_MS: 45000,
  STUCK_CHECK_INTERVAL_MS: 5000,
  MIN_PROGRESS_DISTANCE: 0.5,
  MAX_RETRIES: 3,
  TELEPORT_FALLBACK: true,
  PATH_DRAW_INTERVAL: 3,
  MAX_PATH_SEARCH: 1500,
};
export const ANIMATRONIC_TYPES = [
  "fr:fnaf1_bonnie_entity",
  "fr:fnaf1_chica_entity",
  "fr:fnaf1_foxy_entity",
  "fr:fnaf1_freddy_entity",
  "fr:fnaf1_sparky_entity",
  "fr:bonnie_statue",
  "fr:chica_statue",
  "fr:foxy_statue",
  "fr:freddy_fazbear_statue",
  "fr:sparky_statue",
];
export const STATUE_TYPES = [
  "fr:bonnie_statue",
  "fr:chica_statue",
  "fr:foxy_statue",
  "fr:freddy_fazbear_statue",
  "fr:sparky_statue",
];
export const EFFECT_TYPES = {
  NONE: "none",
  CAMERA_FORCE_SWITCH: "camera_force_switch",
  SCREEN_FADE: "screen_fade",
  EMIT_SOUND: "emit_sound",
  CAMERA_BLACKOUT: "camera_blackout",
};
export const NEXT_ROUTE_MODE = {
  RANDOM: "random",
  SEQUENTIAL: "sequential",
  SPECIFIC: "specific",
};
const stageplateRegistry = new Map();
const playerSelections = new Map();
const routePointRegistry = new Map();
const activePathingSessions = new Map();
const nightModeRegistry = new Map();
const aiLevelRegistry = new Map();
const nightPathingState = new Map();
const activeNightEntities = new Map();
const walkingEntities = new Map();
const routeTestSessions = new Map();
let nextSessionId = 1;
let nextRoutePointId = 1;
export function getStageplateKey(location, dimensionId) {
  const x = Math.floor(location.x);
  const y = Math.floor(location.y);
  const z = Math.floor(location.z);
  const dimShort = dimensionId.replace("minecraft:", "");
  return `fr:sp_${x}_${y}_${z}_${dimShort}`;
}
export function getWaypointData(location, dimensionId) {
  const key = getWaypointKey(location, dimensionId);
  const data = world.getDynamicProperty(key);
  const defaultData = {
    order: 0,
    pose: 0,
    rotation: 0,
    waitTime: 0,
    linkedStatueId: 0,
    abilities: [],
  };
  if (!data) return defaultData;
  try {
    const parsed = JSON.parse(data);
    return {
      ...defaultData,
      ...parsed
    };
  } catch {
    return defaultData;
  }
}
export function setWaypointData(location, dimensionId, data) {
  const key = getWaypointKey(location, dimensionId);
  world.setDynamicProperty(key, JSON.stringify(data));
}
export function removeWaypointData(location, dimensionId) {
  const key = getWaypointKey(location, dimensionId);
  world.setDynamicProperty(key, undefined);
}
export function getWaypointsForStatue(statueId) {
  const waypoints = [];
  const allKeys = world.getDynamicPropertyIds();
  for (const key of allKeys) {
    if (!key.startsWith("fr:wp_")) continue;
    const data = world.getDynamicProperty(key);
    if (!data) continue;
    try {
      const wpData = JSON.parse(data);
      if (wpData.linkedStatueId === statueId) {
        const parts = key.replace("fr:wp_", "").split("_");
        const x = parseInt(parts[0]);
        const y = parseInt(parts[1]);
        const z = parseInt(parts[2]);
        const dimId = "minecraft:" + parts[3];
        waypoints.push({
          location: {
            x: x + 0.5,
            y,
            z: z + 0.5
          },
          dimensionId: dimId,
          order: wpData.order,
          pose: wpData.pose,
          rotation: wpData.rotation || 0,
          waitTime: wpData.waitTime,
          abilities: wpData.abilities || [],
        });
      }
    } catch { }
  }
  waypoints.sort((a, b) => a.order - b.order);
  return waypoints;
}
export function getWaypointKey(location, dimensionId) {
  const x = Math.floor(location.x);
  const y = Math.floor(location.y);
  const z = Math.floor(location.z);
  const dimShort = dimensionId.replace("minecraft:", "");
  return `fr:wp_${x}_${y}_${z}_${dimShort}`;
}
export function refreshWaypointCache(statueId) {
  const newWaypoints = getWaypointsForStatue(statueId);
  if (newWaypoints.length > 0) {
  } else {
  }
  return newWaypoints;
}
export function getOrCreateStatueId(entity) {
  let statueId = entity.getDynamicProperty("fr:statue_id");
  if (!statueId) {
    let counter = world.getDynamicProperty("fr:statue_id_counter") || 1;
    statueId = counter;
    entity.setDynamicProperty("fr:statue_id", statueId);
    world.setDynamicProperty("fr:statue_id_counter", counter + 1);
  }
  return statueId;
}
export function startBlockSelectorMode(player, statueId, entityName) {
  return false;
}
export function cancelBlockSelectorMode(player) {
}
export function isInBlockSelectorMode(player) {
  return false;
}
export function clearAllWaypointsForStatue(statueId) {
  const allKeys = world.getDynamicPropertyIds();
  for (const key of allKeys) {
    if (!key.startsWith("fr:wp_")) continue;
    const data = world.getDynamicProperty(key);
    if (!data) continue;
    try {
      const wpData = JSON.parse(data);
      if (wpData.linkedStatueId === statueId) {
        world.setDynamicProperty(key, undefined);
      }
    } catch { }
  }
}
export function startPathingSimulation(statue, player, maxWaypoints) {
}
export function startRouteTest(entity, player) {
}
export function cancelRouteTestForEntity(entityId) {
  return false;
}
export function isEntityInRouteTest(entityId) {
  return false;
}
export const ABILITY_TYPES = {
  NONE: "none",
  CAMERA_BLACKOUT: "camera_blackout",
  EMIT_SOUND: "emit_sound",
};
export function getRoutePointKey(location, dimensionId) {
  const x = Math.floor(location.x);
  const y = Math.floor(location.y);
  const z = Math.floor(location.z);
  const dimShort = dimensionId.replace("minecraft:", "");
  return `fr:rp_${x}_${y}_${z}_${dimShort}`;
}
export function getDistance(pos1, pos2) {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
export function getHorizontalDistance(pos1, pos2) {
  const dx = pos2.x - pos1.x;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dz * dz);
}
export function normalizeRotation(rotation) {
  let normalized = rotation % 360;
  if (normalized < 0) normalized += 360;
  return Math.round(normalized / 45) * 45;
}

function normalizeCompassRotationToYaw(rotationValue) {
  if (rotationValue === undefined || rotationValue === null) return 0;
  const rotNum = Number(rotationValue);
  if (!Number.isFinite(rotNum)) return 0;
  const compassDeg =
    Math.abs(rotNum) <= Math.PI * 2 + 0.001 && !Number.isInteger(rotNum)
      ? (rotNum * 180) / Math.PI
      : rotNum;
  return (((Math.round(compassDeg) % 360) + 360) % 360);
}
export function isNightTime() {
  try {
    const time = world.getTimeOfDay();
    const isNight = time >= NIGHT_START_TICKS || time < 1000;
    return isNight;
  } catch (e) {
    console.warn("[NightMode] Error checking time:", e);
    return false;
  }
}
export function getTimeString() {
  try {
    const time = world.getTimeOfDay();
    const hours = Math.floor(((time + 6000) % 24000) / 1000);
    const minutes = Math.floor(((time + 6000) % 1000) / 16.67);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes.toString().padStart(2, "0")}${period}`;
  } catch (e) {
    return "Unknown";
  }
}
export function validateWaitTime(waitTime) {
  if (waitTime < MIN_WAIT_TIME) return MIN_WAIT_TIME;
  if (waitTime > MAX_WAIT_TIME) return MAX_WAIT_TIME;
  return Math.floor(waitTime);
}
export function isAnimatronic(entity) {
  return entity && ANIMATRONIC_TYPES.includes(entity.typeId);
}
export function isStatue(entity) {
  return entity && STATUE_TYPES.includes(entity.typeId);
}
export function getOrCreateAnimatronicId(entity) {
  let animatronicId = entity.getDynamicProperty("fr:animatronic_id");
  if (!animatronicId) {
    let counter = world.getDynamicProperty("fr:animatronic_id_counter") || 1;
    animatronicId = counter;
    entity.setDynamicProperty("fr:animatronic_id", animatronicId);
    world.setDynamicProperty("fr:animatronic_id_counter", counter + 1);
  }
  return animatronicId;
}
export function getAnimatronicRouteId(entity) {
  return entity.getDynamicProperty("fr:route_id") || 0;
}
export function setAnimatronicRouteId(entity, routeId) {
  entity.setDynamicProperty("fr:route_id", routeId);
}
export function registerStageplate(location, dimensionId) {
  const key = getStageplateKey(location, dimensionId);
  const existingData = world.getDynamicProperty(key);
  let stageplateData;
  if (existingData) {
    try {
      stageplateData = JSON.parse(existingData);
    } catch {
      stageplateData = null;
    }
  }
  if (!stageplateData) {
    stageplateData = {
      location: {
        x: Math.floor(location.x),
        y: Math.floor(location.y),
        z: Math.floor(location.z),
      },
      dimensionId: dimensionId,
      linkedAnimatronics: [],
    };
    world.setDynamicProperty(key, JSON.stringify(stageplateData));
  }
  stageplateRegistry.set(key, stageplateData);
  return key;
}
export function unregisterStageplate(location, dimensionId) {
  const key = getStageplateKey(location, dimensionId);
  stageplateRegistry.delete(key);
  world.setDynamicProperty(key, undefined);
}
export function getStageplateData(location, dimensionId) {
  const key = getStageplateKey(location, dimensionId);
  if (stageplateRegistry.has(key)) {
    return stageplateRegistry.get(key);
  }
  const data = world.getDynamicProperty(key);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      stageplateRegistry.set(key, parsed);
      return parsed;
    } catch {
      return null;
    }
  }
  return null;
}
export function updateStageplateData(key, data) {
  stageplateRegistry.set(key, data);
  world.setDynamicProperty(key, JSON.stringify(data));
}
export function cleanupOrphanedLinks(stageplateLocation, dimensionId) {
  const stageplateData = getStageplateData(stageplateLocation, dimensionId);
  if (!stageplateData || !stageplateData.linkedAnimatronics) return 0;
  const dimension = world.getDimension(dimensionId);
  const originalCount = stageplateData.linkedAnimatronics.length;
  const validLinks = stageplateData.linkedAnimatronics.filter((link) => {
    try {
      const nearbyEntities = dimension.getEntities({
        location: stageplateLocation,
        maxDistance: 50,
      });
      for (const entity of nearbyEntities) {
        const entityAnimatronicId =
          entity.getDynamicProperty("fr:animatronic_id");
        if (entityAnimatronicId === link.animatronicId) {
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  });
  const removedCount = originalCount - validLinks.length;
  if (removedCount > 0) {
    stageplateData.linkedAnimatronics = validLinks;
    const key = getStageplateKey(stageplateLocation, dimensionId);
    updateStageplateData(key, stageplateData);
    console.log(`[Stageplate] Cleaned up ${removedCount}orphaned links`);
  }
  return removedCount;
}
export function selectStageplate(player, stageplateLocation, dimensionId) {
  let stageplateData = getStageplateData(stageplateLocation, dimensionId);
  if (!stageplateData) {
    registerStageplate(stageplateLocation, dimensionId);
    stageplateData = getStageplateData(stageplateLocation, dimensionId);
  }
  const key = getStageplateKey(stageplateLocation, dimensionId);
  const cleanedCount = cleanupOrphanedLinks(stageplateLocation, dimensionId);
  if (cleanedCount > 0) {
    player.sendMessage(
      dynamicToast(
        "§l§gCleanup",
        `§7Cleaned up §f${cleanedCount}§7 orphaned link(s).`,
        "textures/fr_ui/warning_icon",
        "textures/fr_ui/warning_ui",
      ),
    );
    stageplateData = getStageplateData(stageplateLocation, dimensionId);
  }
  if (
    stageplateData.linkedAnimatronics.length >= MAX_ANIMATRONICS_PER_STAGEPLATE) {
    player.sendMessage(
      dynamicToast(
        "§l§cFull",
        `§7This platform already has §f${MAX_ANIMATRONICS_PER_STAGEPLATE}§7 animatronics linked!`,
        "textures/fr_ui/deny_icon",
        "textures/fr_ui/deny_ui",
      ),
    );
    return false;
  }
  playerSelections.set(player.id, {
    selectedStageplateKey: key,
    selectedStageplateLocation: {
      x: Math.floor(stageplateLocation.x),
      y: Math.floor(stageplateLocation.y),
      z: Math.floor(stageplateLocation.z),
    },
    selectedDimensionId: dimensionId,
    timestamp: Date.now(),
  });
  const linkedCount = stageplateData.linkedAnimatronics.length;
  player.sendMessage(
    dynamicToast(
      "§l§qPlatform Selected",
      `§7Now right-click on an §fanimatronic§7\nto link it! §8(${linkedCount}/${MAX_ANIMATRONICS_PER_STAGEPLATE})`,
      "textures/fr_ui/approve_icon",
      "textures/fr_ui/approve_ui",
    ),
  );
  return true;
}
export function getPlayerSelection(player) {
  const selection = playerSelections.get(player.id);
  if (selection && Date.now() - selection.timestamp > 60000) {
    playerSelections.delete(player.id);
    return null;
  }
  return selection;
}
export function clearPlayerSelection(player) {
  playerSelections.delete(player.id);
}
export function linkAnimatronicToStageplate(player, entity) {
  const selection = getPlayerSelection(player);
  if (!selection || !selection.selectedStageplateKey) {
    player.sendMessage(
      dynamicToast(
        "§l§cNo Platform",
        `§7No platform selected! Right-click on a\n§ffr:stage_platform§7 first.`,
        "textures/fr_ui/deny_icon",
        "textures/fr_ui/deny_ui",
      ),
    );
    return false;
  }
  if (!isAnimatronic(entity)) {
    player.sendMessage(
      dynamicToast(
        "§l§cInvalid Entity",
        "§7This entity cannot be linked to a platform.",
        "textures/fr_ui/deny_icon",
        "textures/fr_ui/deny_ui",
      ),
    );
    return false;
  }
  const animatronicId = getOrCreateAnimatronicId(entity);
  const stageplateLocation = selection.selectedStageplateLocation;
  const dimensionId = selection.selectedDimensionId;
  const dimension = world.getDimension(dimensionId.replace("minecraft:", ""));
  let stageplateData = getStageplateData(stageplateLocation, dimensionId);
  if (!stageplateData) {
    player.sendMessage(
      dynamicToast(
        "§l§cNot Found",
        "§7Platform no longer exists. Please select again.",
        "textures/fr_ui/deny_icon",
        "textures/fr_ui/deny_ui",
      ),
    );
    clearPlayerSelection(player);
    return false;
  }
  if (
    stageplateData.linkedAnimatronics.length >= MAX_ANIMATRONICS_PER_STAGEPLATE) {
    player.sendMessage(
      dynamicToast(
        "§l§cFull",
        `§7Maximum of §f${MAX_ANIMATRONICS_PER_STAGEPLATE}§7 animatronics per platform reached!`,
        "textures/fr_ui/deny_icon",
        "textures/fr_ui/deny_ui",
      ),
    );
    clearPlayerSelection(player);
    return false;
  }
  const entityRotation = entity.getRotation();
  const currentPose = entity.getDynamicProperty("fr:pose_index") || 0;
  const currentVariant = entity.getDynamicProperty("fr:variant_index") || 0;
  const existingIndex = stageplateData.linkedAnimatronics.findIndex(
    (a) => a.animatronicId === animatronicId);
  const linkData = {
    animatronicId: animatronicId,
    entityType: entity.typeId,
    pose: currentPose,
    variant: currentVariant,
    rotation: normalizeRotation(entityRotation.y),
    linkedAt: Date.now(),
  };
  const entityName =
    entity.nameTag || entity.typeId.replace("fr:", "").replace(/_/g, " ");
  if (existingIndex >= 0) {
    stageplateData.linkedAnimatronics[existingIndex] = linkData;
    player.sendMessage(
      dynamicToast(
        "§l§aUpdated",
        `§7Updated §f${entityName}§7 link with\ncurrent pose and rotation.`,
        "textures/fr_ui/approve_icon",
        "textures/fr_ui/approve_ui",
      ),
    );
  } else {
    stageplateData.linkedAnimatronics.push(linkData);
    player.sendMessage(
      dynamicToast(
        "§l§qSUCCESS",
        `§f${entityName}§7 linked successfully!\n§8(${stageplateData.linkedAnimatronics.length}/${MAX_ANIMATRONICS_PER_STAGEPLATE})`,
        "textures/fr_ui/approve_icon",
        "textures/fr_ui/approve_ui",
      ),
    );
  }
  const key = selection.selectedStageplateKey;
  updateStageplateData(key, stageplateData);
  try {
    entity.setDynamicProperty("fr:linked_stageplate", key);
  } catch { }
  if (!getAnimatronicRouteId(entity)) {
    let routeCounter = world.getDynamicProperty("fr:route_id_counter") || 1;
    setAnimatronicRouteId(entity, routeCounter);
    world.setDynamicProperty("fr:route_id_counter", routeCounter + 1);
  }
  const spawnLocation = {
    x: stageplateLocation.x + 0.5,
    y: stageplateLocation.y + 1,
    z: stageplateLocation.z + 0.5,
  };
  entity.teleport(spawnLocation, {
    dimension: dimension,
    rotation: {
      x: 0, y: linkData.rotation
    },
  });
  const platformLocationData = JSON.stringify({
    x: spawnLocation.x,
    y: spawnLocation.y,
    z: spawnLocation.z,
    dimensionId: dimensionId,
  });
  try {
    entity.setDynamicProperty("fr:platform_location", platformLocationData);
  } catch { }
  try {
    entity.addTag("fr_linked_platform");
  } catch { }
  debugLog(`[Stageplate] Saved platform location: ${platformLocationData}`);
  clearPlayerSelection(player);
  return true;
}
export function unlinkAnimatronicFromStageplate(entity) {
  const stageplateKey = entity.getDynamicProperty("fr:linked_stageplate");
  if (!stageplateKey) return false;
  const animatronicId = getOrCreateAnimatronicId(entity);
  const stageplateData = stageplateRegistry.get(stageplateKey);
  if (stageplateData) {
    stageplateData.linkedAnimatronics =
      stageplateData.linkedAnimatronics.filter(
        (a) => a.animatronicId !== animatronicId);
    updateStageplateData(stageplateKey, stageplateData);
  }
  try {
    entity.setDynamicProperty("fr:linked_stageplate", undefined);
  } catch { }
  try {
    entity.setDynamicProperty("fr:platform_location", undefined);
  } catch { }
  try {
    entity.removeTag("fr_linked_platform");
  } catch { }
  return true;
}
export function unlinkAnimatronicById(animatronicId, stageplateKey) {
  const stageplateData = stageplateRegistry.get(stageplateKey);
  if (!stageplateData) return false;
  const originalLength = stageplateData.linkedAnimatronics.length;
  stageplateData.linkedAnimatronics = stageplateData.linkedAnimatronics.filter(
    (a) => a.animatronicId !== animatronicId);
  if (stageplateData.linkedAnimatronics.length < originalLength) {
    updateStageplateData(stageplateKey, stageplateData);
    console.log(`[Stageplate] Unlinked animatronic ID ${animatronicId}`);
    return true;
  }
  return false;
}
export function getLinkedStageplate(entity) {
  const stageplateKey = entity.getDynamicProperty("fr:linked_stageplate");
  if (!stageplateKey) return null;
  return stageplateRegistry.get(stageplateKey) || null;
}
export function createRoutePoint(location, dimensionId, config = {}) {
  const key = getRoutePointKey(location, dimensionId);
  const existing = world.getDynamicProperty(key);
  if (existing) {
    return {
      error: "duplicate",
      message: "A route point already exists at this location",
    };
  }
  const routePointId = nextRoutePointId++;
  world.setDynamicProperty("fr:route_point_counter", nextRoutePointId);
  const routePointData = {
    id: routePointId,
    routeId: config.routeId || 0,
    location: {
      x: Math.floor(location.x) + 0.5,
      y: Math.floor(location.y),
      z: Math.floor(location.z) + 0.5,
    },
    dimensionId: dimensionId,
    waitTime: validateWaitTime(config.waitTime || DEFAULT_WAIT_TIME),
    nextRouteMode: config.nextRouteMode || NEXT_ROUTE_MODE.SEQUENTIAL,
    nextRoutePointId: config.nextRoutePointId || null,
    effects: config.effects || [],
    pose: config.pose || 0,
    variant: config.variant !== undefined ? config.variant : -1,
    rotation: config.rotation || 0,
    order: config.order || 0,
    animatronicTypeId: config.animatronicTypeId || null,
    createdAt: Date.now(),
  };
  world.setDynamicProperty(key, JSON.stringify(routePointData));
  routePointRegistry.set(key, routePointData);
  return {
    success: true, key: key, data: routePointData
  };
}
export function getRoutePointData(location, dimensionId) {
  const key = getRoutePointKey(location, dimensionId);
  if (routePointRegistry.has(key)) {
    return routePointRegistry.get(key);
  }
  const data = world.getDynamicProperty(key);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      routePointRegistry.set(key, parsed);
      return parsed;
    } catch {
      return null;
    }
  }
  return null;
}
export function updateRoutePoint(location, dimensionId, updates) {
  const key = getRoutePointKey(location, dimensionId);
  let data = getRoutePointData(location, dimensionId);
  if (!data) {
    return {
      error: "not_found", message: "Route point not found"
    };
  }
  data = {
    ...data, ...updates
  };
  if (updates.waitTime !== undefined) {
    data.waitTime = validateWaitTime(updates.waitTime);
  }
  world.setDynamicProperty(key, JSON.stringify(data));
  routePointRegistry.set(key, data);
  return {
    success: true, data: data
  };
}
export function deleteRoutePoint(location, dimensionId) {
  const key = getRoutePointKey(location, dimensionId);
  const existingData = world.getDynamicProperty(key);
  const existedInRegistry = routePointRegistry.has(key);
  if (!existingData && !existedInRegistry) {
    console.log(`[Route Point] No data found to delete for key: ${key}`);
    return false;
  }
  routePointRegistry.delete(key);
  world.setDynamicProperty(key, undefined);
  debugLog(
    `[Route Point] Deleted route point at ${Math.floor(location.x)}, ${Math.floor(location.y)}, ${Math.floor(location.z)}`);
  return true;
}
export function getRoutePointsForRouteId(routeId) {
  const routePoints = [];
  for (const rpData of routePointRegistry.values()) {

    if (rpData.routeId == routeId) {
      routePoints.push(rpData);
    }
  }
  routePoints.sort((a, b) => a.order - b.order);
  return routePoints;
}

function loadRoutePointsFromStorage() {
  const allKeys = world.getDynamicPropertyIds();
  let count = 0;
  const routeIds = new Set();

  for (const key of allKeys) {
    if (!key.startsWith("fr:rp_")) continue;
    const data = world.getDynamicProperty(key);
    if (!data) continue;
    try {
      const rpData = JSON.parse(data);
      routePointRegistry.set(key, { ...rpData, key });
      routeIds.add(rpData.routeId);
      count++;
    } catch (e) { }
  }

  if (count > 0) {
    console.log(`[CustomPathing] Loaded ${count} route points. Route IDs found: ${Array.from(routeIds).join(", ")}`);
  } else {
    console.warn("[CustomPathing] No route points found in storage property scan.");
  }
  return count;
}
export function deleteAllRoutePoints(routeId) {
  const routePoints = getRoutePointsForRouteId(routeId);
  let count = 0;
  for (const rp of routePoints) {
    deleteRoutePoint(rp.location, rp.dimensionId);
    count++;
  }
  return count;
}
export function getNextRouteOrder(routeId) {
  const routePoints = getRoutePointsForRouteId(routeId);
  if (routePoints.length === 0) return 0;
  const maxOrder = Math.max(...routePoints.map((rp) => rp.order));
  return maxOrder + 1;
}
export function enableNightMode(entity) {
  const animatronicId = getOrCreateAnimatronicId(entity);
  const stageplateKey = entity.getDynamicProperty("fr:linked_stageplate");
  const routeId = getAnimatronicRouteId(entity);
  const aiLevel = getAILevel(entity);
  let platformLocation = entity.getDynamicProperty("fr:platform_location");
  if (!platformLocation) {
    const currentLoc = entity.location;
    platformLocation = JSON.stringify({
      x: Math.floor(currentLoc.x) + 0.5,
      y: Math.floor(currentLoc.y),
      z: Math.floor(currentLoc.z) + 0.5,
      dimensionId: entity.dimension.id,
    });
    entity.setDynamicProperty("fr:platform_location", platformLocation);
    debugLog(
      `[NightMode] Auto-set platform location to current position: ${platformLocation}`);
  }
  const routePoints = getRoutePointsForRouteId(routeId);
  debugLog(
    `[NightMode] Enabling for ${animatronicId}:`,
    `\n - entityId: ${entity.id}`,
    `\n - entityType: ${entity.typeId}`,
    `\n - routeId: ${routeId}`,
    `\n - routePoints: ${routePoints.length}`,
    `\n - stageplateKey: ${stageplateKey}`,
    `\n - platformLocation: ${platformLocation}`,
    `\n - aiLevel: ${aiLevel}`);
  if (routePoints.length === 0) {
    debugWarn(
      `[NightMode] WARNING: No route points found for routeId ${routeId}! Movement will not start.`);
  }
  const isWalking = !!ANIMATRONIC_TO_STATUE[entity.typeId];

  const originalStatueType = isWalking
    ? ANIMATRONIC_TO_STATUE[entity.typeId]
    : entity.typeId;

  const entityRotation = entity.getRotation ? entity.getRotation() : { y: 0 };
  for (const [existingId, existingData] of nightModeRegistry) {
    if (existingData.routeId === routeId && existingId !== animatronicId) {
      debugWarn(`[NightMode] Route ${routeId} already claimed by animatronic ${existingId}, rejecting ${animatronicId}`);
      return false;
    }
  }
  nightModeRegistry.set(animatronicId, {
    stageplateKey: stageplateKey,
    routeId: routeId,
    enabled: true,
    enabledAt: Date.now(),
    aiLevel: aiLevel,
    entityId: entity.id,
    entityType: entity.typeId,
    dimensionId: entity.dimension.id,
    platformLocation: platformLocation,
    originalStatueType: originalStatueType,
    isWalking: isWalking,
    walkingEntityId: isWalking ? entity.id : null,
    platformPoseIndex: entity.getDynamicProperty("fr:pose_index") || entity.getDynamicProperty("fr:platform_pose_index") || 0,
    platformRotation: normalizeRotation(entityRotation.y),
    platformVariantIndex: entity.getDynamicProperty("fr:variant_index") || entity.getDynamicProperty("fr:platform_variant_index") || 0,
    missedTicks: 0,
  });
  activeNightEntities.set(entity.id, animatronicId);
  broadcastDebug(`[NightMode] Saved platform settings for ${animatronicId}: pose=${entity.getDynamicProperty("fr:pose_index") || 0}, rot=${normalizeRotation(entityRotation.y)}, variant=${entity.getDynamicProperty("fr:variant_index") || 0}`);

  const savedStateJson = entity.getDynamicProperty("fr:night_pathing_state");
  let restoredState = null;
  if (savedStateJson) {
    try {
      restoredState = JSON.parse(savedStateJson);
    } catch (e) { }
  }

  if (restoredState) {
    if (restoredState.visitedWaypointsArray) {
      restoredState.visitedWaypoints = new Map(restoredState.visitedWaypointsArray);
      delete restoredState.visitedWaypointsArray;
    } else {
      restoredState.visitedWaypoints = new Map();
    }
    if (!restoredState.lastMoveTime) restoredState.lastMoveTime = Date.now();
    nightPathingState.set(animatronicId, restoredState);
    debugLog(`[NightMode] Restored persisted state for ${animatronicId}: state=${restoredState.state}, wp=${restoredState.currentWaypointIndex}`);
  } else {
    const readyToMoveTime = Date.now() - NIGHT_MODE_CONFIG.MIN_ACTIVE_TIME_MS - 1000;
    nightPathingState.set(animatronicId, {
      currentWaypointIndex: -1,
      visitedWaypoints: new Map(),
      lastMoveTime: readyToMoveTime,
      state: "idle",
      useRandomOrder: NIGHT_MODE_CONFIG.USE_RANDOM_WAYPOINTS,
      pathfindingSessionId: null,
      isReturningToPlatform: false,
    });
  }
  entity.setDynamicProperty("fr:night_mode_enabled", true);
  debugLog(
    `[NightMode] Enabled for ${animatronicId}, entityId: ${entity.id}, ready to move immediately`);
  return true;
}
export function disableNightMode(entity) {
  const animatronicId = getOrCreateAnimatronicId(entity);
  const pathingState = nightPathingState.get(animatronicId);
  if (pathingState?.pathfindingSessionId) {
    stopPathfinding(pathingState.pathfindingSessionId);
  }
  activeNightEntities.delete(entity.id);
  nightModeRegistry.delete(animatronicId);
  nightPathingState.delete(animatronicId);
  entity.setDynamicProperty("fr:night_mode_enabled", false);
  debugLog(`[NightMode] Disabled for ${animatronicId}`);
  return true;
}
export function getAILevel(entity) {
  const storedLevel = entity.getDynamicProperty("fr:ai_level");
  if (storedLevel !== undefined && storedLevel !== null) {
    return Math.max(
      AI_LEVEL_CONFIG.MIN_LEVEL,
      Math.min(AI_LEVEL_CONFIG.MAX_LEVEL, storedLevel));
  }
  const animatronicId = getOrCreateAnimatronicId(entity);
  const aiData = aiLevelRegistry.get(animatronicId);
  if (aiData) {
    return aiData.level;
  }
  return AI_LEVEL_CONFIG.DEFAULT_LEVEL;
}
export function setAILevel(entity, level) {
  const clampedLevel = Math.max(
    AI_LEVEL_CONFIG.MIN_LEVEL,
    Math.min(AI_LEVEL_CONFIG.MAX_LEVEL, level));
  const animatronicId = getOrCreateAnimatronicId(entity);
  entity.setDynamicProperty("fr:ai_level", clampedLevel);
  aiLevelRegistry.set(animatronicId, {
    level: clampedLevel,
    updatedAt: Date.now(),
  });
  const nightData = nightModeRegistry.get(animatronicId);
  if (nightData) {
    nightData.aiLevel = clampedLevel;
  }
  return clampedLevel;
}
export function getAILevelStats(level) {
  const config = AI_LEVEL_CONFIG;
  const speedMultiplier = 1 + level * config.MOVE_SPEED_MULTIPLIER;
  const waitTimeMultiplier = Math.max(
    0.3,
    config.BASE_WAIT_TIME_MULTIPLIER - level * config.WAIT_TIME_REDUCTION);
  const detectionRange =
    config.BASE_DETECTION_RANGE + level * config.DETECTION_RANGE_BONUS;
  const aggressionChance = level * config.AGGRESSION_CHANCE;
  return {
    level: level,
    moveSpeed: config.BASE_MOVE_SPEED * speedMultiplier,
    speedMultiplier: speedMultiplier,
    waitTimeMultiplier: waitTimeMultiplier,
    detectionRange: detectionRange,
    aggressionChance: Math.min(0.9, aggressionChance),
    difficulty: getDifficultyName(level),
  };
}
function getDifficultyName(level) {
  if (level <= 3) return "§aPassive";
  if (level <= 7) return "§eEasy";
  if (level <= 12) return "§6Normal";
  if (level <= 16) return "§cHard";
  return "§4Nightmare";
}
export function setAILevelByPlatform(dimensionId, x, y, z, level) {
  try {
    const dimension = world.getDimension(dimensionId);
    const platformLoc = {
      x: Math.floor(x),
      y: Math.floor(y),
      z: Math.floor(z),
    };
    const entities = dimension.getEntities({
      location: platformLoc,
      maxDistance: 3,
    });
    let updated = 0;
    for (const entity of entities) {
      if (isAnimatronic(entity) || STATUE_TYPES.includes(entity.typeId)) {
        const linkedPlatform = entity.getDynamicProperty(
          "fr:platform_location");
        if (linkedPlatform) {
          try {
            const platLoc = JSON.parse(linkedPlatform);
            if (
              Math.floor(platLoc.x) === platformLoc.x &&
              Math.floor(platLoc.y) === platformLoc.y &&
              Math.floor(platLoc.z) === platformLoc.z) {
              setAILevel(entity, level);
              updated++;
            }
          } catch { }
        }
        const dist = getDistance(entity.location, platformLoc);
        if (dist < 2) {
          setAILevel(entity, level);
          updated++;
        }
      }
    }
    return {
      success: updated > 0, count: updated
    };
  } catch (e) {
    console.warn("[AILevel] Error setting by platform:", e);
    return {
      success: false, count: 0, error: e.message
    };
  }
}
export function selectNightWaypoint(animatronicId, routePoints, currentIndex) {
  if (!routePoints || routePoints.length === 0) {
    return -1;
  }
  if (routePoints.length === 1) {
    return 0;
  }
  const pathingState = nightPathingState.get(animatronicId);
  const useRandom =
    pathingState?.useRandomOrder ?? NIGHT_MODE_CONFIG.USE_RANDOM_WAYPOINTS;
  if (!useRandom) {
    return (currentIndex + 1) % routePoints.length;
  }
  const now = Date.now();
  const visitedWaypoints = pathingState?.visitedWaypoints || new Map();
  const cooldown = NIGHT_MODE_CONFIG.REVISIT_COOLDOWN_MS;
  const validIndices = [];
  const weights = [];
  for (let i = 0;
    i < routePoints.length;
    i++) {
    if (i === currentIndex) continue;
    const lastVisit = visitedWaypoints.get(i) || 0;
    const timeSinceVisit = now - lastVisit;
    if (timeSinceVisit >= cooldown) {
      validIndices.push(i);
      const weight = Math.min(10, 1 + timeSinceVisit / cooldown);
      weights.push(weight);
    }
  }
  if (validIndices.length === 0) {
    const allOthers = [];
    for (let i = 0;
      i < routePoints.length;
      i++) {
      if (i !== currentIndex) allOthers.push(i);
    }
    if (allOthers.length === 0) return currentIndex;
    return allOthers[Math.floor(Math.random() * allOthers.length)];
  }
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0;
    i < validIndices.length;
    i++) {
    random -= weights[i];
    if (random <= 0) {
      return validIndices[i];
    }
  }
  return validIndices[validIndices.length - 1];
}
export function markWaypointVisited(animatronicId, waypointIndex) {
  let pathingState = nightPathingState.get(animatronicId);
  if (!pathingState) {
    pathingState = {
      currentWaypointIndex: waypointIndex,
      visitedWaypoints: new Map(),
      lastMoveTime: Date.now(),
      state: "moving",
      useRandomOrder: NIGHT_MODE_CONFIG.USE_RANDOM_WAYPOINTS,
    };
    nightPathingState.set(animatronicId, pathingState);
  }
  pathingState.visitedWaypoints.set(waypointIndex, Date.now());
  pathingState.currentWaypointIndex = waypointIndex;
  pathingState.lastMoveTime = Date.now();

  saveNightPathingState(animatronicId);
}
export function getNightPathingState(animatronicId) {
  return nightPathingState.get(animatronicId);
}
export function updateNightPathingState(animatronicId, updates) {
  const state = nightPathingState.get(animatronicId);
  if (state) {
    Object.assign(state, updates);
    saveNightPathingState(animatronicId);
  }
}

function saveNightPathingState(animatronicId) {
  const state = nightPathingState.get(animatronicId);
  if (!state) return;

  const nightModeData = nightModeRegistry.get(animatronicId);
  if (!nightModeData) return;

  const entity = findNightModeEntity(nightModeData);
  if (entity && entity.isValid) {
    try {

      const stateToSave = {
        currentWaypointIndex: state.currentWaypointIndex,
        state: state.state,
        isReturningToPlatform: state.isReturningToPlatform,
        useRandomOrder: state.useRandomOrder,
        pathfindingSessionId: null,
        visitedWaypointsArray: state.visitedWaypoints ? Array.from(state.visitedWaypoints.entries()) : []
      };
      entity.setDynamicProperty("fr:night_pathing_state", JSON.stringify(stateToSave));
    } catch (e) {
      console.warn("[NightMode] Failed to save state:", e);
    }
  }
}
export function isNightModeEnabled(entity) {
  return entity.getDynamicProperty("fr:night_mode_enabled") === true;
}
export function getNightModeStatus(entity) {
  const animatronicId = getOrCreateAnimatronicId(entity);
  const isEnabled = isNightModeEnabled(entity);
  const routeId = getAnimatronicRouteId(entity);
  const routePoints = getRoutePointsForRouteId(routeId);
  const stageplateKey = entity.getDynamicProperty("fr:linked_stageplate");
  const aiLevel = getAILevel(entity);
  const aiStats = getAILevelStats(aiLevel);
  const pathingState = nightPathingState.get(animatronicId);
  return {
    enabled: isEnabled,
    animatronicId: animatronicId,
    routeId: routeId,
    routePointCount: routePoints.length,
    hasStageplate: !!stageplateKey,
    isNightTime: isNightTime(),
    aiLevel: aiLevel,
    aiStats: aiStats,
    useRandomWaypoints:
      pathingState?.useRandomOrder ?? NIGHT_MODE_CONFIG.USE_RANDOM_WAYPOINTS,
    currentWaypoint: pathingState?.currentWaypointIndex ?? -1,
  };
}
const routeMarkingSessions = new Map();
export function startRouteMarking(player, routeId, entityName) {
  const playerId = player.id;
  routeMarkingSessions.set(playerId, {
    routeId: routeId,
    entityName: entityName,
    startTime: Date.now(),
    placedPoints: 0,
  });
  try {
    const inventory = player.getComponent("inventory");
    if (inventory && inventory.container) {
      const markerItem = new ItemStack("fr:route_marker", 1);
      inventory.container.addItem(markerItem);
    }
  } catch (e) {
    console.warn("[RouteMarking] Could not give marker item:", e);
  }
  player.sendMessage(
    `§a[Route Marker] §7Route marking mode activated for route ID: §e${routeId}`);
  player.sendMessage(
    "§7Use the Route Marker item on blocks to place route points.");
  player.sendMessage("§7Sneak + use to exit route marking mode.");
  return true;
}
export function stopRouteMarking(player) {
  const session = routeMarkingSessions.get(player.id);
  if (session) {
    player.sendMessage(
      `§e[Route Marker] §7Route marking ended. Placed §a${session.placedPoints}§7 points.`);
    routeMarkingSessions.delete(player.id);
  }
  return true;
}
export function isInRouteMarkingMode(player) {
  return routeMarkingSessions.has(player.id);
}
export function getRouteMarkingSession(player) {
  return routeMarkingSessions.get(player.id);
}
export function placeRoutePointFromMarker(player, blockLocation, dimensionId) {
  const session = routeMarkingSessions.get(player.id);
  if (!session) {
    return {
      error: "no_session", message: "Not in route marking mode"
    };
  }
  const nextOrder = getNextRouteOrder(session.routeId);
  const result = createRoutePoint(blockLocation, dimensionId, {
    routeId: session.routeId,
    order: nextOrder,
    waitTime: DEFAULT_WAIT_TIME,
    nextRouteMode: NEXT_ROUTE_MODE.SEQUENTIAL,
  });
  if (result.success) {
    session.placedPoints++;
    player.sendMessage(
      `§a[Route Marker] §7Point #${nextOrder + 1}placed at §e${Math.floor(blockLocation.x)}, ${Math.floor(blockLocation.y)}, ${Math.floor(blockLocation.z)}`);
  } else {
    player.sendMessage(`§c[Route Marker] §7${result.message}`);
  }
  return result;
}
export function cancelRouteTest(sessionId) {
  if (typeof sessionId === "string" && sessionId.startsWith("astar_route_")) {
    return cancelAStarRouteTest(sessionId);
  }
  const session = routeTestSessions.get(sessionId);
  if (!session) return false;
  session.isCancelled = true;
  routeTestSessions.delete(sessionId);
  return true;
}
export function processRouteTestTick() { }
function findEntityById(entityId, dimensionId) {
  try {
    const dimension = world.getDimension(dimensionId);
    const entities = dimension.getEntities();
    for (const entity of entities) {
      if (entity.id === entityId) {
        return entity;
      }
    }
  } catch (e) {
    console.warn("[CustomPathing] Error finding entity:", e);
  }
  return null;
}
function findPlayerById(playerId) {
  for (const player of world.getAllPlayers()) {
    if (player.id === playerId) {
      return player;
    }
  }
  return null;
}
function normalizeCameraKey(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, "");
}
function executeRoutePointEffects(routePoint, session) {
  if (!routePoint.effects || routePoint.effects.length === 0) return;
  for (const effect of routePoint.effects) {
    const chance =
      typeof effect.chance === "number" && isFinite(effect.chance)
        ? effect.chance
        : 0.1;
    if (chance < 1 && Math.random() >= chance) continue;
    switch (effect.type) {
      case EFFECT_TYPES.CAMERA_FORCE_SWITCH:
        executeCameraForceSwitch(effect, session);
        break;
      case EFFECT_TYPES.SCREEN_FADE:
        executeScreenFade(effect, session);
        break;
      case EFFECT_TYPES.EMIT_SOUND:
        executeEmitSound(effect, routePoint, session);
        break;
      case EFFECT_TYPES.CAMERA_BLACKOUT:
        executeCameraBlackout(effect, session);
        break;
    }
  }
}
function executeCameraForceSwitch(effect, session) {
  const players = session?.playerId
    ? [findPlayerById(session.playerId)].filter(p => p)
    : world.getAllPlayers();
  const linkedKey = normalizeCameraKey(session?.linkedCamera);
  for (const player of players) {
    const isViewingCamera = player.getDynamicProperty("fr:viewing_camera") ||
      player.hasTag("fr:viewing_camera") ||
      player.getDynamicProperty("fr:viewing_camera_pos") !== undefined;
    if (isViewingCamera) {
      if (linkedKey) {
        const camKey = normalizeCameraKey(player.getDynamicProperty("fr:viewing_camera_pos"));
        if (!camKey || camKey !== linkedKey) continue;
      }
      player.setDynamicProperty("fr:force_camera_switch", true);
      player.sendMessage("§c[!] §7Camera interference detected...");
    }
  }
}
function executeScreenFade(effect, session) {
  const players = session?.playerId
    ? [findPlayerById(session.playerId)].filter(p => p)
    : world.getAllPlayers();
  const duration = effect.duration || 20;
  for (const player of players) {
    try {
      const isViewingCamera = player.getDynamicProperty("fr:viewing_camera") ||
        player.hasTag("fr:viewing_camera") ||
        player.getDynamicProperty("fr:viewing_camera_pos") !== undefined;
      if (session.origin) {
        if (!isViewingCamera) continue;
        const camPosStr = player.getDynamicProperty("fr:viewing_camera_pos");
        const camKey = normalizeCameraKey(camPosStr);
        if (camKey) {
          if (session.linkedCamera) {
            const linkedKey = normalizeCameraKey(session.linkedCamera);
            if (!linkedKey || linkedKey !== camKey) continue;
          }
        }
      }
      try {
        const durationSec = duration / 20;
        try {
          player.runCommand(`camera @s fade time 0.1 ${durationSec} 0.1 color 0 0 0`);
        } catch (e) {
          player.runCommand(`title @s title §0`);
          player.runCommand(`title @s times 5 ${duration} 5`);
          system.runTimeout(() => {
            try {
              player.runCommand(`title @s clear`);
            } catch { }
          }, duration + 10);
        }
      } catch (e) {
        console.warn("[Effects] Screen fade error:", e);
      }
    } catch (e) {
      console.warn("[Effects] Outer error:", e);
    }
  }
}
function executeEmitSound(effect, routePoint, session) {
  try {
    const dimId = typeof session?.dimensionId === "string" ? session.dimensionId : "overworld";
    const dimName = dimId.startsWith("minecraft:") ? dimId.replace("minecraft:", "") : dimId;
    const dimension = world.getDimension(dimName);
    const soundId = effect.soundId || "random.click";
    const volume = effect.volume || 1.0;
    const pitch = effect.pitch || 1.0;
    dimension.playSound(soundId, routePoint.location, {
      volume: volume,
      pitch: pitch,
    });
  } catch (e) {
    console.warn("[Effects] Sound error:", e);
  }
}
function executeCameraBlackout(effect, session) {
  const players = session?.playerId
    ? [findPlayerById(session.playerId)].filter(p => p)
    : world.getAllPlayers();
  const duration = effect.duration || 40;
  for (const player of players) {
    const isViewingCamera = player.getDynamicProperty("fr:viewing_camera") ||
      player.hasTag("fr:viewing_camera") ||
      player.getDynamicProperty("fr:viewing_camera_pos") !== undefined;
    if (session.origin && isViewingCamera) {
      const camPosStr = player.getDynamicProperty("fr:viewing_camera_pos");
      const camKey = normalizeCameraKey(camPosStr);
      if (camKey) {
        if (session.linkedCamera) {
          const linkedKey = normalizeCameraKey(session.linkedCamera);
          if (!linkedKey || linkedKey !== camKey) continue;
        }
      }
    }
    if (isViewingCamera) {
      player.runCommand(`title @s actionbar §ᄀ§ᄁ§ᄂ`);
      try {
        const durationSec = duration / 20;
        player.runCommand(`camera @s fade time 0.1 ${durationSec} 0.1 color 0 0 0`);
      } catch (e) { }
    }
  }
}
function executeCameraRefresh(session) {
  const players = session?.playerId
    ? [findPlayerById(session.playerId)].filter(p => p)
    : world.getAllPlayers();
  const linkedKey = normalizeCameraKey(session?.linkedCamera);
  for (const player of players) {
    try {
      const isViewingCamera = player.getDynamicProperty("fr:viewing_camera") || player.hasTag("fr:viewing_camera") || player.getDynamicProperty("fr:viewing_camera_pos") !== undefined;
      if (!isViewingCamera) continue;
      const camPosStr = player.getDynamicProperty("fr:viewing_camera_pos");
      const camKey = normalizeCameraKey(camPosStr);
      if (linkedKey) {
        if (!camKey || camKey !== linkedKey) continue;
      } else {
        continue;
      }
      if (isViewingCamera) {
        try {
          player.runCommand(`camera @s fade time 0.1 0.2 0.1 color 0 0 0`);
          player.playSound("random.click", {
            volume: 0.5, pitch: 1.5
          });
        } catch (e) { }
      }
    } catch (e) { }
  }
}
export async function showNightModeTab(player, entity) {
  const status = getNightModeStatus(entity);
  const entityName =
    entity.nameTag || entity.typeId.replace("fr:", "").replace(/_/g, " ");
  const form = new ActionFormData()
    .title("§l§6NIGHT MODE")
    .body(
      `§7Entity: §a${entityName}\n` +
      `§7Route ID: §e${status.routeId}\n` +
      `§7Route Points: §f${status.routePointCount}\n` +
      `§7Linked to Stageplate: ${status.hasStageplate ? "§aYes" : "§cNo"}\n` +
      `§7Night Mode: ${status.enabled ? "§aEnabled" : "§cDisabled"}\n` +
      `§7AI Level: ${status.aiStats.difficulty}§7(${status.aiLevel}/20)\n` +
      `§7Waypoint Mode: ${status.useRandomWaypoints ? "§eRandom" : "§aSequential"}\n` +
      `§7Current Time: §f${getTimeString()}${status.isNightTime ? "§c(NIGHT)" : "§a(DAY)"}`);
  form.button("§eSet Route ID", "textures/fr_ui/id_icon");
  form.button(
    `§6AI Level §7(${status.aiLevel})`,
    "textures/fr_ui/ai_level_icon");
  form.button("§aMark Route", "textures/fr_ui/route_marker");
  if (status.routePointCount > 0) {
    form.button("§bTest Route", "textures/fr_ui/test_route");
  }
  if (status.routePointCount > 0) {
    form.button("§dRoute List", "textures/fr_ui/route_list");
  }
  if (status.routePointCount > 0) {
    form.button("§cDelete All Routes", "textures/fr_ui/delete_routes");
  }
  form.button(
    status.useRandomWaypoints
      ? "§eDisable Random Waypoints"
      : "§eEnable Random Waypoints");
  form.button(status.enabled ? "§cDisable Night Mode" : "§aEnable Night Mode");
  form.button("§7Back");
  try {
    const response = await form.show(player);
    if (response.canceled) return;
    let buttonIndex = 0;
    const actions = ["setId", "aiLevel", "markRoute"];
    if (status.routePointCount > 0) {
      actions.push("testRoute", "routeList", "deleteRoutes");
    }
    actions.push("toggleRandomWaypoints", "toggleNightMode", "back");
    const action = actions[response.selection];
    switch (action) {
      case "setId":
        system.run(() => showSetRouteIdMenu(player, entity));
        break;
      case "aiLevel":
        system.run(() => showAILevelMenu(player, entity));
        break;
      case "markRoute":
        const routeId = status.routeId || getOrCreateAnimatronicId(entity);
        startRouteMarking(player, routeId, entityName);
        break;
      case "testRoute":
        startRouteTest(entity, player);
        break;
      case "routeList":
        system.run(() => showRouteListMenu(player, entity));
        break;
      case "deleteRoutes":
        system.run(() => showDeleteAllRoutesConfirmation(player, entity));
        break;
      case "toggleRandomWaypoints":
        const animatronicId = getOrCreateAnimatronicId(entity);
        let pathingState = nightPathingState.get(animatronicId);
        if (!pathingState) {
          pathingState = {
            currentWaypointIndex: -1,
            visitedWaypoints: new Map(),
            lastMoveTime: Date.now(),
            state: "idle",
            useRandomOrder: !NIGHT_MODE_CONFIG.USE_RANDOM_WAYPOINTS,
          };
          nightPathingState.set(animatronicId, pathingState);
        } else {
          pathingState.useRandomOrder = !pathingState.useRandomOrder;
        }
        player.sendMessage(
          pathingState.useRandomOrder
            ? "§e[Night Mode] §7Random waypoint selection §aenabled"
            : "§e[Night Mode] §7Sequential waypoint order §aenabled");
        system.run(() => showNightModeTab(player, entity));
        break;
      case "toggleNightMode":
        if (status.enabled) {
          disableNightMode(entity);
          player.sendMessage("§c[Night Mode] §7Disabled");
        } else {
          if (!status.hasStageplate) {
            player.sendMessage(
              "§c[Night Mode] §7You must link this animatronic to a Stageplate first!");
          } else {
            enableNightMode(entity);
            player.sendMessage(
              "§a[Night Mode] §7Enabled - Animatronic will activate at midnight");
          }
        }
        system.run(() => showNightModeTab(player, entity));
        break;
      case "back":
        break;
    }
  } catch (e) {
    console.warn("[NightModeTab] Error:", e);
  }
}
export async function showAILevelMenu(player, entity) {
  const currentLevel = getAILevel(entity);
  const stats = getAILevelStats(currentLevel);
  const platformLoc = entity.getDynamicProperty("fr:platform_location");
  let platformStr = "Not linked";
  if (platformLoc) {
    try {
      const loc = JSON.parse(platformLoc);
      platformStr = `${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)}`;
    } catch { }
  }
  const form = new ModalFormData()
    .title("§l§6AI LEVEL")
    .slider(
      `§7Current Level: ${stats.difficulty}\n` +
      `§7Speed: §f${(stats.speedMultiplier * 100).toFixed(0)}%\n` +
      `§7Wait Time: §f${(stats.waitTimeMultiplier * 100).toFixed(0)}%\n` +
      `§7Detection: §f${stats.detectionRange.toFixed(1)} blocks\n` +
      `§7Aggression: §f${(stats.aggressionChance * 100).toFixed(0)}%\n\n` +
      `§8Platform: ${platformStr}\n` +
      `§8Command: /scriptevent fr:ai_level ${platformStr.replace(/, /g, " ")}<level>`,
      AI_LEVEL_CONFIG.MIN_LEVEL,
      AI_LEVEL_CONFIG.MAX_LEVEL,
      1,
      currentLevel);
  try {
    const response = await form.show(player);
    if (response.canceled) {
      system.run(() => showNightModeTab(player, entity));
      return;
    }
    const newLevel = response.formValues[0];
    setAILevel(entity, newLevel);
    const newStats = getAILevelStats(newLevel);
    player.sendMessage(
      `§a[AI Level] §7Set to ${newStats.difficulty}§7(Level ${newLevel})`);
    system.run(() => showNightModeTab(player, entity));
  } catch (e) {
    console.warn("[AILevelMenu] Error:", e);
  }
}
export async function showSetRouteIdMenu(player, entity) {
  const currentId = getAnimatronicRouteId(entity);
  const form = new ModalFormData()
    .title("§l§eSet Route ID")
    .textField("Route ID (number):", "Enter a number", currentId.toString());
  try {
    const response = await form.show(player);
    if (response.canceled) {
      system.run(() => showNightModeTab(player, entity));
      return;
    }
    const newId = parseInt(response.formValues[0]);
    if (isNaN(newId) || newId < 0) {
      player.sendMessage(
        "§c[Route ID] §7Invalid ID! Please enter a positive number.");
    } else {
      setAnimatronicRouteId(entity, newId);
      player.sendMessage(`§a[Route ID] §7Route ID set to: §e${newId}`);
    }
    system.run(() => showNightModeTab(player, entity));
  } catch (e) {
    console.warn("[SetRouteId] Error:", e);
  }
}
export async function showRouteListMenu(player, entity) {
  const routeId = getAnimatronicRouteId(entity);
  const routePoints = getRoutePointsForRouteId(routeId);
  if (routePoints.length === 0) {
    player.sendMessage("§c[Route List] §7No route points found!");
    system.run(() => showNightModeTab(player, entity));
    return;
  }
  const form = new ActionFormData()
    .title("§l§dRoute Points")
    .body(`§7Route ID: §e${routeId}\n§7Total Points: §f${routePoints.length}`);
  for (const rp of routePoints) {
    const loc = rp.location;
    const waitSec = Math.floor(rp.waitTime / 20);
    form.button(
      `§e#${rp.order + 1}§f(${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)})\n§7Wait: ${waitSec}s`);
  }
  form.button("§7Back");
  try {
    const response = await form.show(player);
    if (response.canceled) {
      system.run(() => showNightModeTab(player, entity));
      return;
    }
    if (response.selection < routePoints.length) {
      const selectedPoint = routePoints[response.selection];
      system.run(() => showRoutePointEditor(player, entity, selectedPoint));
    } else {
      system.run(() => showNightModeTab(player, entity));
    }
  } catch (e) {
    console.warn("[RouteList] Error:", e);
  }
}

const routePointRotationPreviewIntervals = new Map();

function stopRoutePointRotationPreview(player) {
  const handle = routePointRotationPreviewIntervals.get(player.id);
  if (handle !== undefined) {
    try {
      system.clearRun(handle);
    } catch { }
    routePointRotationPreviewIntervals.delete(player.id);
  }
}

function getDimensionFromId(dimensionId) {
  const dim = (dimensionId || "minecraft:overworld").replace("minecraft:", "");
  return world.getDimension(dim);
}

function startRoutePointRotationPreview(player, location, dimensionId, rotationDegrees) {
  stopRoutePointRotationPreview(player);

  const dim = player?.dimension ?? getDimensionFromId(dimensionId);
  const yaw = ((rotationDegrees % 360) + 360) % 360;
  const rad = (yaw * Math.PI) / 180;
  const dirX = -Math.sin(rad);
  const dirZ = Math.cos(rad);

  let ticks = 0;
  const maxTicks = 60;
  const particleStep = 0.55;
  const length = 5;

  const handle = system.runInterval(() => {
    ticks += 2;
    if (ticks > maxTicks) {
      stopRoutePointRotationPreview(player);
      return;
    }

    try {
      const baseX = Math.floor(location.x) + 0.5;
      const baseY = Math.floor(location.y);
      const baseZ = Math.floor(location.z) + 0.5;

      for (let i = 1; i <= length; i++) {
        const px = baseX + dirX * i * particleStep;
        const pz = baseZ + dirZ * i * particleStep;
        dim.spawnParticle("fr:raytest", { x: px, y: baseY + 0.65, z: pz });
      }
    } catch { }
  }, 2);

  routePointRotationPreviewIntervals.set(player.id, handle);
}

async function showRoutePointRotationPreviewMenu(player, entity, routePoint) {
  let rotation = (routePoint.rotation || 0) % 360;
  if (rotation < 0) rotation += 360;

  const dimId = routePoint.dimensionId || entity.dimension.id;
  startRoutePointRotationPreview(player, routePoint.location, dimId, rotation);

  const form = new ActionFormData()
    .title("§l§bRotation Preview")
    .body(
      `§7Route Point: §e#${routePoint.order + 1}\n` +
      `§7Rotation: §f${rotation}°\n\n` +
      "§7Use the buttons to adjust. Particles show the facing direction.",
    )
    .button("§c-90°")
    .button("§c-15°")
    .button("§a+15°")
    .button("§a+90°")
    .button("§eSave")
    .button("§7Back");

  try {
    const response = await form.show(player);
    stopRoutePointRotationPreview(player);

    if (response.canceled || response.selection === 5) {
      system.run(() => showRoutePointEditor(player, entity, routePoint));
      return;
    }

    if (response.selection === 0) rotation = (rotation + 270) % 360;
    else if (response.selection === 1) rotation = (rotation + 345) % 360;
    else if (response.selection === 2) rotation = (rotation + 15) % 360;
    else if (response.selection === 3) rotation = (rotation + 90) % 360;
    else if (response.selection === 4) {
      updateRoutePoint(routePoint.location, routePoint.dimensionId, { rotation });
      routePoint.rotation = rotation;
      player.sendMessage(`§a[Route Point] §7Rotation saved: §e${rotation}°`);
      system.run(() => showRoutePointEditor(player, entity, routePoint));
      return;
    }

    system.run(() =>
      showRoutePointRotationPreviewMenu(player, entity, { ...routePoint, rotation }),
    );
  } catch (e) {
    stopRoutePointRotationPreview(player);
    console.warn("[RotationPreview] Error:", e);
    system.run(() => showRoutePointEditor(player, entity, routePoint));
  }
}

export async function showRoutePointEditor(player, entity, routePoint) {
  const loc = routePoint.location;
  const waitSec = Math.floor(routePoint.waitTime / 20);
  const animatronicId = getOrCreateAnimatronicId(entity);
  const nextModeLabels = {
    [NEXT_ROUTE_MODE.SEQUENTIAL]: "Sequential",
    [NEXT_ROUTE_MODE.RANDOM]: "Random",
    [NEXT_ROUTE_MODE.SPECIFIC]: "Specific",
  };
  const form = new ActionFormData()
    .title(`§l§eRoute Point #${routePoint.order + 1}`)
    .body(
      `§7Location: §f${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)}\n` +
      `§7Animatronic ID: §e${animatronicId}\n` +
      `§7Route ID: §e${routePoint.routeId}\n` +
      `§7Sleep Time: §f${waitSec}seconds\n` +
      `§7Rotation: §f${routePoint.rotation ?? 0}°\n` +
      `§7Next Step: §f${nextModeLabels[routePoint.nextRouteMode] || "Sequential"}\n` +
      `§7Link Camera: ${routePoint.linkedCamera ? "§a" + routePoint.linkedCamera : "§7None"}\n` +
      `§7Emit Sound: §f${routePoint.effects?.some((e) => e.type === EFFECT_TYPES.EMIT_SOUND) ? "Yes" : "No"}\n` +
      `§7Effects: §f${routePoint.effects?.length || 0}`);
  form.button(
    "§cLink Camera\n§7Bind to specific camera",
    "textures/fr_ui/camera_icon");
  form.button(
    "§eEdit Sleep Time\n§7Time before moving",
    "textures/fr_ui/sleep_time_icon");
  form.button(
    "§bSet Next Step\n§7Random or specific point",
    "textures/fr_ui/next_step_icon");
  form.button(
    "§aEmit Sound\n§7Configure sound effects",
    "textures/fr_ui/sound_icon");
  form.button(
    "§dEffects\n§7Camera & visual effects",
    "textures/fr_ui/effects_icon");
  form.button(
    "§dSet Variant\n§7Change visual style",
    "textures/fr_ui/effects_icon");
  form.button(
    "§bRotation Preview\n§7Show facing direction",
    "textures/fr_ui/next_step_icon");
  form.button(
    "§cRemove Point\n§7Delete this route point",
    "textures/fr_ui/delete_icon");
  form.button("§7Back", "textures/fr_ui/back_icon");
  try {
    const response = await form.show(player);
    if (response.canceled) {
      system.run(() => showRouteListMenu(player, entity));
      return;
    }
    switch (response.selection) {
      case 0:
        system.run(() => showLinkCameraMenu(player, entity, routePoint));
        break;
      case 1:
        system.run(() => showEditWaitTimeMenu(player, entity, routePoint));
        break;
      case 2:
        system.run(() => showNextRouteModeMenu(player, entity, routePoint));
        break;
      case 3:
        system.run(() => showEmitSoundMenu(player, entity, routePoint));
        break;
      case 4:
        system.run(() => showEffectsMenu(player, entity, routePoint));
        break;
      case 5:
        system.run(() => showVariantMenu(player, entity, routePoint));
        break;
      case 6:
        system.run(() => showRoutePointRotationPreviewMenu(player, entity, routePoint));
        break;
      case 7:
        system.run(() =>
          showDeletePointConfirmation(player, entity, routePoint));
        break;
      case 8:
        system.run(() => showRouteListMenu(player, entity));
        break;
    }
  } catch (e) {
    console.warn("[RoutePointEditor] Error:", e);
  }
}

export async function showVariantMenu(player, entity, routePoint) {
  const currentVariant = routePoint.variant !== undefined ? routePoint.variant : -1;

  const form = new ModalFormData()
    .title("§l§dVariant Configuration")
    .slider(
      "§7Select Variant Index\n§8(-1 = Keep Current, 0 = Default)",
      -1,
      15, // Assuming max 15 variants for now
      1,
      currentVariant
    );

  try {
    const response = await form.show(player);
    if (response.canceled) {
      system.run(() => showRoutePointEditor(player, entity, routePoint));
      return;
    }

    const newVariant = response.formValues[0];
    updateRoutePoint(routePoint.location, routePoint.dimensionId, {
      variant: newVariant
    });
    routePoint.variant = newVariant;

    const variantText = newVariant === -1 ? "Keep Current" : `Index ${newVariant}`;
    player.sendMessage(`§a[Variant] §7Set to: §e${variantText}`);
    system.run(() => showRoutePointEditor(player, entity, routePoint));
  } catch (e) {
    console.warn("[VariantMenu] Error:", e);
  }
}

export async function showLinkCameraMenu(player, entity, routePoint) {
  const currentCam = player.getDynamicProperty("fr:viewing_camera_pos");
  const linkedCam = routePoint.linkedCamera || null;
  const form = new ActionFormData()
    .title("§l§cLink Camera")
    .body(
      `§7Currently Linked: ${linkedCam ? "§a" + linkedCam : "§cNone"}\n` +
      `§7You are viewing: ${currentCam ? "§e" + currentCam : "§7No Camera"}\n\n` +
      "§7Linking a camera will make effects strictly target ONLY players viewing that specific camera.");
  if (currentCam) {
    form.button(
      "§aLink Current View\n§7Bind to camera you are viewing",
      "textures/fr_ui/confirm_icon");
  } else {
    form.button(
      "§7Link Current View\n§c(Must view a camera)",
      "textures/fr_ui/lock_icon");
  }
  form.button(
    "§cUnlink Camera\n§7Remove binding",
    "textures/fr_ui/unlink_icon");
  form.button("§7Back", "textures/fr_ui/back_icon");
  try {
    const response = await form.show(player);
    if (response.canceled) {
      system.run(() => showRoutePointEditor(player, entity, routePoint));
      return;
    }
    if (response.selection === 0) {
      if (currentCam) {
        updateRoutePoint(routePoint.location, routePoint.dimensionId, { linkedCamera: currentCam });
        routePoint.linkedCamera = currentCam;
        player.sendMessage(`§a[Link] §7Route point linked to camera at §e${currentCam}`);
      } else {
        player.sendMessage("§c[Link] §7You must be viewing a camera to link it!");
      }
    } else if (response.selection === 1) {
      updateRoutePoint(routePoint.location, routePoint.dimensionId, { linkedCamera: null });
      routePoint.linkedCamera = null;
      player.sendMessage("§e[Link] §7Camera link removed.");
    }
    system.run(() => showRoutePointEditor(player, entity, routePoint));
  } catch (e) {
    console.warn("[LinkCameraMenu] Error:", e);
  }
}
export async function showEmitSoundMenu(player, entity, routePoint) {
  const soundEffects =
    routePoint.effects?.filter((e) => e.type === EFFECT_TYPES.EMIT_SOUND) || [];
  const hasSoundEffect = soundEffects.length > 0;
  const soundEffect = hasSoundEffect ? soundEffects[0] : null;
  const form = new ActionFormData()
    .title("§l§aEmit Sound Configuration")
    .body(
      `§7Route Point: §e#${routePoint.order + 1}\n` +
      `§7Current Sound: ${hasSoundEffect ? `§a${soundEffect.soundId}
`: "§cNone"}\n` +
      `§7Emit When: ${hasSoundEffect ? `§f${soundEffect.emitWhen || "always"}
`: "§7-"}`);
  if (hasSoundEffect) {
    form.button(
      "§eEdit Sound Settings\n§7Change sound and volume",
      "textures/fr_ui/edit_sound");
    form.button("§bEmit When\n§7Configure trigger", "textures/fr_ui/emit_when");
    form.button(
      "§cRemove Sound\n§7Clear sound effect",
      "textures/fr_ui/remove_sound");
  } else {
    form.button(
      "§a+ Add Sound Effect\n§7Configure sound to emit",
      "textures/fr_ui/add_sound");
  }
  form.button("§7Back", "textures/fr_ui/back_icon");
  try {
    const response = await form.show(player);
    if (response.canceled) {
      system.run(() => showRoutePointEditor(player, entity, routePoint));
      return;
    }
    if (hasSoundEffect) {
      switch (response.selection) {
        case 0:
          system.run(() =>
            showEditSoundSettingsMenu(player, entity, routePoint, soundEffect));
          break;
        case 1:
          system.run(() =>
            showEmitWhenMenu(player, entity, routePoint, soundEffect));
          break;
        case 2:
          const updatedEffects = routePoint.effects.filter(
            (e) => e.type !== EFFECT_TYPES.EMIT_SOUND);
          updateRoutePoint(routePoint.location, routePoint.dimensionId, {
            effects: updatedEffects,
          });
          routePoint.effects = updatedEffects;
          player.sendMessage("§a[Sound] §7Sound effect removed");
          system.run(() => showEmitSoundMenu(player, entity, routePoint));
          break;
        case 3:
          system.run(() => showRoutePointEditor(player, entity, routePoint));
          break;
      }
    } else {
      if (response.selection === 0) {
        system.run(() => showAddSoundEffectMenu(player, entity, routePoint));
      } else {
        system.run(() => showRoutePointEditor(player, entity, routePoint));
      }
    }
  } catch (e) {
    console.warn("[EmitSoundMenu] Error:", e);
  }
}
export async function showAddSoundEffectMenu(player, entity, routePoint) {
  const form = new ActionFormData()
    .title("§l§aSelect Sound")
    .body("§7Choose a sound to emit at this route point:");
  const sounds = [
    {
      id: "mob.zombie.say",
      name: "Zombie Groan",
      icon: "textures/fr_ui/sound_zombie",
    },
    {
      id: "random.door_open",
      name: "Door Open",
      icon: "textures/fr_ui/sound_door",
    },
    {
      id: "random.door_close",
      name: "Door Close",
      icon: "textures/fr_ui/sound_door",
    },
    {
      id: "mob.endermen.portal",
      name: "Teleport",
      icon: "textures/fr_ui/sound_teleport",
    },
    {
      id: "mob.ghast.scream",
      name: "Scream",
      icon: "textures/fr_ui/sound_scream",
    },
    {
      id: "random.click", name: "Click", icon: "textures/fr_ui/sound_click"
    },
    {
      id: "note.bass", name: "Bass Note", icon: "textures/fr_ui/sound_note"
    },
    {
      id: "ambient.cave",
      name: "Cave Ambient",
      icon: "textures/fr_ui/sound_ambient",
    },
  ];
  for (const sound of sounds) {
    form.button(`§e${sound.name}\n§7${sound.id}`, sound.icon);
  }
  form.button("§7Cancel", "textures/fr_ui/back_icon");
  try {
    const response = await form.show(player);
    if (response.canceled || response.selection === sounds.length) {
      system.run(() => showEmitSoundMenu(player, entity, routePoint));
      return;
    }
    const selectedSound = sounds[response.selection];
    const newEffect = {
      type: EFFECT_TYPES.EMIT_SOUND,
      soundId: selectedSound.id,
      volume: 1.0,
      pitch: 1.0,
      emitWhen: "always",
    };
    const updatedEffects = [...(routePoint.effects || []), newEffect];
    updateRoutePoint(routePoint.location, routePoint.dimensionId, {
      effects: updatedEffects,
    });
    routePoint.effects = updatedEffects;
    player.sendMessage(`§a[Sound] §7Added sound: §e${selectedSound.name}`);
    system.run(() => showEmitSoundMenu(player, entity, routePoint));
  } catch (e) {
    console.warn("[AddSoundEffect] Error:", e);
  }
}
export async function showEditSoundSettingsMenu(
  player,
  entity,
  routePoint,
  soundEffect) {
  const form = new ModalFormData()
    .title("§l§eEdit Sound Settings")
    .textField("Sound ID:", "e.g. mob.zombie.say", soundEffect.soundId)
    .slider("Volume:", 0, 2, 0.1, soundEffect.volume || 1.0)
    .slider("Pitch:", 0.5, 2, 0.1, soundEffect.pitch || 1.0);
  try {
    const response = await form.show(player);
    if (response.canceled) {
      system.run(() => showEmitSoundMenu(player, entity, routePoint));
      return;
    }
    const [newSoundId, newVolume, newPitch] = response.formValues;
    const updatedEffects = routePoint.effects.map((e) => {
      if (e.type === EFFECT_TYPES.EMIT_SOUND) {
        return {
          ...e,
          soundId: newSoundId,
          volume: newVolume,
          pitch: newPitch,
        };
      }
      return e;
    });
    updateRoutePoint(routePoint.location, routePoint.dimensionId, {
      effects: updatedEffects,
    });
    routePoint.effects = updatedEffects;
    player.sendMessage("§a[Sound] §7Sound settings updated");
    system.run(() => showEmitSoundMenu(player, entity, routePoint));
  } catch (e) {
    console.warn("[EditSoundSettings] Error:", e);
  }
}
export async function showEmitWhenMenu(
  player,
  entity,
  routePoint,
  soundEffect) {
  const form = new ActionFormData()
    .title("§l§bEmit When")
    .body("§7Choose when the sound should be emitted:")
    .button(
      "§aAlways\n§7Every time animatronic arrives",
      "textures/fr_ui/emit_always")
    .button("§eRandom\n§750% chance on arrival", "textures/fr_ui/emit_random")
    .button(
      "§bEvery 2nd Visit\n§7Emit every other time",
      "textures/fr_ui/emit_every_2")
    .button(
      "§dEvery 3rd Visit\n§7Emit every third time",
      "textures/fr_ui/emit_every_3")
    .button("§7Back", "textures/fr_ui/back_icon");
  try {
    const response = await form.show(player);
    if (response.canceled || response.selection === 4) {
      system.run(() => showEmitSoundMenu(player, entity, routePoint));
      return;
    }
    const emitWhenOptions = ["always", "random", "every_2", "every_3"];
    const selectedOption = emitWhenOptions[response.selection];
    const updatedEffects = routePoint.effects.map((e) => {
      if (e.type === EFFECT_TYPES.EMIT_SOUND) {
        return {
          ...e, emitWhen: selectedOption
        };
      }
      return e;
    });
    updateRoutePoint(routePoint.location, routePoint.dimensionId, {
      effects: updatedEffects,
    });
    routePoint.effects = updatedEffects;
    player.sendMessage(`§a[Sound] §7Emit when set to: §e${selectedOption}`);
    system.run(() => showEmitSoundMenu(player, entity, routePoint));
  } catch (e) {
    console.warn("[EmitWhen] Error:", e);
  }
}
export async function showEditWaitTimeMenu(player, entity, routePoint) {
  const currentWaitSec = Math.floor(routePoint.waitTime / 20);
  const form = new ModalFormData()
    .title("§l§eEdit Wait Time")
    .slider(
      "Wait Time (seconds)",
      MIN_WAIT_TIME / 20,
      MAX_WAIT_TIME / 20,
      1,
      currentWaitSec);
  try {
    const response = await form.show(player);
    if (response.canceled) {
      system.run(() => showRoutePointEditor(player, entity, routePoint));
      return;
    }
    const newWaitSec = response.formValues[0];
    const newWaitTicks = newWaitSec * 20;
    updateRoutePoint(routePoint.location, routePoint.dimensionId, {
      waitTime: newWaitTicks,
    });
    routePoint.waitTime = newWaitTicks;
    player.sendMessage(
      `§a[Route Point] §7Wait time set to: §e${newWaitSec}seconds`);
    system.run(() => showRoutePointEditor(player, entity, routePoint));
  } catch (e) {
    console.warn("[EditWaitTime] Error:", e);
  }
}
export async function showNextRouteModeMenu(player, entity, routePoint) {
  const form = new ActionFormData()
    .title("§l§bNext Route Mode")
    .body("§7Select how the animatronic chooses the next route point:")
    .button("§aSequential\n§7Go to next in order")
    .button("§eRandom\n§7Random route point")
    .button("§dSpecific\n§7Choose specific point")
    .button("§7Back");
  try {
    const response = await form.show(player);
    if (response.canceled || response.selection === 3) {
      system.run(() => showRoutePointEditor(player, entity, routePoint));
      return;
    }
    const modes = [
      NEXT_ROUTE_MODE.SEQUENTIAL,
      NEXT_ROUTE_MODE.RANDOM,
      NEXT_ROUTE_MODE.SPECIFIC,
    ];
    const selectedMode = modes[response.selection];
    updateRoutePoint(routePoint.location, routePoint.dimensionId, {
      nextRouteMode: selectedMode,
    });
    routePoint.nextRouteMode = selectedMode;
    player.sendMessage(
      `§a[Route Point] §7Next route mode set to: §e${selectedMode}`);
    if (selectedMode === NEXT_ROUTE_MODE.SPECIFIC) {
      system.run(() => showSelectSpecificPointMenu(player, entity, routePoint));
    } else {
      system.run(() => showRoutePointEditor(player, entity, routePoint));
    }
  } catch (e) {
    console.warn("[NextRouteMode] Error:", e);
  }
}
export async function showSelectSpecificPointMenu(player, entity, routePoint) {
  const routePoints = getRoutePointsForRouteId(routePoint.routeId);
  const form = new ActionFormData()
    .title("§l§dSelect Next Point")
    .body("§7Choose which route point to go to next:");
  for (const rp of routePoints) {
    if (rp.id !== routePoint.id) {
      const loc = rp.location;
      form.button(
        `§e#${rp.order + 1}§f(${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)})`);
    }
  }
  form.button("§7Cancel");
  try {
    const response = await form.show(player);
    const otherPoints = routePoints.filter((rp) => rp.id !== routePoint.id);
    if (response.canceled || response.selection >= otherPoints.length) {
      system.run(() => showRoutePointEditor(player, entity, routePoint));
      return;
    }
    const selectedPoint = otherPoints[response.selection];
    updateRoutePoint(routePoint.location, routePoint.dimensionId, {
      nextRoutePointId: selectedPoint.id,
    });
    routePoint.nextRoutePointId = selectedPoint.id;
    player.sendMessage(
      `§a[Route Point] §7Will go to point #${selectedPoint.order + 1}next`);
    system.run(() => showRoutePointEditor(player, entity, routePoint));
  } catch (e) {
    console.warn("[SelectSpecificPoint] Error:", e);
  }
}
export async function showEffectsMenu(player, entity, routePoint) {
  const effects = routePoint.effects || [];
  const form = new ActionFormData()
    .title("§l§dRoute Point Effects")
    .body(`§7Current effects: §f${effects.length}`);
  form.button("§a+ Camera Force Switch");
  form.button("§e+ Screen Fade");
  form.button("§b+ Emit Sound");
  form.button("§c+ Camera Blackout");
  if (effects.length > 0) {
    form.button("§cClear All Effects");
  }
  form.button("§7Back");
  try {
    const response = await form.show(player);
    if (response.canceled) {
      system.run(() => showRoutePointEditor(player, entity, routePoint));
      return;
    }
    const hasEffects = effects.length > 0;
    const backIndex = hasEffects ? 5 : 4;
    const clearIndex = hasEffects ? 4 : -1;
    if (response.selection === backIndex) {
      system.run(() => showRoutePointEditor(player, entity, routePoint));
      return;
    }
    if (response.selection === clearIndex) {
      updateRoutePoint(routePoint.location, routePoint.dimensionId, {
        effects: [],
      });
      routePoint.effects = [];
      player.sendMessage("§a[Effects] §7All effects cleared");
      system.run(() => showEffectsMenu(player, entity, routePoint));
      return;
    }
    const effectTypes = [
      EFFECT_TYPES.CAMERA_FORCE_SWITCH,
      EFFECT_TYPES.SCREEN_FADE,
      EFFECT_TYPES.EMIT_SOUND,
      EFFECT_TYPES.CAMERA_BLACKOUT,
    ];
    const newEffect = {
      type: effectTypes[response.selection]
    };
    if (
      newEffect.type === EFFECT_TYPES.SCREEN_FADE ||
      newEffect.type === EFFECT_TYPES.CAMERA_BLACKOUT) {
      newEffect.duration = 40;
    }
    if (newEffect.type === EFFECT_TYPES.EMIT_SOUND) {
      newEffect.soundId = "random.click";
      newEffect.volume = 1.0;
      newEffect.pitch = 1.0;
    }
    const updatedEffects = [...effects, newEffect];
    updateRoutePoint(routePoint.location, routePoint.dimensionId, {
      effects: updatedEffects,
    });
    routePoint.effects = updatedEffects;
    player.sendMessage(`§a[Effects] §7Added effect: §e${newEffect.type}`);
    system.run(() => showEffectsMenu(player, entity, routePoint));
  } catch (e) {
    console.warn("[EffectsMenu] Error:", e);
  }
}
export async function showDeletePointConfirmation(player, entity, routePoint) {
  const loc = routePoint.location;
  const form = new MessageFormData()
    .title("§l§cDelete Route Point")
    .body(
      `§7Are you sure you want to delete route point #${routePoint.order + 1}?\n\n§7Location: §f${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)}\n\n§cThis action cannot be undone!`)
    .button1("§cDelete")
    .button2("§7Cancel");
  try {
    const response = await form.show(player);
    if (response.selection === 0) {
      deleteRoutePoint(routePoint.location, routePoint.dimensionId);
      player.sendMessage("§a[Route Point] §7Point deleted successfully");
      system.run(() => showRouteListMenu(player, entity));
    } else {
      system.run(() => showRoutePointEditor(player, entity, routePoint));
    }
  } catch (e) {
    console.warn("[DeletePoint] Error:", e);
  }
}
export async function showDeleteAllRoutesConfirmation(player, entity) {
  const routeId = getAnimatronicRouteId(entity);
  const routePoints = getRoutePointsForRouteId(routeId);
  const form = new MessageFormData()
    .title("§l§cDelete All Routes")
    .body(
      `§7Are you sure you want to delete ALL §e${routePoints.length}§7 route points?\n\n§cThis action cannot be undone!`)
    .button1("§cDelete All")
    .button2("§7Cancel");
  try {
    const response = await form.show(player);
    if (response.selection === 0) {
      const count = deleteAllRoutePoints(routeId);
      player.sendMessage(
        `§a[Route Points] §7Deleted §e${count}§7 route points`);
    }
    system.run(() => showNightModeTab(player, entity));
  } catch (e) {
    console.warn("[DeleteAllRoutes] Error:", e);
  }
}
export function customPathingTick() {
  if (DEBUG_MODE && system.currentTick % 200 === 0) {
    try { world.sendMessage(`§b[System Heartbeat] §7Tick: ${system.currentTick}, Registry: ${nightModeRegistry.size}`); } catch { }
  }
  processRouteTestTick();
  if (system.currentTick % 20 === 0) {
    processNightMode();
  }
}
function processNightMode() {
  const isNight = isNightTime();
  if (DEBUG_MODE && system.currentTick % 200 === 0) {
    broadcastDebug(`System check - Night: ${isNight}, Entities: ${nightModeRegistry.size}`);
  }
  if (nightModeRegistry.size === 0) return;
  for (const [animatronicId, nightModeData] of nightModeRegistry) {
    nightModeData.animatronicId = animatronicId;
    if (system.currentTick % 200 === 0) {
      console.log(
        `[NightMode] Processing ${animatronicId}- enabled: ${nightModeData.enabled}, routeId: ${nightModeData.routeId}, entityId: ${nightModeData.entityId}`);
    }
    if (!nightModeData.enabled) {
      if (DEBUG_MODE && system.currentTick % 200 === 0) {
        debugLog(`[NightMode] ${animatronicId}- SKIPPED: not enabled`);
      }
      continue;
    }
    const pathingState = nightPathingState.get(animatronicId);
    if (!pathingState) {
      if (DEBUG_MODE && system.currentTick % 200 === 0) {
        debugWarn(
          `[NightMode] ${animatronicId}- SKIPPED: no pathingState found! Creating new one...`);
        nightPathingState.set(animatronicId, {
          currentWaypointIndex: -1,
          visitedWaypoints: new Map(),
          lastMoveTime:
            Date.now() - NIGHT_MODE_CONFIG.MIN_ACTIVE_TIME_MS - 1000,
          state: "idle",
          useRandomOrder: NIGHT_MODE_CONFIG.USE_RANDOM_WAYPOINTS,
          pathfindingSessionId: null,
        });
      }
      continue;
    }
    const routePoints = getRoutePointsForRouteId(nightModeData.routeId);
    if (routePoints.length === 0) {
      if (DEBUG_MODE && system.currentTick % 200 === 0) {
        debugWarn(
          `[NightMode] ${animatronicId}- SKIPPED: no route points found for routeId: ${nightModeData.routeId}`);
      }
      continue;
    }
    const entity = findNightModeEntity(nightModeData);
    if (!entity) {
      nightModeData.missedTicks = (nightModeData.missedTicks || 0) + 1;
      if (nightModeData.missedTicks >= 3) {
        const ps = nightPathingState.get(animatronicId);
        if (ps?.pathfindingSessionId) {
          try { stopPathfinding(ps.pathfindingSessionId); } catch { }
        }
        nightModeRegistry.delete(animatronicId);
        nightPathingState.delete(animatronicId);
        console.warn(`[NightMode] Removed dead/missing animatronic ${animatronicId} after ${nightModeData.missedTicks} missed ticks`);
      } else if (DEBUG_MODE) {
        debugWarn(
          `[NightMode] ${animatronicId}- entity not found (miss ${nightModeData.missedTicks}/3), entityId: ${nightModeData.entityId}`);
      }
      continue;
    }
    nightModeData.missedTicks = 0;
    if (DEBUG_MODE && system.currentTick % 200 === 0) {
      const now = Date.now();
      const timeSinceLastMove = now - pathingState.lastMoveTime;
      debugLog(
        `[NightMode] ${animatronicId}- state: ${pathingState.state}, waypoint: ${pathingState.currentWaypointIndex}, isNight: ${isNight}, routePoints: ${routePoints.length}, timeSinceMove: ${timeSinceLastMove}ms, minRequired: ${NIGHT_MODE_CONFIG.MIN_ACTIVE_TIME_MS}ms`);
    }
    if (isNight) {
      pathingState.isReturningToPlatform = false;
      processNightModeEntity(
        animatronicId,
        nightModeData,
        pathingState,
        routePoints,
        entity);
    } else {
      if (DEBUG_MODE && system.currentTick % 200 === 0) {
        debugLog(
          `[NightMode] Day time processing for ${animatronicId}: isReturning=${pathingState.isReturningToPlatform}, state=${pathingState.state}, isWalking=${nightModeData.isWalking}`);
      }
      if (pathingState.isReturningToPlatform) {
        if (pathingState.pathfindingSessionId) {
          if (!hasActivePathfinding(entity.id)) {
            debugWarn(
              `[NightMode] ${animatronicId}return pathfinding stopped unexpectedly, retrying...`);
            pathingState.isReturningToPlatform = false;
            pathingState.pathfindingSessionId = null;
          }
        } else {
          if (DEBUG_MODE && system.currentTick % 200 === 0) {
            debugLog(
              `[NightMode] ${animatronicId}isReturning=true but no session, resetting...`);
          }
          pathingState.isReturningToPlatform = false;
        }
      }
      if (!pathingState.isReturningToPlatform) {
        let platformLoc = null;
        if (nightModeData.platformLocation) {
          try {
            platformLoc =
              typeof nightModeData.platformLocation === "string"
                ? JSON.parse(nightModeData.platformLocation)
                : nightModeData.platformLocation;
          } catch { }
        }
        if (platformLoc) {
          const distToPlatform = Math.sqrt(
            Math.pow(entity.location.x - platformLoc.x, 2) +
            Math.pow(entity.location.z - platformLoc.z, 2));
          if (distToPlatform > 2) {
            debugLog(
              `[NightMode] Day time! ${animatronicId} is ${distToPlatform.toFixed(1)} blocks from platform, returning...`);
            pathingState.isReturningToPlatform = true;
            returnToPlatform(
              animatronicId,
              nightModeData,
              pathingState,
              entity);
          } else {
            if (nightModeData.isWalking) {
              debugLog(
                `[NightMode] Day time! ${animatronicId}already at platform, converting to statue`);
              convertToStatueAtLocation(animatronicId, entity, platformLoc);
              pathingState.state = "idle";
              pathingState.currentWaypointIndex = -1;
            }
          }
        } else {
          if (nightModeData.isWalking) {
            debugLog(
              `[NightMode] Day time! ${animatronicId}no platform location, converting to statue in place`);
            convertToStatueAtLocation(animatronicId, entity, entity.location);
            pathingState.state = "idle";
          }
        }
      }
    }
  }
}
function findNightModeEntity(nightModeData) {
  try {
    const dimension = world.getDimension(
      nightModeData.dimensionId || "minecraft:overworld");
    const targetAnimatronicId = nightModeData.animatronicId;
    for (const entity of dimension.getEntities()) {
      const entAnimId = entity.getDynamicProperty("fr:animatronic_id");
      if (entAnimId === targetAnimatronicId) {
        nightModeData.entityId = entity.id;
        activeNightEntities.set(entity.id, entAnimId);
        return entity;
      }
    }
    for (const entity of dimension.getEntities()) {
      if (entity.id === nightModeData.entityId) {
        if (
          entity.typeId === nightModeData.entityType ||
          STATUE_TO_ANIMATRONIC[entity.typeId] ||
          ANIMATRONIC_TO_STATUE[entity.typeId]) {
          nightModeData.entityId = entity.id;
          activeNightEntities.set(entity.id, targetAnimatronicId);
          return entity;
        }
      }
    }
    if (nightModeData.platformLocation) {
      const platLoc =
        typeof nightModeData.platformLocation === "string"
          ? JSON.parse(nightModeData.platformLocation)
          : nightModeData.platformLocation;
      const nearbyEntities = dimension.getEntities({
        location: platLoc,
        maxDistance: 100,
      });
      for (const entity of nearbyEntities) {
        if (entity.getDynamicProperty("fr:night_mode_enabled") === true) {
          if (
            STATUE_TO_ANIMATRONIC[entity.typeId] ||
            ANIMATRONIC_TO_STATUE[entity.typeId] ||
            entity.typeId === nightModeData.entityType) {
            nightModeData.entityId = entity.id;
            const animId =
              entity.getDynamicProperty("fr:animatronic_id") ||
              targetAnimatronicId;
            activeNightEntities.set(entity.id, animId);
            return entity;
          }
        }
      }
      if (nightModeData.entityType) {
        const statueType =
          nightModeData.originalStatueType || nightModeData.entityType;
        const animatronicType =
          STATUE_TO_ANIMATRONIC[statueType] || nightModeData.entityType;
        for (const searchType of [statueType, animatronicType]) {
          if (!searchType) continue;
          const typeEntities = dimension.getEntities({
            location: platLoc,
            maxDistance: 50,
            type: searchType,
          });
          if (typeEntities.length > 0) {
            const entity = typeEntities[0];
            nightModeData.entityId = entity.id;
            entity.setDynamicProperty("fr:animatronic_id", targetAnimatronicId);
            entity.setDynamicProperty("fr:night_mode_enabled", true);
            activeNightEntities.set(entity.id, targetAnimatronicId);
            return entity;
          }
        }
      }
    }
  } catch (e) {
    debugWarn("[NightMode] Error finding entity:", e);
  }
  return null;
}
function processNightModeEntity(
  animatronicId,
  nightModeData,
  pathingState,
  routePoints,
  entity) {
  const now = Date.now();
  const aiStats = getAILevelStats(nightModeData.aiLevel || 10);
  if (pathingState.pathfindingSessionId) {
    const hasPath = hasActivePathfinding(entity.id);
    if (hasPath) {

      if (system.currentTick % DETECTION_INTERVAL_TICKS === 0) {
        const nearest = findNearestSurvivalPlayer(entity, 15);
        if (nearest && !pathingState._isDirectChasing) {
          embarkOnKillPath(entity, nearest.player, pathingState);
        }
      }
      return;
    } else {
      debugLog(`[NightMode] Session ${pathingState.pathfindingSessionId} lost for ${animatronicId} (Entity ${entity.id}). Resetting to waiting.`);
      pathingState.pathfindingSessionId = null;
      pathingState.state = "waiting";
      pathingState.waitStartTime = now;
      delete pathingState._isDirectChasing;
    }
  }

  if (pathingState.state === "waiting" || pathingState.state === "idle") {
    if (system.currentTick % DETECTION_INTERVAL_TICKS === 0) {
      const isWaiting = pathingState.state === "waiting";
      const range = isWaiting ? 10 : (aiStats.detectionRange || 15);
      const nearest = findNearestSurvivalPlayer(entity, range);

      if (nearest) {
        embarkOnKillPath(entity, nearest.player, pathingState);
      } else if (DEBUG_MODE && system.currentTick % 200 === 0) {
        debugLog(`[Detection] ${animatronicId} - No players in range ${range}`);
      }
    }
  }

  switch (pathingState.state) {
    case "idle":
      const timeSinceLastMove = now - pathingState.lastMoveTime;
      if (timeSinceLastMove >= NIGHT_MODE_CONFIG.MIN_ACTIVE_TIME_MS) {
        startNightModeMovement(
          animatronicId,
          pathingState,
          routePoints,
          entity,
          aiStats);
      }
      break;
    case "waiting":
      const currentWaypoint = routePoints[pathingState.currentWaypointIndex];
      const baseWaitTime = currentWaypoint?.waitTime || 200;
      const adjustedWaitTime = Math.floor(
        baseWaitTime * aiStats.waitTimeMultiplier * 50);
      if (now - pathingState.waitStartTime >= adjustedWaitTime) {
        pathingState.state = "idle";
        pathingState.lastMoveTime = now;
      }
      break;
    case "moving":

      if (!pathingState.pathfindingSessionId) {
        if (!pathingState._headlessStartTime) {
          pathingState._headlessStartTime = Date.now();
        } else if (Date.now() - pathingState._headlessStartTime > 5000) {
          debugLog(`[NightMode] Moving state timed out without session for ${animatronicId}, resetting.`);
          pathingState.state = "idle";
          delete pathingState._headlessStartTime;
        }
      } else {
        delete pathingState._headlessStartTime;
      }
      break;
  }
}
function startNightModeMovement(
  animatronicId,
  pathingState,
  routePoints,
  entity,
  aiStats) {
  const nextIndex = selectNightWaypoint(
    animatronicId,
    routePoints,
    pathingState.currentWaypointIndex);

  if (nextIndex < 0 || nextIndex === pathingState.currentWaypointIndex) {
    return;
  }

  moveToWaypoint(animatronicId, nightModeRegistry.get(animatronicId), pathingState, nextIndex, entity, routePoints, aiStats);
}

function moveToWaypoint(
  animatronicId,
  nightModeData,
  pathingState,
  waypointIndex,
  entity,
  routePoints,
  aiStats = null) {

  if (!nightModeData) nightModeData = nightModeRegistry.get(animatronicId);
  debugLog(`[NightMode] moveToWaypoint called for ${animatronicId}, WP ${waypointIndex}, routePoints length: ${routePoints ? routePoints.length : 'null'}`);
  if (!nightModeData) return;

  if (!aiStats) aiStats = getAILevelStats(nightModeData.aiLevel || 10);

  const targetWaypoint = routePoints[waypointIndex];
  if (!targetWaypoint || !targetWaypoint.location) {
    debugLog(`[NightMode] moveToWaypoint FAILED: targetWaypoint ${waypointIndex} is invalid or missing location. RoutePoints[${waypointIndex}]: ${JSON.stringify(targetWaypoint)}`);
    return;
  }
  const dimension = entity.dimension;
  const entityType = entity.typeId;
  let walkingEntity = ensureWalkingEntity(entity, animatronicId, nightModeData);
  if (!walkingEntity) return;

  debugLog(
    `[NightMode] ${animatronicId} starting pathfinding to waypoint ${waypointIndex}`);
  const dimId = walkingEntity.dimension.id;
  const currentWaypoint = routePoints[pathingState.currentWaypointIndex];
  const linkedCamera = currentWaypoint ? currentWaypoint.linkedCamera : null;
  const depSession = {
    dimensionId: dimId,
    origin: walkingEntity.location,
    linkedCamera: linkedCamera,
  };
  executeScreenFade({ duration: 10 }, depSession);
  executeCameraRefresh(depSession);
  try {
    walkingEntity.triggerEvent("fr:start_walking");
  } catch { }
  debugLog(`[NightMode] ${animatronicId} calling startPathfinding to ${JSON.stringify(targetWaypoint.location)}`);
  const forceChase = pathingState.forceChase || false;
  if (pathingState.forceChase) delete pathingState.forceChase;

  const sessionId = startPathfinding(walkingEntity, targetWaypoint.location, {
    pose: targetWaypoint.pose,
    variant: targetWaypoint.variant,
    rotation: normalizeCompassRotationToYaw(targetWaypoint.rotation),
    waitTime: 0,
    detectPlayers: forceChase || (aiStats.aggressionChance > Math.random()),
    onArrival: (session, ent) => {
      debugLog(`[NightMode] onArrival triggered for ${animatronicId}, session ${session.id}`);
      handleNightModeArrival(animatronicId, waypointIndex, ent);
    },
    onFailed: (session) => {
      debugLog(`[NightMode] onFailed triggered for ${animatronicId}, session ${session.id}`);
      handleNightModePathFailed(animatronicId, waypointIndex);
    },
    onChaseEnd: (session) => {
      debugLog(`[NightMode] onChaseEnd for ${animatronicId}. Recalculating route.`);
      const ps = nightPathingState.get(animatronicId);
      if (ps) {
        ps.state = "idle";
        ps.lastMoveTime = 0;
        ps.pathfindingSessionId = null;
      }
    }
  });
  if (sessionId) {
    debugLog(`[NightMode] Started session ${sessionId} for ${animatronicId} to WP ${waypointIndex} (Entity ${walkingEntity.id})`);
    pathingState.pathfindingSessionId = sessionId;
    pathingState.state = "moving";
    pathingState.currentWaypointIndex = waypointIndex;
    markWaypointVisited(animatronicId, waypointIndex);
  } else {
    debugWarn(`[NightMode] Failed to start pathfinding for ${animatronicId}`);
    pathingState.state = "idle";
    pathingState.lastMoveTime = Date.now() + 5000;
  }
}
function handleNightModeArrival(animatronicId, waypointIndex, entity) {
  const pathingState = nightPathingState.get(animatronicId);
  const nightModeData = nightModeRegistry.get(animatronicId);
  if (!pathingState || !nightModeData) return;
  debugLog(`[NightMode] ${animatronicId}arrived at waypoint ${waypointIndex}`);
  try {
    entity.triggerEvent("fr:stop_walking");
  } catch { }
  const routeId = nightModeData.routeId;
  const routePoints = getRoutePointsForRouteId(routeId);
  let routePointData = null;
  if (routePoints && routePoints[waypointIndex]) {
    routePointData = routePoints[waypointIndex];
    debugLog(`[NightMode] Route point data for waypoint ${waypointIndex}:`, JSON.stringify(routePointData));
    const effectSession = {
      dimensionId: entity.dimension.id,
      origin: entity.location,
      linkedCamera: routePointData.linkedCamera || null,
      playerId: null,
    };
    executeRoutePointEffects(routePointData, effectSession);
  }
  if (nightModeData.isWalking) {
    debugLog(`[NightMode] ${animatronicId} converting to statue on waypoint arrival`);
    convertToStatueAtLocation(animatronicId, entity, entity.location, routePointData);
  }

  pathingState.pathfindingSessionId = null;
  pathingState.state = "waiting";
  pathingState.waitStartTime = Date.now();
  delete pathingState._isDirectChasing;
}
function convertToStatueAtLocation(animatronicId, walkingEntity, location, routePointData = null) {
  const nightModeData = nightModeRegistry.get(animatronicId);
  if (!nightModeData) return null;
  const statueType =
    nightModeData.originalStatueType ||
    ANIMATRONIC_TO_STATUE[walkingEntity.typeId];
  if (!statueType) {
    debugWarn(
      `[NightMode] Could not determine statue type for ${walkingEntity.typeId}`,
    );
    return null;
  }
  const dimension = walkingEntity.dimension;
  let variantIndex = walkingEntity.getDynamicProperty("fr:variant_index") || 0;
  if (routePointData?.variant !== undefined && routePointData?.variant !== null && routePointData.variant >= 0) {
    variantIndex = routePointData.variant;
  } else if (nightModeData.platformVariantIndex !== undefined) {
    variantIndex = nightModeData.platformVariantIndex;
  }
  let poseIndex = 0;
  if (routePointData?.pose !== undefined && routePointData?.pose !== null) {
    poseIndex = routePointData.pose;
  } else if (nightModeData.platformPoseIndex !== undefined) {
    poseIndex = nightModeData.platformPoseIndex;
  }
  let rotation = 0;
  if (routePointData?.rotation !== undefined && routePointData?.rotation !== null) {
    rotation = routePointData.rotation;
  } else if (nightModeData.platformRotation !== undefined) {
    rotation = nightModeData.platformRotation;
  }
  broadcastDebug(`[NightMode] convertToStatue ${animatronicId}: pose=${poseIndex}, rot=${rotation}, variant=${variantIndex}, hasRouteData=${!!routePointData}, platformPose=${nightModeData.platformPoseIndex}, platformRot=${nightModeData.platformRotation}, platformVar=${nightModeData.platformVariantIndex}`);
  try {
    const statue = dimension.spawnEntity(statueType, location);
    try {
      statue.addTag("fr_skip_place");
    } catch { }
    statue.setDynamicProperty("fr:animatronic_id", animatronicId);
    statue.setDynamicProperty("fr:night_mode_enabled", true);
    statue.setDynamicProperty("fr:variant_index", variantIndex);
    statue.setDynamicProperty("fr:pose_index", poseIndex);
    const linkedStageplate =
      walkingEntity.getDynamicProperty("fr:linked_stageplate") ||
      nightModeData.stageplateKey;
    if (linkedStageplate) {
      statue.setDynamicProperty("fr:linked_stageplate", linkedStageplate);
    }
    const routeId =
      getAnimatronicRouteId(walkingEntity) || nightModeData.routeId || 0;
    if (routeId) {
      statue.setDynamicProperty("fr:route_id", routeId);
    }
    const platformLocation =
      nightModeData.platformLocation ||
      walkingEntity.getDynamicProperty("fr:platform_location");
    if (platformLocation) {
      statue.setDynamicProperty(
        "fr:platform_location",
        typeof platformLocation === "string"
          ? platformLocation
          : JSON.stringify(platformLocation),
      );
    }
    let rotDegrees = 0;
    if (rotation !== undefined && rotation !== null) {
      const rotNum = Number(rotation);
      if (Number.isFinite(rotNum)) {
        const yawDeg =
          Math.abs(rotNum) <= Math.PI * 2 + 0.001 && !Number.isInteger(rotNum)
            ? (rotNum * 180) / Math.PI
            : rotNum;
        rotDegrees = (((Math.round(yawDeg) % 360) + 360) % 360);
      }
    }
    try {
      statue.teleport(location, {
        rotation: {
          x: 0,
          y: rotDegrees,
        },
      });
      debugLog(
        `[NightMode] Applied rotation ${rotDegrees}° to statue immediately`,
      );
    } catch { }
    if (variantIndex > 0) {
      try {
        statue.triggerEvent(`fr:set_variant_${variantIndex}`);
      } catch { }
    }
    if (poseIndex > 0) {
      try {
        statue.triggerEvent(`fr:set_pose_${poseIndex}`);
        debugLog(`[NightMode] Applied pose ${poseIndex}to statue`);
      } catch { }
    }
    if (rotation !== undefined && rotation !== null) {
      system.runTimeout(() => {
        try {
          if (!statue || !statue.isValid) return;
          const pos = statue.location;
          statue.teleport(
            { x: pos.x, y: pos.y, z: pos.z },
            { rotation: { x: 0, y: rotDegrees } },
          );
        } catch { }
      }, 3);
    }
    walkingEntity.remove();
    nightModeData.isWalking = false;
    nightModeData.walkingEntityId = null;
    nightModeData.entityId = statue.id;
    activeNightEntities.delete(walkingEntity.id);
    activeNightEntities.set(statue.id, animatronicId);
    debugLog(
      `[NightMode] Converted back to statue ${statue.id}at waypoint (pose: ${poseIndex}, rotation: ${rotDegrees}°, variant: ${variantIndex})`,
    );
    return statue;
  } catch (e) {
    debugWarn(`[NightMode] Error converting to statue: ${e}`);
    return null;
  }
}
function handleNightModePathFailed(animatronicId, waypointIndex) {
  const pathingState = nightPathingState.get(animatronicId);
  if (!pathingState) return;
  debugWarn(
    `[NightMode] ${animatronicId}failed to reach waypoint ${waypointIndex}`);
  pathingState.pathfindingSessionId = null;
  pathingState.state = "idle";
  pathingState.lastMoveTime = Date.now();
}
function returnToPlatform(animatronicId, nightModeData, pathingState, entity) {
  if (pathingState.pathfindingSessionId) {
    stopPathfinding(pathingState.pathfindingSessionId);
    pathingState.pathfindingSessionId = null;
  }
  let platformLoc = null;
  if (nightModeData.platformLocation) {
    try {
      platformLoc =
        typeof nightModeData.platformLocation === "string"
          ? JSON.parse(nightModeData.platformLocation)
          : nightModeData.platformLocation;
    } catch { }
  }
  if (!platformLoc) {
    pathingState.state = "idle";
    if (nightModeData.isWalking) {
      convertToStatueAtLocation(animatronicId, entity, entity.location);
    }
    return;
  }
  let walkingEntity = entity;
  const entityType = entity.typeId;
  if (STATUE_TO_ANIMATRONIC[entityType] && !nightModeData.isWalking) {
    const animatronicType = STATUE_TO_ANIMATRONIC[entityType];
    const dimension = entity.dimension;
    const variantIndex = entity.getDynamicProperty("fr:variant_index") || 0;
    try {
      walkingEntity = dimension.spawnEntity(animatronicType, entity.location);
      walkingEntity.setDynamicProperty("fr:animatronic_id", animatronicId);
      walkingEntity.setDynamicProperty("fr:night_mode_enabled", true);
      walkingEntity.setDynamicProperty("fr:variant_index", variantIndex);
      walkingEntity.setDynamicProperty(
        "fr:platform_location",
        nightModeData.platformLocation,
      );
      const linkedStageplate = entity.getDynamicProperty("fr:linked_stageplate");
      if (linkedStageplate) {
        walkingEntity.setDynamicProperty("fr:linked_stageplate", linkedStageplate);
      }
      const routeId =
        getAnimatronicRouteId(entity) || nightModeData.routeId || 0;
      if (routeId) {
        walkingEntity.setDynamicProperty("fr:route_id", routeId);
      }
      walkingEntity.setDynamicProperty("fr:original_statue_type", entityType);
      if (variantIndex > 0) {
        try {
          walkingEntity.triggerEvent(`fr:set_variant_${variantIndex}`);
        } catch { }
      }
      entity.remove();
      nightModeData.isWalking = true;
      nightModeData.walkingEntityId = walkingEntity.id;
      nightModeData.entityId = walkingEntity.id;
      nightModeData.originalStatueType = entityType;
      activeNightEntities.delete(entity.id);
      activeNightEntities.set(walkingEntity.id, animatronicId);
    } catch (e) {
      debugWarn(`[NightMode] Error converting for return: ${e}`);
      try {
        entity.teleport(platformLoc);
      } catch { }
      pathingState.state = "idle";
      return;
    }
  }
  debugLog(`[NightMode] ${animatronicId}returning to platform (day time)`);
  try {
    walkingEntity.triggerEvent("fr:start_walking");
  } catch { }
  const sessionId = startPathfinding(walkingEntity, platformLoc, {
    pose: 0,
    detectPlayers: false,
    onArrival: (session, ent) => {
      debugLog(`[NightMode] ${animatronicId}returned to platform`);
      const nmd = nightModeRegistry.get(animatronicId);
      if (nmd && nmd.isWalking) {
        convertToStatueAtLocation(animatronicId, ent, platformLoc);
      } else {
        try {
          ent.triggerEvent("fr:stop_walking");
          ent.triggerEvent("fr:set_pose_0");
        } catch { }
      }
      const ps = nightPathingState.get(animatronicId);
      if (ps) {
        ps.state = "idle";
        ps.pathfindingSessionId = null;
        ps.currentWaypointIndex = -1;
        ps.isReturningToPlatform = false;
      }
    },
    onFailed: () => {
      debugWarn(
        `[NightMode] ${animatronicId}failed to return to platform, teleporting`,
      );
      try {
        walkingEntity.teleport(platformLoc);
      } catch { }
      const nmd = nightModeRegistry.get(animatronicId);
      if (nmd && nmd.isWalking) {
        convertToStatueAtLocation(animatronicId, walkingEntity, platformLoc);
      }
      const ps = nightPathingState.get(animatronicId);
      if (ps) {
        ps.state = "idle";
        ps.pathfindingSessionId = null;
        ps.isReturningToPlatform = false;
      }
    },
  });
  if (sessionId) {
    pathingState.pathfindingSessionId = sessionId;
    pathingState.state = "returning";
  } else {
    debugWarn(
      `[NightMode] ${animatronicId}pathfinding failed to start, teleporting to platform`);
    try {
      walkingEntity.teleport(platformLoc);
      debugLog(`[NightMode] ${animatronicId}teleported to platform`);
    } catch (e) {
      debugWarn(`[NightMode] Failed to teleport: ${e}`);
    }
    if (nightModeData.isWalking) {
      system.runTimeout(() => {
        try {
          convertToStatueAtLocation(animatronicId, walkingEntity, platformLoc);
        } catch (e) {
          debugWarn(`[NightMode] Failed to convert to statue: ${e}`);
        }
      }, 5);
    }
    pathingState.state = "idle";
    pathingState.isReturningToPlatform = false;
  }
}
export function initCustomPathingSystem() {
  const savedCounter = world.getDynamicProperty("fr:route_point_counter");
  if (savedCounter) {
    nextRoutePointId = savedCounter;
  }

  loadRoutePointsFromStorage();

  restoreNightModeEntities();

  system.runInterval(() => {
    customPathingTick();
    processCameraBlockage();
  }, 1);
  initAStarPathfinding();
  initScriptEventHandlers();
}

function restoreNightModeEntities() {
  const overworld = world.getDimension("overworld");
  const entities = overworld.getEntities();
  let restoredCount = 0;
  for (const entity of entities) {
    if (isAnimatronic(entity) || isStatue(entity)) {
      const isEnabled = entity.getDynamicProperty("fr:night_mode_enabled") === true;
      if (isEnabled) {
        enableNightMode(entity);
        restoredCount++;
      }
    }
  }
  console.log(`[CustomPathing] Restored ${restoredCount} night mode entities.`);

  system.runTimeout(() => {
    resumeInterruptedMovements();
  }, 10);
}

function resumeInterruptedMovements() {
  debugLog("[CustomPathing] Checking for interrupted movements...");
  for (const [animatronicId, nightModeData] of nightModeRegistry) {
    try {
      const pathingState = nightPathingState.get(animatronicId);
      if (!pathingState || !nightModeData.enabled) continue;

      const entity = findNightModeEntity(nightModeData);
      if (!entity) continue;

      if (hasActivePathfinding(entity.id)) continue;

      if (pathingState.state === "moving" && pathingState.currentWaypointIndex >= 0) {
        debugLog(`[CustomPathing] Resuming MOVEMENT for ${animatronicId} to WP #${pathingState.currentWaypointIndex}`);
        moveToWaypoint(animatronicId, nightModeData, pathingState, pathingState.currentWaypointIndex, entity, getRoutePointsForRouteId(nightModeData.routeId));
      } else if (pathingState.state === "returning") {
        debugLog(`[CustomPathing] Resuming RETURN for ${animatronicId}`);
        returnToPlatform(animatronicId, nightModeData, pathingState, entity);
      }
    } catch (e) {
      console.warn(`[CustomPathing] Error resuming ${animatronicId}:`, e);
    }
  }
}
function initScriptEventHandlers() {
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    const {
      id, message, sourceEntity }
      = event;
    try {
      if (id === "fr:ai_level") {
        handleAILevelCommand(message, sourceEntity);
        return;
      }
      if (id === "fr:random_waypoints") {
        handleRandomWaypointsCommand(message, sourceEntity);
        return;
      }
      if (id === "fr:ai_info") {
        handleAIInfoCommand(message, sourceEntity);
        return;
      }
    } catch (e) {
      console.warn("[ScriptEvent] Error handling command:", e);
      if (sourceEntity) {
        sourceEntity.sendMessage(`§c[Error] §7${e.message}`);
      }
    }
  });
}
function handleAILevelCommand(message, sourceEntity) {
  const parts = message.trim().split(/\s+/);
  if (parts.length < 4) {
    if (sourceEntity) {
      sourceEntity.sendMessage(
        "§c[AI Level] §7Usage: /scriptevent fr:ai_level <x> <y> <z> <level>\n" +
        "§7Example: /scriptevent fr:ai_level 100 64 200 15");
    }
    return;
  }
  const x = parseFloat(parts[0]);
  const y = parseFloat(parts[1]);
  const z = parseFloat(parts[2]);
  const level = parseInt(parts[3]);
  if (isNaN(x) || isNaN(y) || isNaN(z)) {
    if (sourceEntity) {
      sourceEntity.sendMessage("§c[AI Level] §7Invalid coordinates!");
    }
    return;
  }
  if (
    isNaN(level) ||
    level < AI_LEVEL_CONFIG.MIN_LEVEL ||
    level > AI_LEVEL_CONFIG.MAX_LEVEL) {
    if (sourceEntity) {
      sourceEntity.sendMessage(
        `§c[AI Level] §7Invalid level! Must be between ${AI_LEVEL_CONFIG.MIN_LEVEL} and ${AI_LEVEL_CONFIG.MAX_LEVEL}`);
    }
    return;
  }
  const dimensionId = sourceEntity?.dimension?.id || "minecraft:overworld";
  const result = setAILevelByPlatform(dimensionId, x, y, z, level);
  if (sourceEntity) {
    if (result.success) {
      const stats = getAILevelStats(level);
      sourceEntity.sendMessage(
        `§a[AI Level] §7Set ${result.count} animatronic(s) to ${stats.difficulty}§7(Level ${level})`);
    } else {
      sourceEntity.sendMessage(
        `§c[AI Level] §7No animatronic found at platform (${Math.floor(x)}, ${Math.floor(y)}, ${Math.floor(z)})\n` +
        "§7Make sure coordinates match the platform location exactly.");
    }
  }
}
function handleRandomWaypointsCommand(message, sourceEntity) {
  const parts = message.trim().split(/\s+/);
  if (parts.length < 4) {
    if (sourceEntity) {
      sourceEntity.sendMessage(
        "§c[Random Waypoints] §7Usage: /scriptevent fr:random_waypoints <x> <y> <z> <true/false>");
    }
    return;
  }
  const x = parseFloat(parts[0]);
  const y = parseFloat(parts[1]);
  const z = parseFloat(parts[2]);
  const enable = parts[3].toLowerCase() === "true";
  if (isNaN(x) || isNaN(y) || isNaN(z)) {
    if (sourceEntity) {
      sourceEntity.sendMessage("§c[Random Waypoints] §7Invalid coordinates!");
    }
    return;
  }
  const dimensionId = sourceEntity?.dimension?.id || "minecraft:overworld";
  try {
    const dimension = world.getDimension(dimensionId);
    const platformLoc = {
      x: Math.floor(x),
      y: Math.floor(y),
      z: Math.floor(z),
    };
    const entities = dimension.getEntities({
      location: platformLoc,
      maxDistance: 3,
    });
    let updated = 0;
    for (const entity of entities) {
      if (isAnimatronic(entity) || STATUE_TYPES.includes(entity.typeId)) {
        const animatronicId = getOrCreateAnimatronicId(entity);
        let pathingState = nightPathingState.get(animatronicId);
        if (!pathingState) {
          pathingState = {
            currentWaypointIndex: -1,
            visitedWaypoints: new Map(),
            lastMoveTime: Date.now(),
            state: "idle",
            useRandomOrder: enable,
          };
          nightPathingState.set(animatronicId, pathingState);
        } else {
          pathingState.useRandomOrder = enable;
        }
        updated++;
      }
    }
    if (sourceEntity) {
      if (updated > 0) {
        sourceEntity.sendMessage(
          `§a[Random Waypoints] §7${enable ? "Enabled" : "Disabled"} for ${updated} animatronic(s)`);
      } else {
        sourceEntity.sendMessage(
          `§c[Random Waypoints] §7No animatronic found at (${Math.floor(x)}, ${Math.floor(y)}, ${Math.floor(z)})`);
      }
    }
  } catch (e) {
    console.warn("[RandomWaypoints] Error:", e);
    if (sourceEntity) {
      sourceEntity.sendMessage(`§c[Error] §7${e.message}`);
    }
  }
}
function handleAIInfoCommand(message, sourceEntity) {
  const parts = message.trim().split(/\s+/);
  if (parts.length < 3) {
    if (sourceEntity) {
      sourceEntity.sendMessage(
        "§c[AI Info] §7Usage: /scriptevent fr:ai_info <x> <y> <z>");
    }
    return;
  }
  const x = parseFloat(parts[0]);
  const y = parseFloat(parts[1]);
  const z = parseFloat(parts[2]);
  if (isNaN(x) || isNaN(y) || isNaN(z)) {
    if (sourceEntity) {
      sourceEntity.sendMessage("§c[AI Info] §7Invalid coordinates!");
    }
    return;
  }
  const dimensionId = sourceEntity?.dimension?.id || "minecraft:overworld";
  try {
    const dimension = world.getDimension(dimensionId);
    const platformLoc = {
      x: Math.floor(x),
      y: Math.floor(y),
      z: Math.floor(z),
    };
    const entities = dimension.getEntities({
      location: platformLoc,
      maxDistance: 3,
    });
    let found = false;
    for (const entity of entities) {
      if (isAnimatronic(entity) || STATUE_TYPES.includes(entity.typeId)) {
        found = true;
        const aiLevel = getAILevel(entity);
        const stats = getAILevelStats(aiLevel);
        const animatronicId = getOrCreateAnimatronicId(entity);
        const pathingState = nightPathingState.get(animatronicId);
        const nightData = nightModeRegistry.get(animatronicId);
        if (sourceEntity) {
          sourceEntity.sendMessage(
            `§6=== AI Info ===\n` +
            `§7Entity: §f${entity.typeId}\n` +
            `§7AI Level: ${stats.difficulty}§7(${aiLevel}/20)\n` +
            `§7Speed: §f${(stats.speedMultiplier * 100).toFixed(0)}%\n` +
            `§7Wait Time: §f${(stats.waitTimeMultiplier * 100).toFixed(0)}%\n` +
            `§7Detection: §f${stats.detectionRange.toFixed(1)} blocks\n` +
            `§7Aggression: §f${(stats.aggressionChance * 100).toFixed(0)}%\n` +
            `§7Random Waypoints: ${pathingState?.useRandomOrder ? "§aYes" : "§cNo"}\n` +
            `§7Night Mode: ${nightData?.enabled ? "§aEnabled" : "§cDisabled"}\n` +
            `§7Current Waypoint: §f${pathingState?.currentWaypointIndex ?? "N/A"}`);
        }
        break;
      }
    }
    if (!found && sourceEntity) {
      sourceEntity.sendMessage(
        `§c[AI Info] §7No animatronic found at (${Math.floor(x)}, ${Math.floor(y)}, ${Math.floor(z)})`);
    }
  } catch (e) {
    console.warn("[AIInfo] Error:", e);
    if (sourceEntity) {
      sourceEntity.sendMessage(`§c[Error] §7${e.message}`);
    }
  }
}
function processCameraBlockage() {
  if (nightModeRegistry.size === 0) return;
  const players = world.getAllPlayers();
  if (players.length === 0) return;
  const blockers = [];
  for (const [animatronicId, nightData] of nightModeRegistry.entries()) {
    const pathingState = nightPathingState.get(animatronicId);
    if (
      pathingState &&
      pathingState.state === "waiting" &&
      pathingState.currentWaypointIndex >= 0
    ) {
      const routeId = nightData.routeId;
      const routePoints = getRoutePointsForRouteId(routeId);
      if (routePoints && routePoints[pathingState.currentWaypointIndex]) {
        const rp = routePoints[pathingState.currentWaypointIndex];
        if (
          rp.effects &&
          rp.effects.some((e) => e.type === EFFECT_TYPES.CAMERA_BLACKOUT)
        ) {
          if (rp.linkedCamera) {
            blockers.push({ linkedCamera: rp.linkedCamera });
          }
        }
      }
    }
  }
  for (const player of players) {
    const isViewingCamera =
      player.getDynamicProperty("fr:viewing_camera") ||
      player.hasTag("fr:viewing_camera") ||
      player.getDynamicProperty("fr:viewing_camera_pos") !== undefined;
    const activeBlackoutCam = player.getDynamicProperty("fr:active_blackout_cam");
    if (isViewingCamera) {
      const camPosStr = player.getDynamicProperty("fr:viewing_camera_pos");
      if (camPosStr) {
        let blocked = false;
        if (blockers.some((b) => b.linkedCamera === camPosStr)) {
          blocked = true;
        }
        if (blocked) {
          if (activeBlackoutCam !== camPosStr) {
            try {
              player.runCommand(`title @s actionbar §ᄀ§ᄁ§ᄂ`);
              player.setDynamicProperty("fr:active_blackout_cam", camPosStr);
            } catch { }
          }
        } else {
          if (activeBlackoutCam) {
            try {
              player.runCommand(`title @s actionbar §r`);
              player.setDynamicProperty("fr:active_blackout_cam", undefined);
            } catch { }
          }
        }
      }
    } else {
      if (activeBlackoutCam) {
        try {
          player.setDynamicProperty("fr:active_blackout_cam", undefined);
        } catch { }
      }
    }
  }
}

function embarkOnKillPath(entity, target, pathingState) {
  const animatronicId = getOrCreateAnimatronicId(entity);
  const nightModeData = nightModeRegistry.get(animatronicId);

  const walkingEntity = ensureWalkingEntity(entity, animatronicId, nightModeData);
  if (!walkingEntity) return;

  broadcastDebug(`[Kill Path] ${animatronicId} is going for ${target.name}!`);

  const depSession = {
    dimensionId: walkingEntity.dimension.id,
    origin: walkingEntity.location,
  };
  executeScreenFade({ duration: 10 }, depSession);
  executeCameraRefresh(depSession);

  if (pathingState.pathfindingSessionId) {
    stopPathfinding(pathingState.pathfindingSessionId);
  }

  const sessionId = startPathfinding(walkingEntity, target.location, {
    detectPlayers: true,
    onFailed: (session) => {
      broadcastDebug(`[Kill Path] Pathfinding failed for ${animatronicId}. Resetting to route mode...`);
      pathingState._isDirectChasing = false;
      pathingState.state = "idle";
      pathingState.lastMoveTime = Date.now();
      if (pathingState.pathfindingSessionId) {
        try { stopPathfinding(pathingState.pathfindingSessionId); } catch { }
        pathingState.pathfindingSessionId = null;
      }
    },
    onChaseEnd: (session) => {
      broadcastDebug(`[Kill Path] Chase ended for ${animatronicId}. Resetting to route mode...`);
      pathingState._isDirectChasing = false;
      pathingState.state = "idle";
      pathingState.lastMoveTime = Date.now();

      if (pathingState.pathfindingSessionId) {
        stopPathfinding(pathingState.pathfindingSessionId);
        pathingState.pathfindingSessionId = null;
      }
    }
  });

  if (sessionId) {
    const session = getSessionByEntityId(walkingEntity.id);
    if (session) {
      session.state = "chasing";
      session.chaseTargetId = target.id;
      session.isChasing = true;
    }
    pathingState.pathfindingSessionId = sessionId;
    pathingState.state = "moving";
    pathingState._isDirectChasing = true;
    try { walkingEntity.triggerEvent("fr:start_chasing"); } catch { }
    try { walkingEntity.triggerEvent("fr:start_walking"); } catch { }
  }
}

function ensureWalkingEntity(entity, animatronicId, nightModeData) {
  if (!nightModeData) return entity;
  const entityType = entity.typeId;
  const animatronicType = STATUE_TO_ANIMATRONIC[entityType];
  if (!animatronicType) return entity;

  const dimension = entity.dimension;
  const spawnLocation = { ...entity.location };
  const variantIndex = entity.getDynamicProperty("fr:variant_index") || 0;
  const currentPoseIndex = entity.getDynamicProperty("fr:pose_index") || 0;

  if (currentPoseIndex > 0) {
    nightModeData.platformPoseIndex = currentPoseIndex;
  }
  if (variantIndex > 0) {
    nightModeData.platformVariantIndex = variantIndex;
  }

  console.log(`[NightMode] Converting statue ${entityType} to animatronic ${animatronicType}`);
  try {
    const walkingEntity = dimension.spawnEntity(animatronicType, spawnLocation);
    walkingEntity.setDynamicProperty("fr:animatronic_id", animatronicId);
    walkingEntity.setDynamicProperty("fr:night_mode_enabled", true);
    walkingEntity.setDynamicProperty("fr:variant_index", variantIndex);
    walkingEntity.setDynamicProperty("fr:pose_index", currentPoseIndex);
    walkingEntity.setDynamicProperty("fr:platform_pose_index", nightModeData.platformPoseIndex);
    walkingEntity.setDynamicProperty("fr:platform_variant_index", nightModeData.platformVariantIndex);
    walkingEntity.setDynamicProperty("fr:route_id", nightModeData.routeId);
    walkingEntity.setDynamicProperty("fr:platform_location", nightModeData.platformLocation);
    walkingEntity.setDynamicProperty("fr:original_statue_type", entityType);

    if (variantIndex > 0) {
      try { walkingEntity.triggerEvent(`fr:set_variant_${variantIndex}`); } catch { }
    }

    entity.remove();
    nightModeData.isWalking = true;
    nightModeData.walkingEntityId = walkingEntity.id;
    nightModeData.entityId = walkingEntity.id;
    nightModeData.originalStatueType = entityType;

    activeNightEntities.delete(entity.id);
    activeNightEntities.set(walkingEntity.id, animatronicId);

    return walkingEntity;
  } catch (e) {
    debugWarn(`[NightMode] Error converting statue to animatronic: ${e}`);
    return entity;
  }
}

export {
  stageplateRegistry,
  routePointRegistry,
  nightModeRegistry,
  routeTestSessions,
  walkingEntities,
  activePathingSessions,
};
