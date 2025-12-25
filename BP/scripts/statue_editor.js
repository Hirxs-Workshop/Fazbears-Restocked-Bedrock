
import { world, system, EquipmentSlot, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
// import { startPathingForAnimatronic, stopPathingForEntity, cleanupLuresNearEntity, startPathingSimulation } from "./experimental/pathing_system.js";

const POSES = [
  { name: "stand.anim", icon: "textures/fr_ui/poses/bonnie_statue_pose_stand" },
  { name: "stage.anim", icon: "textures/fr_ui/poses/bonnie_statue_pose_stage" },
  { name: "stare.anim", icon: "textures/fr_ui/poses/bonnie_statue_pose_stare" },
  { name: "ending.anim", icon: "textures/fr_ui/poses/bonnie_statue_pose_ending" },
  { name: "celebrate.anim", icon: "textures/fr_ui/poses/bonnie_statue_pose_celebrate" },
  { name: "jam.anim", icon: "textures/fr_ui/poses/bonnie_statue_pose_jam" },
  { name: "sit.anim", icon: "textures/fr_ui/poses/brick" },
  { name: "thank_you.anim", icon: "textures/fr_ui/poses/feather" },
  { name: "ar_render.anim", icon: "textures/fr_ui/poses/blaze_rod" },
  { name: "mugshot.anim", icon: "textures/fr_ui/poses/iron_sword" },
  { name: "cam_lean.anim", icon: "textures/fr_ui/poses/ender_pearl" },
  { name: "look_up.anim", icon: "textures/fr_ui/poses/glowstone_dust" }
];

const POSES_PER_PAGE = 6;

const VARIANTS_PER_PAGE = 3;

const entityStates = new Map();

const playerPosePage = new Map();
const playerVariantPage = new Map();

const nightModeAnimatronics = new Map();

const nightModeStatues = new Map();

const playerLinkingMode = new Map();

const walkingEntities = new Map();

const ARRIVAL_DISTANCE = 1.0;

const NIGHT_START = 13000;
const NIGHT_END = 23000;

function isNightTime(dimension) {
  try {
    const time = world.getTimeOfDay();

    return time >= NIGHT_START && time < NIGHT_END;
  } catch {
    return false;
  }
}

function getDistance(pos1, pos2) {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function getHorizontalDistance(pos1, pos2) {
  const dx = pos2.x - pos1.x;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function normalizeRotation(rotation) {

  let normalized = rotation % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized < -180) normalized += 360;

  const rounded = Math.round(normalized / 90) * 90;

  if (rounded === 180) return -180;

  return rounded;
}

const MOVE_SPEED = 0.10;

const PATH_DRAW_INTERVAL = 2;

const MAX_PATH_SEARCH = 12000;

export function walkEntityTo(entity, targetLocation, onArrival, onNoPath = null, options = {}) {
  try {
    const dimension = entity.dimension;

    if (walkingEntities.has(entity.id)) {
      console.log(`[Pathfinding] Clearing previous walk data for entity`);
      walkingEntities.delete(entity.id);
    }

    try { entity.removeTag("returning_home"); } catch { }
    try { entity.removeTag("fr_no_attack"); } catch { }

    entity.addTag("returning_home");
    entity.addTag("fr_no_attack");
    entity.triggerEvent("bonnie_return_home");

    const startPos = {
      x: Math.floor(entity.location.x),
      y: Math.round(entity.location.y),
      z: Math.floor(entity.location.z)
    };
    const endPos = {
      x: Math.floor(targetLocation.x),
      y: Math.floor(targetLocation.y),
      z: Math.floor(targetLocation.z)
    };

    console.log(`[Pathfinding] Calculating path from (${startPos.x},${startPos.y},${startPos.z}) to (${endPos.x},${endPos.y},${endPos.z})`);

    const path = findPathBFS(dimension, startPos, endPos);

    if (path.length > 0) {
      const firstPoint = path[0];
      const distToFirst = Math.sqrt(
        Math.pow(entity.location.x - (firstPoint.x + 0.5), 2) +
        Math.pow(entity.location.z - (firstPoint.z + 0.5), 2)
      );

      if (distToFirst < 0.8 && path.length > 1) {

        path.shift();
      }
    }

    if (path.length === 0) {
      console.warn(`[Pathfinding] No valid path found to target!`);
      entity.removeTag("returning_home");
      entity.removeTag("fr_no_attack");

      if (onNoPath) {
        onNoPath(entity, targetLocation);
      } else {

        console.log(`[Pathfinding] No onNoPath callback, teleporting directly.`);
        entity.teleport(targetLocation);
        if (onArrival) onArrival(entity);
      }
      return;
    }

    const isPartialPath = path.isPartial === true;
    if (isPartialPath) {
      console.log(`[Pathfinding] Using PARTIAL path - will walk to closest point then report unreachable`);
    }

    console.log(`[Pathfinding] Path found with ${path.length} waypoints - drawing route...`);

    walkingEntities.set(entity.id, {
      targetLocation,
      onArrival,
      onNoPath,
      isPartialPath,
      entityType: entity.typeId,
      path: path,
      pathIndex: 0,
      tickCounter: 0,
      phase: options.skipDrawing === true ? "walking" : "drawing",
      drawIndex: 0,
      dimension: dimension,

      currentX: entity.location.x,
      currentY: entity.location.y,
      currentZ: entity.location.z
    });

  } catch (e) {
    console.warn("[Pathfinding] Failed to start:", e);
    if (onArrival) onArrival(entity);
  }
}

function findPathBFS(dimension, start, end) {

  if (start.x === end.x && start.z === end.z) {
    return [end];
  }

  let validStartY = start.y;
  let foundValidStart = false;

  for (const yOffset of [0, -1, 1]) {
    const testY = start.y + yOffset;
    if (isPositionWalkable(dimension, start.x, testY, start.z)) {
      validStartY = testY;
      foundValidStart = true;
      break;
    }
  }

  const actualStart = { x: start.x, y: validStartY, z: start.z };

  if (!foundValidStart) {
    console.log(`[Pathfinding] Start position not strictly walkable, using anyway`);
  }

  const openSet = [];
  const cameFrom = new Map();
  const gScore = new Map();

  const startKey = `${actualStart.x},${actualStart.y},${actualStart.z}`;
  gScore.set(startKey, 0);

  const heuristic = (pos) => Math.abs(pos.x - end.x) + Math.abs(pos.z - end.z);

  openSet.push({
    pos: actualStart,
    f: heuristic(actualStart)
  });

  const visited = new Set();

  const directions = [
    { dx: 1, dz: 0, cost: 1 },
    { dx: -1, dz: 0, cost: 1 },
    { dx: 0, dz: 1, cost: 1 },
    { dx: 0, dz: -1, cost: 1 },
    { dx: 1, dz: 1, cost: 1.4 },
    { dx: 1, dz: -1, cost: 1.4 },
    { dx: -1, dz: 1, cost: 1.4 },
    { dx: -1, dz: -1, cost: 1.4 }
  ];

  let iterations = 0;

  let closestPos = actualStart;
  let closestDist = Math.abs(actualStart.x - end.x) + Math.abs(actualStart.z - end.z);
  let closestKey = startKey;

  while (openSet.length > 0 && iterations < MAX_PATH_SEARCH) {
    iterations++;

    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    const pos = current.pos;
    const posKey = `${pos.x},${pos.y},${pos.z}`;

    if (visited.has(posKey)) continue;
    visited.add(posKey);

    const distToEnd = Math.abs(pos.x - end.x) + Math.abs(pos.z - end.z);

    if (distToEnd < closestDist) {
      closestDist = distToEnd;
      closestPos = pos;
      closestKey = posKey;
    }

    if (distToEnd <= 1) {

      const path = [end, pos];
      let currentKey = posKey;
      while (cameFrom.has(currentKey)) {
        const parent = cameFrom.get(currentKey);
        path.push(parent);
        currentKey = `${parent.x},${parent.y},${parent.z}`;
      }
      path.reverse();
      console.log(`[Pathfinding] A* found path with ${path.length} points in ${iterations} iterations`);
      return path;
    }

    const currentG = gScore.get(posKey) || 0;

    for (const dir of directions) {
      const newX = pos.x + dir.dx;
      const newZ = pos.z + dir.dz;

      for (const dy of [0, 1, -1]) {
        const newY = pos.y + dy;
        const key = `${newX},${newY},${newZ}`;

        if (visited.has(key)) continue;

        if (isPositionWalkable(dimension, newX, newY, newZ)) {

          if (dir.dx !== 0 && dir.dz !== 0) {
            if (!isPositionWalkable(dimension, pos.x + dir.dx, pos.y, pos.z) ||
              !isPositionWalkable(dimension, pos.x, pos.y, pos.z + dir.dz)) {
              continue;
            }
          }

          const blockAtFeet = dimension.getBlock({ x: newX, y: pos.y, z: newZ });
          const blockAtHead = dimension.getBlock({ x: newX, y: pos.y + 1, z: newZ });

          if (blockAtFeet && blockAtHead) {
            const feetType = blockAtFeet.typeId;
            const headType = blockAtHead.typeId;

            const isBlockPassable = (t) => {
              if (t === "minecraft:air" || t === "minecraft:cave_air" || t === "minecraft:water") return true;
              if (t.includes("short_grass") || t.includes("tall_grass") || t.includes("fern")) return true;

              if (t.startsWith("fr:") && t.includes("door")) return true;

              if (t.includes("door") || t.includes("gate")) return true;
              return false;
            };

            const isFeetSolid = !isBlockPassable(feetType);
            const isHeadSolid = !isBlockPassable(headType);

            if (isFeetSolid && isHeadSolid) {
              continue;
            }
          }

          const tentativeG = currentG + dir.cost + (dy !== 0 ? 0.5 : 0);
          const existingG = gScore.get(key);

          if (existingG === undefined || tentativeG < existingG) {
            cameFrom.set(key, pos);
            gScore.set(key, tentativeG);
            const newPos = { x: newX, y: newY, z: newZ };
            const f = tentativeG + heuristic(newPos);
            openSet.push({ pos: newPos, f: f });
          }
        }
      }
    }
  }

  const startDist = Math.abs(actualStart.x - end.x) + Math.abs(actualStart.z - end.z);
  if (closestDist < startDist - 2 && closestKey !== startKey) {
    console.log(`[Pathfinding] No complete path, returning partial path to closest point (dist: ${closestDist})`);

    const partialPath = [closestPos];
    let currentKey = closestKey;
    while (cameFrom.has(currentKey)) {
      const parent = cameFrom.get(currentKey);
      partialPath.push(parent);
      currentKey = `${parent.x},${parent.y},${parent.z}`;
    }
    partialPath.reverse();

    partialPath.isPartial = true;
    console.log(`[Pathfinding] Partial path has ${partialPath.length} points`);
    return partialPath;
  }

  console.warn(`[Pathfinding] A* search exhausted after ${iterations} iterations, no valid path`);
  return [];
}

function processWalkingEntities() {
  if (walkingEntities.size === 0) return;

  const toRemove = [];
  const overworld = world.getDimension("overworld");

  for (const [entityId, walkData] of walkingEntities) {
    try {

      let entity = null;
      for (const e of overworld.getEntities({ type: walkData.entityType })) {
        if (e.id === entityId) {
          entity = e;
          break;
        }
      }

      if (!entity) {
        toRemove.push(entityId);
        continue;
      }

      walkData.tickCounter = (walkData.tickCounter || 0) + 1;

      if (walkData.phase === "drawing") {

        if (walkData.tickCounter < PATH_DRAW_INTERVAL) {
          continue;
        }
        walkData.tickCounter = 0;

        const drawIndex = walkData.drawIndex || 0;

        if (drawIndex < walkData.path.length) {
          const point = walkData.path[drawIndex];
          const dim = walkData.dimension || overworld;

          try {

            dim.spawnParticle("minecraft:endrod", {
              x: point.x + 0.5,
              y: point.y + 0.5,
              z: point.z + 0.5
            });
            dim.spawnParticle("minecraft:endrod", {
              x: point.x + 0.5,
              y: point.y + 1.0,
              z: point.z + 0.5
            });
            dim.spawnParticle("minecraft:endrod", {
              x: point.x + 0.5,
              y: point.y + 1.5,
              z: point.z + 0.5
            });
          } catch { }

          walkData.drawIndex = drawIndex + 1;
        } else {

          console.log(`[Pathfinding] Path drawn! Starting to walk...`);
          walkData.phase = "walking";
          walkData.pathIndex = 0;
          walkData.tickCounter = 0;
        }
        continue;
      }

      if (!walkData.path || walkData.pathIndex >= walkData.path.length) {

        toRemove.push(entityId);
        try { entity.removeTag("returning_home"); } catch { }
        try { entity.removeTag("fr_no_attack"); } catch { }

        if (walkData.isPartialPath) {
          console.log(`[Pathfinding] Partial path complete - destination UNREACHABLE!`);
          entity.triggerEvent("bonnie_stop_returning");

          if (walkData.onNoPath) {
            walkData.onNoPath(entity, walkData.targetLocation);
          }
        } else {

          entity.teleport(walkData.targetLocation);
          entity.triggerEvent("bonnie_stop_returning");
          if (walkData.onArrival) walkData.onArrival(entity);
          console.log(`[Pathfinding] Entity arrived at destination!`);
        }
        continue;
      }

      const nextPoint = walkData.path[walkData.pathIndex];
      const targetX = nextPoint.x + 0.5;
      const targetY = nextPoint.y;
      const targetZ = nextPoint.z + 0.5;

      let curX = walkData.currentX;
      let curY = walkData.currentY;
      let curZ = walkData.currentZ;

      const dx = targetX - curX;
      const dy = targetY - curY;
      const dz = targetZ - curZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < MOVE_SPEED * 1.5) {
        walkData.pathIndex++;
        walkData.currentX = targetX;
        walkData.currentY = targetY;
        walkData.currentZ = targetZ;
        curX = targetX;
        curY = targetY;
        curZ = targetZ;
      } else {

        const moveX = (dx / dist) * MOVE_SPEED;
        const moveY = (dy / dist) * MOVE_SPEED;
        const moveZ = (dz / dist) * MOVE_SPEED;

        curX += moveX;
        curY += moveY;
        curZ += moveZ;

        walkData.currentX = curX;
        walkData.currentY = curY;
        walkData.currentZ = curZ;
      }

      const rotationY = Math.atan2(-dx, dz) * (180 / Math.PI);

      entity.teleport(
        { x: curX, y: curY, z: curZ },
        { rotation: { x: 0, y: rotationY } }
      );

    } catch (e) {
      console.warn(`[Pathfinding] Error:`, e);
      toRemove.push(entityId);
    }
  }

  for (const id of toRemove) {
    walkingEntities.delete(id);
  }
}

function isPositionWalkable(dimension, x, y, z) {
  try {

    const blockBelow = dimension.getBlock({ x, y: y - 1, z });

    const blockFeet = dimension.getBlock({ x, y, z });

    const blockHead = dimension.getBlock({ x, y: y + 1, z });

    if (!blockBelow || !blockFeet || !blockHead) return false;

    const belowType = blockBelow.typeId;
    const feetType = blockFeet.typeId;
    const headType = blockHead.typeId;

    const solidGround = belowType !== "minecraft:air" &&
      belowType !== "minecraft:water" &&
      belowType !== "minecraft:cave_air" &&
      belowType !== "minecraft:lava";

    if (!solidGround) return false;

    const isPassable = (type) => {
      if (type === "minecraft:air" || type === "minecraft:cave_air") return true;

      if (type.includes("grass_block") || type.includes("dirt")) return false;

      if (type.startsWith("fr:") && type.includes("door")) return true;

      if (type.includes("door") || type.includes("gate") || type.includes("sign") ||
        type.includes("torch") || type.includes("flower") || type.includes("short_grass") ||
        type.includes("tall_grass") || type.includes("fern") ||
        type.includes("carpet") || type.includes("pressure") || type.includes("button") ||
        type.includes("lantern") || type.includes("candle") || type.includes("rail") ||
        type.includes("redstone") || type.includes("vine") || type.includes("moss_carpet")) {
        return true;
      }

      if (type.includes("slab") || type.includes("stairs")) {
        return true;
      }
      return false;
    };

    return isPassable(feetType) && isPassable(headType);
  } catch {
    return false;
  }
}

function findGroundY(dimension, x, currentY, z) {
  try {

    for (let y = Math.floor(currentY); y >= currentY - 3; y--) {
      const blockBelow = dimension.getBlock({ x: Math.floor(x), y: y - 1, z: Math.floor(z) });
      const blockAt = dimension.getBlock({ x: Math.floor(x), y: y, z: Math.floor(z) });

      if (blockBelow && blockAt) {
        const belowType = blockBelow.typeId;
        const atType = blockAt.typeId;

        if (belowType !== "minecraft:air" &&
          belowType !== "minecraft:water" &&
          (atType === "minecraft:air" || atType.includes("door") || atType.includes("gate"))) {
          return y;
        }
      }
    }

    for (let y = Math.floor(currentY) + 1; y <= currentY + 2; y++) {
      const blockBelow = dimension.getBlock({ x: Math.floor(x), y: y - 1, z: Math.floor(z) });
      const blockAt = dimension.getBlock({ x: Math.floor(x), y: y, z: Math.floor(z) });

      if (blockBelow && blockAt) {
        const belowType = blockBelow.typeId;
        const atType = blockAt.typeId;

        if (belowType !== "minecraft:air" &&
          belowType !== "minecraft:water" &&
          (atType === "minecraft:air" || atType.includes("door") || atType.includes("gate"))) {
          return y;
        }
      }
    }
  } catch (e) {

  }

  return currentY;
}

function transformToAnimatronic(statue) {
  try {
    const statueId = statue.id;
    const state = entityStates.get(statueId) || { rotation: 0, poseIndex: 0, variantIndex: 0 };
    const dimension = statue.dimension;

    const entityRot = statue.getRotation();
    const savedRotation = state.rotation !== undefined ? state.rotation : normalizeRotation(entityRot.y);

    let platformLocation = null;
    try {
      const platformData = statue.getDynamicProperty("fr:platform_location");
      if (platformData) {
        platformLocation = JSON.parse(platformData);
      }
    } catch { }

    if (!platformLocation && state.platformLocation) {
      platformLocation = state.platformLocation;
    }

    const spawnLocation = platformLocation || statue.location;

    const waypointStatueId = statue.getDynamicProperty("fr:statue_id") || 0;

    const statueData = {
      platformLocation: platformLocation,
      rotation: savedRotation,
      poseIndex: state.poseIndex || 0,
      variantIndex: state.variantIndex || 0,
      dimensionId: dimension.id,
      waypointStatueId: waypointStatueId
    };

    console.log(`[Debug] Saving statue data: Rotation=${savedRotation}, Pose=${state.poseIndex}, Variant=${state.variantIndex}, WaypointID=${waypointStatueId}, Platform=${JSON.stringify(platformLocation)}`);

    const animatronic = dimension.spawnEntity("fr:fnaf1_bonnie_entity", spawnLocation);

    if (waypointStatueId > 0) {
      animatronic.setDynamicProperty("fr:statue_id", waypointStatueId);
    }

    const variantIndex = statueData.variantIndex;

    animatronic.setDynamicProperty("fr:variant_index", variantIndex);

    if (variantIndex > 0) {
      system.run(() => {
        try {
          animatronic.triggerEvent(`fr:set_variant_${variantIndex}`);
          console.log(`[NightMode] Applied variant ${variantIndex} to animatronic`);
        } catch (e) {
          console.warn(`[NightMode] Failed to apply variant to animatronic: ${e}`);
        }
      });
    }

    nightModeAnimatronics.set(animatronic.id, statueData);

    nightModeStatues.delete(statueId);
    entityStates.delete(statueId);

    statue.remove();

    if (waypointStatueId > 0) {
      const animatronicRef = animatronic;
      system.run(() => {
        system.run(() => {
          try {
            // startPathingForAnimatronic(animatronicRef, waypointStatueId);
            // console.log(`[NightMode] Started pathing for animatronic with waypoint ID ${waypointStatueId}`);
          } catch (e) {
            console.warn(`[NightMode] Failed to start pathing: ${e}`);
          }
        });
      });
    }

    const locStr = `${Math.floor(spawnLocation.x)}, ${Math.floor(spawnLocation.y)}, ${Math.floor(spawnLocation.z)}`;
    console.log(`[NightMode] Statue transformed to animatronic at ${locStr}`);
  } catch (e) {
    console.warn("[NightMode] Error transforming to animatronic:", e);
  }
}

function transformToStatue(animatronic) {
  try {
    const animatronicId = animatronic.id;
    let statueData = nightModeAnimatronics.get(animatronicId);

    if (!statueData) {
      const waypointId = animatronic.getDynamicProperty("fr:statue_id");
      if (waypointId) {
        for (const [oldId, data] of nightModeAnimatronics) {
          if (data.waypointStatueId === waypointId) {
            statueData = data;
            nightModeAnimatronics.delete(oldId);
            nightModeAnimatronics.set(animatronicId, statueData);
            console.log(`[NightMode] Found statue data by waypointId ${waypointId}`);
            break;
          }
        }
      }
    }

    if (!statueData) {
      console.warn(`[NightMode] No statue data found for animatronic ${animatronicId}`);
      return;
    }

    // stopPathingForEntity(animatronicId);
    // cleanupLuresNearEntity(animatronic);

    const dimension = animatronic.dimension;

    const savedRotation = statueData.rotation !== undefined ? statueData.rotation : normalizeRotation(animatronic.getRotation().y);

    const returnLocation = statueData.platformLocation || animatronic.location;

    const statue = dimension.spawnEntity("fr:bonnie_statue", returnLocation);

    if (statueData.waypointStatueId > 0) {
      statue.setDynamicProperty("fr:statue_id", statueData.waypointStatueId);
      console.log(`[NightMode] Restored waypoint ID ${statueData.waypointStatueId} to statue`);
    }

    if (statueData.platformLocation) {
      try {
        statue.setDynamicProperty("fr:platform_location", JSON.stringify(statueData.platformLocation));
        console.log(`[NightMode] Restored platform location to statue`);
      } catch (e) {
        console.warn(`[NightMode] Failed to restore platform location: ${e}`);
      }
    }

    console.log(`[Debug] Restoring statue. Saved Rotation: ${savedRotation}, Pose: ${statueData.poseIndex}, Variant: ${statueData.variantIndex}`);

    const finalRotation = savedRotation;
    const finalPose = statueData.poseIndex;
    const finalVariant = statueData.variantIndex;

    system.run(() => {
      system.run(() => {
        try {

          let valid = false;
          if (statue) {
            if (typeof statue.isValid === 'function') valid = statue.isValid();
            else if (statue.isValid !== undefined) valid = statue.isValid;
            else valid = true;
          }

          if (!valid) {
            console.warn("[Debug] Statue invalid inside delay");
            return;
          }

          try {
            statue.teleport(statue.location, { rotation: { x: 0, y: finalRotation } });
            console.log(`[Debug] Applied rotation ${finalRotation} via teleport`);
          } catch (e) {
            console.warn(`[Debug] Failed teleport: ${e}`);
          }

          if (finalPose > 0) {
            try {
              statue.triggerEvent(`fr:set_pose_${finalPose}`);
              console.log(`[Debug] Applied pose ${finalPose}`);
            } catch (e) {
              console.warn(`[Debug] Failed pose event: ${e}`);
            }
          }

          if (finalVariant > 0) {
            try {
              statue.triggerEvent(`fr:set_variant_${finalVariant}`);
              console.log(`[Debug] Applied variant ${finalVariant}`);
            } catch (e) {
              console.warn(`[Debug] Failed variant event: ${e}`);
            }
          }

        } catch (e) {
          console.warn("[Debug] Critical error in delayed setup:", e);
        }
      });
    });

    const newState = {
      rotation: savedRotation,
      poseIndex: statueData.poseIndex,
      variantIndex: statueData.variantIndex,
      nightMode: true,
      platformLocation: statueData.platformLocation
    };
    entityStates.set(statue.id, newState);
    nightModeStatues.set(statue.id, {
      ...newState,
      location: returnLocation,
      dimensionId: dimension.id
    });

    nightModeAnimatronics.delete(animatronicId);

    animatronic.remove();

    const locStr = `${Math.floor(returnLocation.x)}, ${Math.floor(returnLocation.y)}, ${Math.floor(returnLocation.z)}`;
    console.log(`[NightMode] Animatronic returned to statue at ${locStr}${statueData.platformLocation ? " (platform)" : ""}`);
  } catch (e) {
    console.warn("[NightMode] Error transforming to statue:", e);
  }
}

function startWalkingToPlaftorm(animatronic) {
  const animatronicId = animatronic.id;
  let statueData = nightModeAnimatronics.get(animatronicId);

  if (!statueData) {
    const waypointId = animatronic.getDynamicProperty("fr:statue_id");
    if (waypointId) {
      for (const [oldId, data] of nightModeAnimatronics) {
        if (data.waypointStatueId === waypointId) {
          statueData = data;
          nightModeAnimatronics.delete(oldId);
          nightModeAnimatronics.set(animatronicId, statueData);
          console.log(`[NightMode] Updated tracking in startWalkingToPlaftorm (waypointId: ${waypointId})`);
          break;
        }
      }
    }
  }

  let platformLocation = statueData?.platformLocation;
  if (!platformLocation) {
    try {
      const platformData = animatronic.getDynamicProperty("fr:platform_location");
      if (platformData) {
        platformLocation = JSON.parse(platformData);
        console.log(`[NightMode] Found platform location from animatronic property: ${JSON.stringify(platformLocation)}`);

        if (statueData) {
          statueData.platformLocation = platformLocation;
        }
      }
    } catch (e) {
      console.warn(`[NightMode] Error reading platform location: ${e}`);
    }
  }

  // stopPathingForEntity(animatronicId);
  // cleanupLuresNearEntity(animatronic);

  if (!platformLocation) {

    console.log(`[NightMode] No platform location, transforming at current position`);

    if (!statueData) {
      const waypointId = animatronic.getDynamicProperty("fr:statue_id") || 0;
      statueData = {
        platformLocation: null,
        rotation: normalizeRotation(animatronic.getRotation().y),
        poseIndex: 0,
        variantIndex: 0,
        dimensionId: animatronic.dimension.id,
        waypointStatueId: waypointId
      };
      nightModeAnimatronics.set(animatronicId, statueData);
    }
    transformToStatue(animatronic);
    return;
  }

  if (!statueData) {
    const waypointId = animatronic.getDynamicProperty("fr:statue_id") || 0;
    statueData = {
      platformLocation: platformLocation,
      rotation: normalizeRotation(animatronic.getRotation().y),
      poseIndex: 0,
      variantIndex: 0,
      dimensionId: animatronic.dimension.id,
      waypointStatueId: waypointId
    };
    nightModeAnimatronics.set(animatronicId, statueData);
  }

  const dist = getHorizontalDistance(animatronic.location, platformLocation);
  if (dist <= ARRIVAL_DISTANCE) {
    transformToStatue(animatronic);
    return;
  }

  walkEntityTo(animatronic, platformLocation, (entity) => {

    transformToStatue(entity);
  });

  console.log(`[NightMode] Animatronic walking to platform at ${Math.floor(platformLocation.x)}, ${Math.floor(platformLocation.y)}, ${Math.floor(platformLocation.z)}`);
}

function nightModeTickHandler() {
  try {
    const overworld = world.getDimension("overworld");
    const isNight = isNightTime(overworld);
    const currentTime = world.getTimeOfDay();

    if (Math.random() < 0.01) {
      console.log(`[NightMode] Tick: time=${currentTime}, isNight=${isNight}, statues=${nightModeStatues.size}, animatronics=${nightModeAnimatronics.size}`);
    }

    if (isNight) {

      const statuesToTransform = [...nightModeStatues.entries()];

      for (const [statueId, data] of statuesToTransform) {
        try {

          for (const entity of overworld.getEntities({ type: "fr:bonnie_statue" })) {
            if (entity.id === statueId) {
              transformToAnimatronic(entity);
              break;
            }
          }
        } catch { }
      }
    }

    else {

      const trackedWaypointIds = new Set();
      for (const [_, data] of nightModeAnimatronics) {
        if (data.waypointStatueId) {
          trackedWaypointIds.add(data.waypointStatueId);
        }
      }

      const allAnimatronics = overworld.getEntities({ type: "fr:fnaf1_bonnie_entity" });

      if (allAnimatronics.length > 0 && Math.random() < 0.1) {
        console.log(`[NightMode] Daytime: Found ${allAnimatronics.length} animatronics, tracking ${nightModeAnimatronics.size} entries`);
      }

      for (const animatronic of allAnimatronics) {
        try {

          if (animatronic.hasTag("fr:simulation_mode")) {
            continue;
          }

          const waypointId = animatronic.getDynamicProperty("fr:statue_id");

          if (walkingEntities.has(animatronic.id)) continue;

          let statueData = nightModeAnimatronics.get(animatronic.id);

          if (!statueData && waypointId) {
            for (const [oldId, data] of nightModeAnimatronics) {
              if (data.waypointStatueId === waypointId) {
                statueData = data;

                nightModeAnimatronics.delete(oldId);
                nightModeAnimatronics.set(animatronic.id, statueData);
                console.log(`[NightMode] Updated tracking from old ID to ${animatronic.id} (waypointId: ${waypointId})`);
                break;
              }
            }
          }

          if (!statueData) {
            const platformData = animatronic.getDynamicProperty("fr:platform_location");
            if (platformData) {
              try {
                const platformLocation = JSON.parse(platformData);

                statueData = {
                  platformLocation: platformLocation,
                  rotation: normalizeRotation(animatronic.getRotation().y),
                  poseIndex: 0,
                  variantIndex: 0,
                  dimensionId: animatronic.dimension.id,
                  waypointStatueId: waypointId || 0
                };
                nightModeAnimatronics.set(animatronic.id, statueData);
                console.log(`[NightMode] Restored tracking for animatronic ${animatronic.id} from dynamic property`);
              } catch (e) {
                console.warn(`[NightMode] Failed to parse platform location: ${e}`);
              }
            }
          }

          if (statueData) {
            console.log(`[NightMode] Starting platform walk for animatronic ${animatronic.id}, waypointId=${waypointId}, platformLoc=${JSON.stringify(statueData.platformLocation)}`);
            startWalkingToPlaftorm(animatronic);
          } else {

            if (Math.random() < 0.02) {
              console.log(`[NightMode] Untracked animatronic ${animatronic.id} (no platform data) - skipping`);
            }
          }
        } catch (e) {
          console.warn(`[NightMode] Error processing animatronic: ${e}`);
        }
      }
    }
  } catch (e) {
    console.warn("[NightMode] Tick handler error:", e);
  }
}

function enableNightMode(statue) {
  const statueId = statue.id;
  const state = entityStates.get(statueId) || { rotation: 0, poseIndex: 0, variantIndex: 0 };

  const entityRotation = statue.getRotation();
  const rawRotation = entityRotation ? entityRotation.y : (state.rotation || 0);
  const normalizedRot = normalizeRotation(rawRotation);

  state.nightMode = true;
  state.rotation = normalizedRot;
  entityStates.set(statueId, state);

  nightModeStatues.set(statueId, {
    location: { x: statue.location.x, y: statue.location.y, z: statue.location.z },
    rotation: normalizedRot,
    poseIndex: state.poseIndex || 0,
    variantIndex: state.variantIndex || 0,
    dimensionId: statue.dimension.id,
    nightMode: true,
    platformLocation: state.platformLocation || null
  });

  console.log(`[NightMode] Enabled for statue ${statueId} with rotation ${normalizedRot}`);
}

function disableNightMode(statue) {
  const statueId = statue.id;
  const state = entityStates.get(statueId);
  if (state) {
    state.nightMode = false;
    entityStates.set(statueId, state);
  }

  nightModeStatues.delete(statueId);
  console.log(`[NightMode] Disabled for statue ${statueId}`);
}

function startLinkingMode(player, entity) {
  playerLinkingMode.set(player.id, {
    entityId: entity.id,
    entityType: entity.typeId,
    entityLocation: { x: entity.location.x, y: entity.location.y, z: entity.location.z }
  });
  player.sendMessage("§e[Link Mode] §7Click on a §efr:platform§7 block to link this animatronic");
  player.sendMessage("§7The animatronic will wake up from there at night and return during the day");
}

function cancelLinkingMode(player) {
  if (playerLinkingMode.has(player.id)) {
    playerLinkingMode.delete(player.id);
    player.sendMessage("§c[Link Mode] §7Cancelled");
  }
}

function completeLinking(player, block) {
  const linkData = playerLinkingMode.get(player.id);
  if (!linkData) return false;

  const dimension = player.dimension;

  let targetEntity = null;
  for (const entity of dimension.getEntities({ type: linkData.entityType })) {
    if (entity.id === linkData.entityId) {
      targetEntity = entity;
      break;
    }
  }

  if (!targetEntity) {
    player.sendMessage("§c[Link Mode] §7Entity not found - it may have been removed");
    playerLinkingMode.delete(player.id);
    return false;
  }

  const state = entityStates.get(targetEntity.id) || { rotation: 0, poseIndex: 0, variantIndex: 0 };

  const entityRotation = targetEntity.getRotation();
  const rawRotation = entityRotation ? entityRotation.y : (state.rotation || 0);
  const normalizedRot = normalizeRotation(rawRotation);

  const platformLocation = {
    x: block.location.x + 0.5,
    y: block.location.y + 1,
    z: block.location.z + 0.5,
    dimensionId: dimension.id
  };
  state.platformLocation = platformLocation;
  state.nightMode = true;
  state.rotation = normalizedRot;
  entityStates.set(targetEntity.id, state);

  try {
    targetEntity.setDynamicProperty("fr:platform_location", JSON.stringify(platformLocation));
    console.log(`[Link Mode] Saved platform location to entity: ${JSON.stringify(platformLocation)}`);
  } catch (e) {
    console.warn(`[Link Mode] Failed to save platform location: ${e}`);
  }

  nightModeStatues.set(targetEntity.id, {
    location: platformLocation,
    rotation: normalizedRot,
    poseIndex: state.poseIndex || 0,
    variantIndex: state.variantIndex || 0,
    dimensionId: dimension.id,
    nightMode: true,
    platformLocation: platformLocation
  });

  try {
    block.setPermutation(block.permutation.withState("fr:linked", true));
  } catch { }

  try {
    targetEntity.teleport(platformLocation);
  } catch { }

  player.sendMessage(`§a[Link Mode] §7Successfully linked to platform at §e${Math.floor(platformLocation.x)}, ${Math.floor(platformLocation.y)}, ${Math.floor(platformLocation.z)}`);
  player.sendMessage("§7Night mode has been §aenabled§7 - animatronic will activate at night!");

  playerLinkingMode.delete(player.id);
  return true;
}

function unlinkFromPlatform(entity) {
  const state = entityStates.get(entity.id);
  if (state && state.platformLocation) {

    try {
      const dimension = entity.dimension;
      const platformLoc = state.platformLocation;
      const block = dimension.getBlock({ x: Math.floor(platformLoc.x), y: Math.floor(platformLoc.y) - 1, z: Math.floor(platformLoc.z) });
      if (block && block.typeId === "fr:platform") {
        block.setPermutation(block.permutation.withState("fr:linked", false));
      }
    } catch { }

    state.platformLocation = null;
    entityStates.set(entity.id, state);
  }
}

export function showStatueEditor(player, entity) {
  const entityId = entity.id;

  if (!entityStates.has(entityId)) {
    entityStates.set(entityId, {
      rotation: 0,
      animationIndex: 0
    });
  }

  const state = entityStates.get(entityId);
  const currentAnim = ANIMATIONS[state.animationIndex];

  const form = new ActionFormData()
    .title("§S§T§A§T§U§E");

  form.button("-");
  form.button("+");
  form.button("◀");
  form.button("▶");
  form.button(`se:rot_§]§8${state.rotation}`);
  form.button(`se:anim_§]§8${currentAnim}`);

  form.show(player).then((response) => {
    if (response.canceled) return;

    const selection = response.selection;

    switch (selection) {
      case 0:
        state.rotation = (state.rotation - 15 + 360) % 360;
        applyRotation(entity, state.rotation);
        system.run(() => showStatueEditor(player, entity));
        break;

      case 1:
        state.rotation = (state.rotation + 15) % 360;
        applyRotation(entity, state.rotation);
        system.run(() => showStatueEditor(player, entity));
        break;

      case 2:
        state.animationIndex = (state.animationIndex - 1 + ANIMATIONS.length) % ANIMATIONS.length;
        applyAnimation(entity, ANIMATIONS[state.animationIndex]);
        system.run(() => showStatueEditor(player, entity));
        break;

      case 3:
        state.animationIndex = (state.animationIndex + 1) % ANIMATIONS.length;
        applyAnimation(entity, ANIMATIONS[state.animationIndex]);
        system.run(() => showStatueEditor(player, entity));
        break;
    }

    try {
      player.playSound("ui.click");
    } catch { }
  }).catch(() => { });
}

function applyRotation(entity, rotation) {
  try {

    const yaw = rotation * (Math.PI / 180);
    entity.setRotation({ x: 0, y: rotation });
  } catch (e) {
    console.warn("Error applying rotation:", e);
  }
}

function applyPose(entity, poseIndex) {
  try {
    entity.triggerEvent(`fr:set_pose_${poseIndex}`);
    console.log(`Pose changed to: ${POSES[poseIndex].name} (index: ${poseIndex})`);
  } catch (e) {
    console.warn("Error applying pose:", e);
  }
}

export function initStatueEditorSystem() {

  world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    const { player, target } = event;
    const equippable = player.getComponent("minecraft:equippable");
    let heldItem = equippable?.getEquipment(EquipmentSlot.Mainhand);

    if (!heldItem) {
      const inventory = player.getComponent("minecraft:inventory");
      const container = inventory?.container;
      if (container) {
        const slot = player.selectedSlotIndex ?? player.selectedSlot;
        if (typeof slot === 'number') heldItem = container.getItem(slot);
      }
    }

    player.sendMessage(`§7[Statue DEBUG] Interact: ${target.typeId}, Item: ${heldItem?.typeId || "None"}`);

    if (heldItem && heldItem.typeId === "fr:wrench") {
      if (target.typeId.includes("_statue")) {
        startLinkingMode(player, target);
        return;
      }
    }

    if (target.typeId.includes("_statue")) {
      if (heldItem && heldItem.typeId === "fr:faz-diver_repairman") {
        showEntityEditor(player, target, "statue");
        return;
      }
    }
  });

  world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { player, block } = event;

    if (playerLinkingMode.has(player.id)) {
      if (block.typeId === "fr:platform") {
        event.cancel = true;
        system.run(() => {
          completeLinking(player, block);
        });
      } else {

        system.run(() => {
          player.sendMessage("§c[Link Mode] §7That's not a platform block. Linking cancelled.");
          cancelLinkingMode(player);
        });
      }
    }
  });

  system.runInterval(() => {
    processWalkingEntities();
  }, 1);

  system.runInterval(() => {
    nightModeTickHandler();
  }, 100);

  system.run(() => {
    world.sendMessage("§a[StatueEditor] System Loaded!");
  });
  console.log("[StatueEditor] System initialized with night mode + platform linking + walking support");
}

export function showEntityEditor(player, entity, section = "statue") {
  const entityId = entity.id;

  if (!entityStates.has(entityId)) {

    let currentPose = 0;
    try {
      const prop = entity.getProperty("fr:pose");
      if (prop !== undefined) currentPose = prop;
    } catch { }

    let actualRotation = 0;
    try {
      const entityRot = entity.getRotation();
      if (entityRot) actualRotation = normalizeRotation(entityRot.y);
    } catch { }

    entityStates.set(entityId, { rotation: actualRotation, poseIndex: currentPose, nightMode: false });
  }

  const state = entityStates.get(entityId);

  if (state.nightMode === undefined) state.nightMode = false;

  const currentPose = POSES[state.poseIndex] || POSES[0];

  const sectionFlag = section === "variants" ? "§s§e§c§:§1" : section === "poses" ? "§s§e§c§:§2" : "§s§e§c§:§3";

  const form = new ActionFormData()
    .title(`§S§T§A§T§U§E${sectionFlag}`);

  form.button("V");
  form.button("P");
  form.button("X");

  const variants = getEntityVariants(entity);
  const poses = getEntityPoses(entity);

  if (section === "statue") {
    form.button("-");
    form.button("+");
    form.button(">enable<");
    form.button(state.nightMode ? ">disable<" : ">enable<");
    form.button(`${state.rotation}`);
    form.button("§aSIMULATE");
  } else if (section === "variants") {
    const currentVarPage = playerVariantPage.get(player.id) || 0;
    const totalVarPages = Math.ceil(variants.length / VARIANTS_PER_PAGE);
    const startVarIdx = currentVarPage * VARIANTS_PER_PAGE;
    const pageVariants = variants.slice(startVarIdx, startVarIdx + VARIANTS_PER_PAGE);

    for (const v of pageVariants) {
      form.button(v.name, v.icon);
    }

    for (let i = pageVariants.length; i < VARIANTS_PER_PAGE; i++) {
      form.button(" ");
    }

    form.button(`Prev`);
    form.button(`Next`);
  } else if (section === "poses") {

    const currentPage = playerPosePage.get(player.id) || 0;
    const totalPages = Math.ceil(POSES.length / POSES_PER_PAGE);
    const startIdx = currentPage * POSES_PER_PAGE;
    const pagePoses = POSES.slice(startIdx, startIdx + POSES_PER_PAGE);

    for (const p of pagePoses) {
      form.button(p.name, p.icon);
    }

    for (let i = pagePoses.length; i < POSES_PER_PAGE; i++) {
      form.button(" ");
    }

    form.button(`—€ Prev`);
    form.button(`Next –¶`);
  }

  form.show(player).then((response) => {
    if (response.canceled) return;

    const sel = response.selection;

    if (sel === 0) { playerVariantPage.set(player.id, 0); system.run(() => showEntityEditor(player, entity, "variants")); return; }
    if (sel === 1) { playerPosePage.set(player.id, 0); system.run(() => showEntityEditor(player, entity, "poses")); return; }
    if (sel === 2) { system.run(() => showEntityEditor(player, entity, "statue")); return; }

    if (section === "statue") {

      if (sel === 3) { state.rotation = (state.rotation - 15 + 360) % 360; applyRotation(entity, state.rotation); }
      if (sel === 4) { state.rotation = (state.rotation + 15) % 360; applyRotation(entity, state.rotation); }
      if (sel === 5) {

        player.runCommand(`tp @s ${entity.location.x} ${entity.location.y} ${entity.location.z}`);
        player.runCommand(`camera @s fade time 0.5 0.5 0.5`);
      }
      if (sel === 6) {

        if (state.nightMode) {
          disableNightMode(entity);
          player.sendMessage("§c[Night Mode] §7Disabled - Animatronic will stay as statue");
        } else {
          enableNightMode(entity);
          player.sendMessage("§a[Night Mode] §7Enabled - Animatronic will activate at night");
        }
      }
      if (sel === 8) {

        const waypointId = entity.getDynamicProperty("fr:statue_id");
        const platformLoc = entity.getDynamicProperty("fr:platform_location");

        if (!waypointId) {
          player.sendMessage("§c[Simulation] §7No waypoint ID! Use path_marker to link waypoints first.");
        } else if (!platformLoc) {
          player.sendMessage("§c[Simulation] §7No platform linked! Use wrench to link a platform first.");
        } else {

          // startPathingSimulation(entity, player, 10);
          return;
        }
      }
      system.run(() => showEntityEditor(player, entity, "statue"));
    } else if (section === "variants" && sel >= 3) {
      const currentVarPage = playerVariantPage.get(player.id) || 0;
      const totalVarPages = Math.ceil(variants.length / VARIANTS_PER_PAGE);

      if (sel === 6) {

        const newPage = (currentVarPage - 1 + totalVarPages) % totalVarPages;
        playerVariantPage.set(player.id, newPage);
        system.run(() => showEntityEditor(player, entity, "variants"));
        return;
      }
      if (sel === 7) {

        const newPage = (currentVarPage + 1) % totalVarPages;
        playerVariantPage.set(player.id, newPage);
        system.run(() => showEntityEditor(player, entity, "variants"));
        return;
      }

      const variantIdxInPage = sel - 3;
      if (variantIdxInPage < VARIANTS_PER_PAGE) {
        const actualVariantIdx = currentVarPage * VARIANTS_PER_PAGE + variantIdxInPage;
        if (actualVariantIdx < variants.length) {
          state.variantIndex = actualVariantIdx;
          applyVariant(entity, actualVariantIdx);
          system.run(() => showEntityEditor(player, entity, "variants"));
        }
      }
    } else if (section === "poses" && sel >= 3) {
      const currentPage = playerPosePage.get(player.id) || 0;
      const totalPages = Math.ceil(POSES.length / POSES_PER_PAGE);

      if (sel === 9) {

        const newPage = (currentPage - 1 + totalPages) % totalPages;
        playerPosePage.set(player.id, newPage);
        system.run(() => showEntityEditor(player, entity, "poses"));
        return;
      }
      if (sel === 10) {

        const newPage = (currentPage + 1) % totalPages;
        playerPosePage.set(player.id, newPage);
        system.run(() => showEntityEditor(player, entity, "poses"));
        return;
      }

      const poseIdxInPage = sel - 3;
      if (poseIdxInPage < POSES_PER_PAGE) {
        const actualPoseIdx = currentPage * POSES_PER_PAGE + poseIdxInPage;
        if (actualPoseIdx < POSES.length) {
          state.poseIndex = actualPoseIdx;
          applyPose(entity, actualPoseIdx);
          system.run(() => showEntityEditor(player, entity, "poses"));
        }
      }
    }
  });
}

function getEntityVariants(entity) {
  return [
    { name: "classic.exe", icon: "textures/fr_ui/variants/bonnie_regular" },
    { name: "hw_guitar.exe", icon: "textures/fr_ui/variants/bonnie_hw_guitar" },
    { name: "chocolate.exe", icon: "textures/fr_ui/variants/bonnie_chocolate" }
  ];
}

function getEntityPoses(entity) {
  return POSES;
}

function applyVariant(entity, variantIndex) {
  try {
    entity.triggerEvent(`fr:set_variant_${variantIndex}`);

    entity.setDynamicProperty("fr:variant_index", variantIndex);
    console.log(`Variant changed to index: ${variantIndex}`);
  } catch (e) {
    console.warn("Error applying variant:", e);
  }
}

