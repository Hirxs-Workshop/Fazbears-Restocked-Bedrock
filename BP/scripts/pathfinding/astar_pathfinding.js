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

import { world, system } from "@minecraft/server";
import {
  findPathAStar as findDynamicPath,
  startDynamicPathfinding,
  stopDynamicPathfinding,
  getDynamicPathfindingSession,
  hasActiveDynamicPathfinding,
  getActivePathfindingSessions,
  DYNAMIC_PATHFINDING_CONFIG,
  requestPathAsync,
  cancelPathRequest,
  processAsyncPathRequests,
  initDynamicPathfinding,
} from "./dynamic_pathfinding.js";
import {
  broadcastDebug,
  isCreativeMode,
  distance3D as getDistance3D
} from "../utils.js";
const DEBUG_MODE = true;
function debugLog(...args) {
  if (DEBUG_MODE) {
    const details = args.map(a => {
      if (Array.isArray(a) && a.length > 3) return `[Array(${a.length})]`;
      return typeof a === 'object' ? JSON.stringify(a) : a;
    }).join(' ');
    broadcastDebug(`${details}`, "§d[A* Path]");
  }
}
function debugWarn(...args) {
  if (DEBUG_MODE) console.warn("[Pathfinding]", ...args);
}
export const PATHFINDING_CONFIG = {
  MAX_ITERATIONS: 1500,
  MAX_PATH_LENGTH: 100,
  HEURISTIC_WEIGHT: 1.0,
  MOVE_SPEED: 0.22,
  MOVE_INTERVAL_TICKS: 2,
  ARRIVAL_THRESHOLD: 0.7,
  HEIGHT_CHECK: 2,
  PLAYER_DETECTION_RANGE: 15,
  PLAYER_CHASE_RANGE: 25,
  CHASE_SPEED_MULTIPLIER: 1.5,
  DETECTION_INTERVAL_TICKS: 20,
  RECALC_INTERVAL_TICKS: 60,
  STUCK_THRESHOLD_TICKS: 40,
  STUCK_DISTANCE: 0.1,
  STUCK_CHECK_INTERVAL_MS: 3000,
  MAX_RECALC_PER_MINUTE: 10,
  SKIP_WAYPOINT_AFTER_FAILURES: 3,
  PASSABLE_BLOCKS: [
    "minecraft:air",
    "minecraft:cave_air",
    "minecraft:void_air",
    "minecraft:water",
    "minecraft:flowing_water",
    "minecraft:light_block",
    "minecraft:structure_void",
    "fr:stage_platform",
    "fr:route_point",
  ],
  CLIMBABLE_BLOCKS: [
    "minecraft:ladder",
    "minecraft:vine",
    "minecraft:scaffolding",
    "minecraft:twisting_vines",
    "minecraft:weeping_vines",
  ],
  DANGEROUS_BLOCKS: [
    "minecraft:lava",
    "minecraft:flowing_lava",
    "minecraft:fire",
    "minecraft:soul_fire",
    "minecraft:campfire",
    "minecraft:soul_campfire",
    "minecraft:magma_block",
    "minecraft:cactus",
    "minecraft:sweet_berry_bush",
    "minecraft:wither_rose",
  ],
  USE_DYNAMIC_PATHFINDING: true,
  DYNAMIC_RECALC_ON_OBSTACLE: true,
  SHOW_PATH_PARTICLES: false,
  PARTICLE_TYPE: "minecraft:villager_happy",
  PARTICLE_SPACING: 0.5,
};
class PriorityQueue {
  constructor() {
    this.heap = [];
  }
  push(item, priority) {
    this.heap.push({ item, priority });
    this._bubbleUp(this.heap.length - 1);
  }
  pop() {
    if (this.heap.length === 0) return null;
    const result = this.heap[0].item;
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._bubbleDown(0);
    }
    return result;
  }
  isEmpty() {
    return this.heap.length === 0;
  }
  _bubbleUp(index) {
    while (index > 0) {
      const parentIdx = Math.floor((index - 1) / 2);
      if (this.heap[parentIdx].priority <= this.heap[index].priority) break;
      [this.heap[parentIdx], this.heap[index]] = [
        this.heap[index],
        this.heap[parentIdx],
      ];
      index = parentIdx;
    }
  }
  _bubbleDown(index) {
    const length = this.heap.length;
    while (true) {
      const leftIdx = 2 * index + 1;
      const rightIdx = 2 * index + 2;
      let smallest = index;
      if (
        leftIdx < length &&
        this.heap[leftIdx].priority < this.heap[smallest].priority
      ) {
        smallest = leftIdx;
      }
      if (
        rightIdx < length &&
        this.heap[rightIdx].priority < this.heap[smallest].priority
      ) {
        smallest = rightIdx;
      }
      if (smallest === index) break;
      [this.heap[smallest], this.heap[index]] = [
        this.heap[index],
        this.heap[smallest],
      ];
      index = smallest;
    }
  }
}
class PathNode {
  constructor(x, y, z, g = 0, h = 0, parent = null) {
    this.x = Math.floor(x);
    this.y = Math.floor(y);
    this.z = Math.floor(z);
    this.g = g;
    this.h = h;
    this.f = g + h;
    this.parent = parent;
  }
  get key() {
    return `${this.x},${this.y},${this.z}`;
  }
  equals(other) {
    return this.x === other.x && this.y === other.y && this.z === other.z;
  }
}
const pathfindingSessions = new Map();
let nextPathfindingSessionId = 1;
class PathfindingSession {
  constructor(
    entityId,
    entityType,
    dimensionId,
    startPos,
    goalPos,
    options = {},
  ) {
    this.sessionId = nextPathfindingSessionId++;
    this.entityId = entityId;
    this.entityType = entityType;
    this.dimensionId = dimensionId;
    this.startPos = { ...startPos };
    this.goalPos = { ...goalPos };
    this.currentPos = { ...startPos };
    this.path = [];
    this.pathIndex = 0;
    this.state = "calculating";
    this.options = {
      onArrival: options.onArrival || null,
      onFailed: options.onFailed || null,
      pose: options.pose ?? 0,
      variant: options.variant ?? null,
      rotation: options.rotation ?? 0,
      waitTime: options.waitTime ?? 0,
      detectPlayers: options.detectPlayers ?? true,
      returnToPath: options.returnToPath ?? true,
      onChaseEnd: options.onChaseEnd || null,
    };
    this.stateStartTime = Date.now();
    this.lastProgressCheck = Date.now();
    this.lastProgressPos = { ...startPos };
    this.tickCounter = 0;
    this.stuckCounter = 0;
    this.isChasing = false;
    this.chaseTargetId = null;
    this.savedPathIndex = 0;
    this.savedGoalPos = null;
    this.moveProgress = 0;
    this.currentMoveFrom = null;
    this.currentMoveTo = null;
  }
}
function isBlockPassable(dimension, x, y, z) {
  try {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const floorZ = Math.floor(z);
    const block = dimension.getBlock({ x: floorX, y: floorY, z: floorZ });
    if (!block) return false;
    const typeId = block.typeId;
    if (PATHFINDING_CONFIG.PASSABLE_BLOCKS.includes(typeId)) {
      return true;
    }
    if (typeId.includes("door") || typeId.includes("gate")) {
      return true;
    }
    if (
      typeId.includes("pressure_plate") ||
      typeId.includes("rail") ||
      typeId.includes("redstone_wire") ||
      typeId.includes("torch") ||
      typeId.includes("sign") ||
      typeId.includes("banner") ||
      typeId.includes("flower") ||
      typeId.includes("sapling") ||
      typeId.includes("fern") ||
      typeId.includes("tallgrass") ||
      typeId.includes("tall_grass") ||
      typeId.includes("dead_bush") ||
      typeId.includes("button") ||
      typeId.includes("lever") ||
      (typeId.includes("mushroom") && !typeId.includes("block")) ||
      (typeId.includes("grass") && !typeId.includes("block"))
    ) {
      return true;
    }

    if (typeId.includes("carpet")) {
      return false;
    }
    return false;
  } catch {
    return false;
  }
}
function isBlockSolidCube(dimension, x, y, z) {
  try {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const floorZ = Math.floor(z);
    const block = dimension.getBlock({ x: floorX, y: floorY, z: floorZ });
    if (!block) return true;
    const typeId = block.typeId;
    if (PATHFINDING_CONFIG.PASSABLE_BLOCKS.includes(typeId)) {
      return false;
    }
    if (
      typeId.includes("door") ||
      typeId.includes("gate") ||
      typeId.includes("sign") ||
      typeId.includes("banner") ||
      typeId.includes("torch") ||
      typeId.includes("pressure_plate") ||
      typeId.includes("button") ||
      typeId.includes("lever") ||
      typeId.includes("flower") ||
      typeId.includes("sapling") ||
      typeId.includes("rail") ||
      typeId.includes("redstone") ||
      typeId.includes("fern") ||
      typeId.includes("tallgrass") ||
      typeId.includes("tall_grass") ||
      typeId.includes("dead_bush") ||
      typeId.includes("snow_layer") ||
      (typeId.includes("grass") && !typeId.includes("block")) ||
      (typeId.includes("mushroom") && !typeId.includes("block"))
    ) {
      return false;
    }

    if (typeId.includes("carpet")) {
      return true;
    }
    return true;
  } catch {
    return true;
  }
}
function isBlockSolid(dimension, x, y, z) {
  return isBlockSolidCube(dimension, x, y, z);
}
function isBlockDangerous(dimension, x, y, z) {
  try {
    const block = dimension.getBlock({ x, y, z });
    if (!block) return false;
    return PATHFINDING_CONFIG.DANGEROUS_BLOCKS.includes(block.typeId);
  } catch {
    return false;
  }
}
function canStandAt(dimension, x, y, z, height = 2) {
  const floorX = Math.floor(x);
  const floorY = Math.floor(y);
  const floorZ = Math.floor(z);
  for (let h = 0; h < height; h++) {
    if (isBlockSolidCube(dimension, floorX, floorY + h, floorZ)) {
      return false;
    }
  }
  if (!isBlockSolidCube(dimension, floorX, floorY - 1, floorZ)) {
    let foundGround = false;
    for (let dy = 2; dy <= 4; dy++) {
      if (isBlockSolidCube(dimension, floorX, floorY - dy, floorZ)) {
        foundGround = true;
        break;
      }
    }
    if (!foundGround) return false;
  }
  if (
    isBlockDangerous(dimension, floorX, floorY, floorZ) ||
    isBlockDangerous(dimension, floorX, floorY - 1, floorZ)
  ) {
    return false;
  }
  return true;
}
function canMoveBetween(dimension, from, to, height = 2) {
  const fromX = Math.floor(from.x);
  const fromY = Math.floor(from.y);
  const fromZ = Math.floor(from.z);
  const toX = Math.floor(to.x);
  const toY = Math.floor(to.y);
  const toZ = Math.floor(to.z);
  if (!canStandAt(dimension, to.x, to.y, to.z, height)) {
    return false;
  }
  if (from.x !== to.x && from.z !== to.z) {
    if (
      !isBlockPassable(dimension, from.x, from.y, to.z) ||
      !isBlockPassable(dimension, to.x, from.y, from.z)
    ) {
      return false;
    }
    if (
      !isBlockPassable(dimension, from.x, from.y + 1, to.z) ||
      !isBlockPassable(dimension, to.x, from.y + 1, from.z)
    ) {
      return false;
    }
  }
  return true;
}
function getNeighbors(dimension, node, height = 2) {
  const neighbors = [];
  const directions = [
    { dx: 1, dy: 0, dz: 0, cost: 1.0 },
    { dx: -1, dy: 0, dz: 0, cost: 1.0 },
    { dx: 0, dy: 0, dz: 1, cost: 1.0 },
    { dx: 0, dy: 0, dz: -1, cost: 1.0 },
    { dx: 1, dy: 0, dz: 1, cost: 1.414 },
    { dx: 1, dy: 0, dz: -1, cost: 1.414 },
    { dx: -1, dy: 0, dz: 1, cost: 1.414 },
    { dx: -1, dy: 0, dz: -1, cost: 1.414 },
    { dx: 1, dy: 1, dz: 0, cost: 1.5 },
    { dx: -1, dy: 1, dz: 0, cost: 1.5 },
    { dx: 0, dy: 1, dz: 1, cost: 1.5 },
    { dx: 0, dy: 1, dz: -1, cost: 1.5 },
    { dx: 1, dy: -1, dz: 0, cost: 1.2 },
    { dx: -1, dy: -1, dz: 0, cost: 1.2 },
    { dx: 0, dy: -1, dz: 1, cost: 1.2 },
    { dx: 0, dy: -1, dz: -1, cost: 1.2 },
    { dx: 0, dy: 1, dz: 0, cost: 1.5 },
    { dx: 0, dy: -1, dz: 0, cost: 0.8 },
  ];
  for (const dir of directions) {
    const nx = node.x + dir.dx;
    const ny = node.y + dir.dy;
    const nz = node.z + dir.dz;
    if (
      canMoveBetween(
        dimension,
        { x: node.x, y: node.y, z: node.z },
        { x: nx, y: ny, z: nz },
        height,
      )
    ) {
      neighbors.push({ x: nx, y: ny, z: nz, cost: dir.cost });
    }
  }
  return neighbors;
}
function heuristic(node, goal) {
  const dx = Math.abs(node.x - goal.x);
  const dy = Math.abs(node.y - goal.y);
  const dz = Math.abs(node.z - goal.z);
  return (
    Math.sqrt(dx * dx + dy * dy + dz * dz) * PATHFINDING_CONFIG.HEURISTIC_WEIGHT
  );
}
export function findPath(dimension, start, goal, options = {}) {
  debugLog("[A*] Using dynamic pathfinding system");
  const path = findDynamicPath(dimension, start, goal, {
    height: options.height ?? PATHFINDING_CONFIG.HEIGHT_CHECK,
    maxIterations: options.maxIterations ?? PATHFINDING_CONFIG.MAX_ITERATIONS,
    maxPathLength: options.maxPathLength ?? PATHFINDING_CONFIG.MAX_PATH_LENGTH,
  });
  return path;
}
function reconstructPath(node) {
  const path = [];
  let current = node;
  while (current !== null) {
    path.unshift({
      x: current.x + 0.5,
      y: current.y,
      z: current.z + 0.5,
    });
    current = current.parent;
  }
  return path;
}
function findValidNearbyPosition(
  dimension,
  x,
  y,
  z,
  height = 2,
  searchRadius = 3,
) {
  if (canStandAt(dimension, x, y, z, height)) {
    return { x, y, z };
  }
  for (let r = 1; r <= searchRadius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r || Math.abs(dy) === r || Math.abs(dz) === r) {
            const nx = x + dx;
            const ny = y + dy;
            const nz = z + dz;
            if (canStandAt(dimension, nx, ny, nz, height)) {
              return { x: nx, y: ny, z: nz };
            }
          }
        }
      }
    }
  }
  return null;
}
function simplifyPath(path, dimension, height = 2) {
  if (path.length <= 2) return path;
  const simplified = [path[0]];
  let current = 0;
  while (current < path.length - 1) {
    let farthest = current + 1;
    for (let i = path.length - 1; i > current + 1; i--) {
      if (hasLineOfSight(dimension, path[current], path[i], height)) {
        farthest = i;
        break;
      }
    }
    simplified.push(path[farthest]);
    current = farthest;
  }
  return simplified;
}
function hasLineOfSight(dimension, from, to, height = 2) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const MAX_HEIGHT_DIFF_FOR_SIMPLIFICATION = 1.0;
  if (Math.abs(dy) > MAX_HEIGHT_DIFF_FOR_SIMPLIFICATION) {
    return false;
  }
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const steps = Math.ceil(dist * 4);
  let lastX = Math.floor(from.x);
  let lastZ = Math.floor(from.z);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.floor(from.x + dx * t);
    const y = Math.floor(from.y + dy * t);
    const z = Math.floor(from.z + dz * t);
    if (!canStandAt(dimension, x, y, z, height)) {
      return false;
    }
    if (
      isBlockSolid(dimension, x, y, z) ||
      isBlockSolid(dimension, x, y + 1, z)
    ) {
      return false;
    }
    if (x !== lastX && z !== lastZ) {
      if (
        isBlockSolid(dimension, lastX, y, z) ||
        isBlockSolid(dimension, x, y, lastZ) ||
        isBlockSolid(dimension, lastX, y + 1, z) ||
        isBlockSolid(dimension, x, y + 1, lastZ)
      ) {
        return false;
      }
    }
    lastX = x;
    lastZ = z;
  }
  return true;
}
export function startPathfinding(entity, goalPos, options = {}) {
  if (!entity) {
    debugWarn("[Pathfinding] Invalid entity");
    return null;
  }
  try {
    const sessionId = startDynamicPathfinding(entity, goalPos, options);
    debugLog(`[Pathfinding] Started session ${sessionId}`);
    return sessionId;
  } catch (e) {
    debugWarn("[Pathfinding] Error starting session:", e);
    return null;
  }
}

function normalizeCompassRotationToYaw(rotationValue) {
  if (rotationValue === undefined || rotationValue === null) return 0;
  const rotNum = Number(rotationValue);
  if (!Number.isFinite(rotNum)) return 0;
  let compassDeg =
    Math.abs(rotNum) <= Math.PI * 2 + 0.001 && !Number.isInteger(rotNum)
      ? (rotNum * 180) / Math.PI
      : rotNum;
  compassDeg = ((Math.round(compassDeg) % 360) + 360) % 360;
  return compassDeg;
}

function normalizeYawRotation(rotationValue) {
  if (rotationValue === undefined || rotationValue === null) return 0;
  const rotNum = Number(rotationValue);
  if (!Number.isFinite(rotNum)) return 0;
  const degrees =
    Math.abs(rotNum) <= Math.PI * 2 + 0.001 && !Number.isInteger(rotNum)
      ? (rotNum * 180) / Math.PI
      : rotNum;
  return ((degrees % 360) + 360) % 360;
}
function calculateSessionPath(session) {
  try {
    const dimension = world.getDimension(session.dimensionId);

    session.state = "calculating";

    if (session.pathRequestId) {
      cancelPathRequest(session.pathRequestId);
    }

    session.pathRequestId = requestPathAsync(
      dimension,
      session.currentPos,
      session.goalPos,
      {
        height: session.options.height ?? PATHFINDING_CONFIG.HEIGHT_CHECK,
        maxIterations: session.options.maxIterations ?? PATHFINDING_CONFIG.MAX_ITERATIONS,
        maxPathLength: session.options.maxPathLength ?? PATHFINDING_CONFIG.MAX_PATH_LENGTH,
        horizontalOnly: false
      },
      (path) => {
        session.pathRequestId = null;
        if (path && path.length > 0) {

          session.path = path;
          session.pathIndex = 0;
          session.state = "moving";
          session.stateStartTime = Date.now();

        } else {
          session.state = "failed";
          debugWarn(`[Pathfinding] Session ${session.sessionId}: No path found (async)`);
          if (session.options.onFailed) {
            try {
              session.options.onFailed(session);
            } catch { }
          }
        }
      }
    );

  } catch (e) {
    debugWarn("[Pathfinding] Error initiating calc:", e);
    session.state = "failed";
  }
}
export function stopPathfinding(sessionId) {
  return stopDynamicPathfinding(sessionId);
}

export function getPathfindingSession(sessionId) {
  return getDynamicPathfindingSession(sessionId);
}

export function hasActivePathfinding(entityId) {
  return hasActiveDynamicPathfinding(entityId);
}

export function getSessionByEntityId(entityId) {
  for (const sessionId of getActivePathfindingSessions()) {
    const session = getDynamicPathfindingSession(sessionId);
    if (session && session.entityId === entityId) return session;
  }
  return null;
}
function findNearestPlayer(
  dimension,
  position,
  maxRange,
  excludeCreative = true,
) {
  try {
    const players = dimension.getPlayers({
      location: position,
      maxDistance: maxRange,
    });
    let nearestPlayer = null;
    let nearestDistance = Infinity;
    for (const player of players) {
      if (excludeCreative) {
        try {
          const gameMode = player.getGameMode();
          const gmStr = String(gameMode).toLowerCase();

          if (gmStr === "creative" || gmStr === "1" || gmStr === "spectator" || gmStr === "3") {
            continue;
          }
        } catch {
          continue;
        }
      }
      const dist = getDistance3D(position, player.location);
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestPlayer = player;
      }
    }
    return nearestPlayer
      ? { player: nearestPlayer, distance: nearestDistance }
      : null;
  } catch {
    return null;
  }
}
function getDistance3D(pos1, pos2) {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
const GLOBAL_LOGIC_INTERVAL = 5;

export function processPathfindingTick() {
  if (pathfindingSessions.size === 0) return;

  const currentTick = system.currentTick;

  for (const [sessionId, session] of pathfindingSessions) {
    try {

      const shouldRunLogic = (session.sessionId + currentTick) % GLOBAL_LOGIC_INTERVAL === 0;
      processSession(session, shouldRunLogic);
    } catch (e) {
      debugWarn(`[Pathfinding] Error processing session ${sessionId}:`, e);
      session.state = "failed";
    }
  }

  for (const [sessionId, session] of pathfindingSessions) {
    if (session.state === "completed" || session.state === "failed") {
      pathfindingSessions.delete(sessionId);
    }
  }
}

function processSession(session, shouldRunLogic) {
  session.tickCounter++;

  const entity = findEntity(session.entityId, session.dimensionId, session.currentPos);
  if (!entity) {

    session.state = "failed";
    return;
  }

  const dimension = entity.dimension;

  if (
    shouldRunLogic &&
    session.options.detectPlayers &&
    session.tickCounter % PATHFINDING_CONFIG.DETECTION_INTERVAL_TICKS === 0
  ) {
    handlePlayerDetection(session, entity, dimension);
  }

  switch (session.state) {
    case "calculating":
      break;
    case "moving":

      processMovement(session, entity, dimension, shouldRunLogic);
      break;
    case "chasing":
      processChasing(session, entity, dimension, shouldRunLogic);
      break;
    case "waiting":
      if (shouldRunLogic) processWaiting(session, entity, dimension);
      break;
    case "completed":
    case "failed":
      break;
  }
}
function handlePlayerDetection(session, entity, dimension) {
  const nearestPlayer = findNearestPlayer(
    dimension,
    entity.location,
    session.isChasing
      ? PATHFINDING_CONFIG.PLAYER_CHASE_RANGE
      : PATHFINDING_CONFIG.PLAYER_DETECTION_RANGE,
  );

  if (nearestPlayer) {

    if (!session.isChasing || session.state === "moving") {
      broadcastDebug(
        `Session ${session.sessionId}: Player ${nearestPlayer.player.name} spotted at ${nearestPlayer.distance.toFixed(1)} blocks! ${session.isChasing ? "Resuming chase" : "Starting chase"}`,
      );
      session.isChasing = true;
      session.chaseTargetId = nearestPlayer.player.id;
      session.savedPathIndex = session.state === "chasing" ? session.savedPathIndex : session.pathIndex;
      session.savedGoalPos = session.state === "chasing" ? session.savedGoalPos : { ...session.goalPos };
      session.state = "chasing";
      try {
        entity.triggerEvent("fr:start_chasing");
      } catch { }
    }
  } else if (session.isChasing) {
    if (!session._lostPlayerTime) {
      session._lostPlayerTime = Date.now();
    }

    const timeLost = Date.now() - session._lostPlayerTime;
    const persistenceMs = 3000;

    if (timeLost < persistenceMs) {
      return;
    }

    broadcastDebug(
      `Session ${session.sessionId}: Lost player for ${persistenceMs / 1000}s, giving up chase.`
    );
    delete session._lostPlayerTime;
    session.isChasing = false;
    session.chaseTargetId = null;
    try {
      entity.triggerEvent("fr:stop_chasing");
    } catch { }

    if (session.options.onChaseEnd) {
      try {
        session.options.onChaseEnd(session);
      } catch (e) {
        debugWarn("[Pathfinding] Error in onChaseEnd callback:", e);
      }
    }
    if (session.options.returnToPath && session.savedGoalPos) {
      session.goalPos = session.savedGoalPos;
      session.currentPos = { ...entity.location };
      session.state = "calculating";
      calculateSessionPath(session);
    } else {
      session.state = "completed";
    }
  } else if (session._lostPlayerTime) {
    delete session._lostPlayerTime;
  }
}
function processMovement(session, entity, dimension, shouldRunLogic) {
  if (session.path.length === 0 || session.pathIndex >= session.path.length) {
    handleArrival(session, entity);
    return;
  }
  if (session.tickCounter % PATHFINDING_CONFIG.MOVE_INTERVAL_TICKS !== 0) {
    return;
  }
  const targetPos = session.path[session.pathIndex];
  const currentPos = entity.location;
  const distance = getDistance3D(currentPos, targetPos);
  if (DEBUG_MODE && session.tickCounter % 40 === 0) {
    debugLog(
      `[Pathfinding] Session ${session.sessionId}: waypoint ${session.pathIndex + 1}/${session.path.length}`,
    );
    debugLog(
      `[Pathfinding] pos=(${currentPos.x.toFixed(1)}, ${currentPos.y.toFixed(1)}, ${currentPos.z.toFixed(1)}) -> target=(${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)}, ${targetPos.z.toFixed(1)}) dist=${distance.toFixed(2)}`,
    );
    debugLog(
      `[Pathfinding] ARRIVAL_THRESHOLD=${PATHFINDING_CONFIG.ARRIVAL_THRESHOLD}, stuckCounter=${session.stuckCounter || 0}`,
    );
  }
  if (
    distance > PATHFINDING_CONFIG.ARRIVAL_THRESHOLD &&
    distance < PATHFINDING_CONFIG.ARRIVAL_THRESHOLD * 3 &&
    session.tickCounter % 10 === 0
  ) {
    debugLog(
      `[Pathfinding] Session ${session.sessionId}: CLOSE but not arrived! dist=${distance.toFixed(3)}, threshold=${PATHFINDING_CONFIG.ARRIVAL_THRESHOLD}`,
    );
    debugLog(
      `[Pathfinding] Current: (${currentPos.x.toFixed(2)}, ${currentPos.y.toFixed(2)}, ${currentPos.z.toFixed(2)})`,
    );
    debugLog(
      `[Pathfinding] Target: (${targetPos.x.toFixed(2)}, ${targetPos.y.toFixed(2)}, ${targetPos.z.toFixed(2)})`,
    );
  }
  if (distance <= PATHFINDING_CONFIG.ARRIVAL_THRESHOLD) {
    debugLog(
      `[Pathfinding] Session ${session.sessionId}: ARRIVED at waypoint! dist=${distance.toFixed(3)}`,
    );
    session.pathIndex++;
    session.currentPos = { ...currentPos };
    session.stuckCounter = 0;
    debugLog(
      `[Pathfinding] Reached waypoint ${session.pathIndex}/${session.path.length}`,
    );
    if (session.pathIndex >= session.path.length) {
      debugLog(
        `[Pathfinding] Session ${session.sessionId}: FINAL WAYPOINT REACHED - calling handleArrival`,
      );
      handleArrival(session, entity);
    } else {
      debugLog(
        `[Pathfinding] Session ${session.sessionId}: Moving to next waypoint ${session.pathIndex + 1}/${session.path.length}`,
      );
    }
    return;
  }
  const dx = targetPos.x - currentPos.x;
  const dy = targetPos.y - currentPos.y;
  const dz = targetPos.z - currentPos.z;
  const horizontalDist = Math.sqrt(dx * dx + dz * dz);
  const groundY = Math.floor(currentPos.y);
  const blockBelow = dimension.getBlock({
    x: Math.floor(currentPos.x),
    y: groundY - 1,
    z: Math.floor(currentPos.z),
  });
  const isOnGround =
    blockBelow &&
    isBlockSolid(
      dimension,
      blockBelow.location.x,
      blockBelow.location.y,
      blockBelow.location.z,
    );
  const GRAVITY = -0.25;
  let moveY = 0;
  if (!isOnGround && dy <= 0) {
    moveY = GRAVITY;
  } else {
    const MAX_STEP_HEIGHT = 1.0;
    const absHeightDiff = Math.abs(dy);
    if (absHeightDiff <= MAX_STEP_HEIGHT && dy > 0) {
      if (horizontalDist < 1.5) {
        const targetBlockBelow = dimension.getBlock({
          x: Math.floor(targetPos.x),
          y: Math.floor(targetPos.y) - 1,
          z: Math.floor(targetPos.z),
        });
        const canStepUp =
          targetBlockBelow &&
          isBlockSolid(
            dimension,
            targetBlockBelow.location.x,
            targetBlockBelow.location.y,
            targetBlockBelow.location.z,
          );
        if (canStepUp) {
          moveY = 0.2;
        }
      }
    } else if (dy < 0 && absHeightDiff <= MAX_STEP_HEIGHT) {
      moveY = -0.15;
    } else if (absHeightDiff > MAX_STEP_HEIGHT) {
      moveY = isOnGround ? 0 : GRAVITY;
      if (DEBUG_MODE && session.tickCounter % 60 === 0) {
        debugWarn(
          `[Pathfinding] Session ${session.sessionId}: Target too high/low! dy=${dy.toFixed(2)}, max allowed=${MAX_STEP_HEIGHT}`,
        );
      }
    }
  }
  const speed = PATHFINDING_CONFIG.MOVE_SPEED;
  const moveX = horizontalDist > 0.1 ? (dx / horizontalDist) * speed : 0;
  const moveZ = horizontalDist > 0.1 ? (dz / horizontalDist) * speed : 0;
  const newPos = {
    x: currentPos.x + moveX,
    y: currentPos.y + moveY,
    z: currentPos.z + moveZ,
  };
  const finalGroundBlock = dimension.getBlock({
    x: Math.floor(newPos.x),
    y: Math.floor(newPos.y) - 1,
    z: Math.floor(newPos.z),
  });
  if (
    finalGroundBlock &&
    isBlockSolid(
      dimension,
      finalGroundBlock.location.x,
      finalGroundBlock.location.y,
      finalGroundBlock.location.z,
    )
  ) {
    const groundLevel = Math.floor(newPos.y);
    if (newPos.y > groundLevel && newPos.y < groundLevel + 0.3) {
      newPos.y = groundLevel;
    }
  }
  const yaw = Math.atan2(-dx, dz) * (180 / Math.PI);
  const targetBlockX = Math.floor(newPos.x);
  const targetBlockY = Math.floor(newPos.y);
  const targetBlockZ = Math.floor(newPos.z);
  const isBlocked =
    isBlockSolid(dimension, targetBlockX, targetBlockY, targetBlockZ) ||
    isBlockSolid(dimension, targetBlockX, targetBlockY + 1, targetBlockZ);
  if (isBlocked) {
    session.blockedCounter = (session.blockedCounter || 0) + 1;
    if (session.blockedCounter >= 3) {
      debugWarn(
        `[Pathfinding] Session ${session.sessionId}: BLOCKED by wall at (${targetBlockX}, ${targetBlockY}, ${targetBlockZ}), recalculating path...`,
      );
      session.blockedCounter = 0;
      session.currentPos = { ...entity.location };
      if (session.pathIndex < session.path.length - 1) {
        session.state = "calculating";
        calculateSessionPath(session);
      } else {
        session.state = "calculating";
        calculateSessionPath(session);
      }
      return;
    }
    const sideStep = 0.3;
    const alternatePositions = [
      { x: currentPos.x + sideStep, y: currentPos.y, z: currentPos.z },
      { x: currentPos.x - sideStep, y: currentPos.y, z: currentPos.z },
      { x: currentPos.x, y: currentPos.y, z: currentPos.z + sideStep },
      { x: currentPos.x, y: currentPos.y, z: currentPos.z - sideStep },
    ];
    for (const altPos of alternatePositions) {
      const altBlockX = Math.floor(altPos.x);
      const altBlockY = Math.floor(altPos.y);
      const altBlockZ = Math.floor(altPos.z);
      if (
        !isBlockSolid(dimension, altBlockX, altBlockY, altBlockZ) &&
        !isBlockSolid(dimension, altBlockX, altBlockY + 1, altBlockZ)
      ) {
        try {
          entity.teleport(altPos, { rotation: { x: 0, y: yaw } });
          session.currentPos = { ...entity.location };
        } catch { }
        return;
      }
    }
    return;
  }
  session.blockedCounter = 0;
  try {
    const beforeLoc = { ...entity.location };
    entity.teleport(newPos, {
      rotation: { x: 0, y: yaw },
    });
    const afterLoc = entity.location;
    const teleportDist = getDistance3D(beforeLoc, afterLoc);
    if (teleportDist < 0.01) {
      session.teleportFailCount = (session.teleportFailCount || 0) + 1;
      if (session.teleportFailCount >= 5) {
        debugWarn(
          `[Pathfinding] Session ${session.sessionId}: Teleport keeps failing, recalculating path...`,
        );
        session.teleportFailCount = 0;
        session.currentPos = { ...entity.location };
        session.state = "calculating";
        calculateSessionPath(session);
        return;
      }
    } else {
      session.teleportFailCount = 0;
    }
    session.currentPos = { ...afterLoc };
  } catch (e) {
    debugWarn("[Pathfinding] Teleport error:", e);
  }
  checkStuck(session, entity);
  if (
    session.pathIndex === session.path.length - 1 &&
    session.tickCounter % 20 === 0
  ) {
    debugLog(
      `[Pathfinding] Session ${session.sessionId}: Approaching FINAL waypoint, dist=${distance.toFixed(2)}, threshold=${PATHFINDING_CONFIG.ARRIVAL_THRESHOLD}`,
    );
  }
}
function processChasing(session, entity, dimension, shouldRunLogic) {

  let target = findEntity(session.chaseTargetId, session.dimensionId, entity.location);

  if (!target) {
    broadcastDebug(`Chase failed: Target ${session.chaseTargetId} not found`);
    session.isChasing = false;

    if (session.options.onChaseEnd) {
      try {
        session.options.onChaseEnd(session);
      } catch (e) {
        debugWarn("[Pathfinding] Error in onChaseEnd callback:", e);
      }
    }

    if (session.options.returnToPath && session.savedGoalPos) {
      session.goalPos = session.savedGoalPos;
      session.pathIndex = session.savedPathIndex;
      session.state = "moving";

      session.state = "calculating";
      calculateSessionPath(session);
    } else {
      session.state = "completed";
    }
    return;
  }

  if (session.tickCounter % PATHFINDING_CONFIG.MOVE_INTERVAL_TICKS !== 0) {
    return;
  }

  const distance = getDistance3D(currentPos, targetPos);

  if (session.tickCounter % 10 === 0) {
    broadcastDebug(`Chasing ${target.typeId}: Distance ${distance.toFixed(1)}`);
  }

  if (distance <= PATHFINDING_CONFIG.ARRIVAL_THRESHOLD * 2) {
    try {
      entity.triggerEvent("fr:caught_player");
    } catch { }

    return;
  }

  const dx = targetPos.x - currentPos.x;
  const dy = targetPos.y - currentPos.y;
  const dz = targetPos.z - currentPos.z;
  const horizontalDist = Math.sqrt(dx * dx + dz * dz);

  const speed = PATHFINDING_CONFIG.MOVE_SPEED * PATHFINDING_CONFIG.CHASE_SPEED_MULTIPLIER;
  const moveX = horizontalDist > 0.1 ? (dx / horizontalDist) * speed : 0;
  const moveZ = horizontalDist > 0.1 ? (dz / horizontalDist) * speed : 0;

  const maxStepHeight = 0.6;
  let moveY = 0;
  if (Math.abs(dy) <= maxStepHeight && Math.abs(dy) > 0.1) {
    moveY = dy > 0 ? 0.15 : -0.15;
  }

  let newPos = {
    x: currentPos.x + moveX,
    y: currentPos.y + moveY,
    z: currentPos.z + moveZ,
  };

  if (
    !canStandAt(
      dimension,
      Math.floor(newPos.x),
      Math.floor(newPos.y),
      Math.floor(newPos.z),
    )
  ) {

    if (shouldRunLogic) {
      session.goalPos = targetPos;
      session.state = "calculating";
      calculateSessionPath(session);
    }
    return;
  }

  const yaw = Math.atan2(-dx, dz) * (180 / Math.PI);
  try {
    entity.teleport(newPos, {
      rotation: { x: 0, y: yaw },
    });
    session.currentPos = newPos;
  } catch (e) {
    debugWarn("[Pathfinding] Chase teleport error:", e);
  }
}
function processWaiting(session, entity, dimension) {
  const waitTime = session.options.waitTime || 0;
  const elapsed = Date.now() - session.stateStartTime;
  if (elapsed >= waitTime) {
    session.state = "completed";
    if (session.options.onArrival) {
      try {
        console.log(
          `[Pathfinding] Session ${session.sessionId}: Wait complete, calling onArrival callback`,
        );
        session.options.onArrival(session, entity);
        console.log(
          `[Pathfinding] Session ${session.sessionId}: onArrival callback completed`,
        );
      } catch (e) {
        console.warn(
          `[Pathfinding] Session ${session.sessionId}: ERROR in onArrival callback:`,
          e,
        );
      }
    }
  }
}
function handleArrival(session, entity) {
  console.log(
    `[Pathfinding] Session ${session.sessionId}: Arrived at destination`,
  );
  let rotDegrees = 0;
  try {
    const goalPos = session.goalPos;
    const centeredPos = {
      x: Math.floor(goalPos.x) + 0.5,
      y: Math.floor(goalPos.y),
      z: Math.floor(goalPos.z) + 0.5,
    };
    if (
      session.options.rotation !== undefined &&
      session.options.rotation !== null
    ) {
      rotDegrees = normalizeYawRotation(session.options.rotation);
    }
    entity.teleport(centeredPos, {
      rotation: { x: 0, y: rotDegrees },
    });
    console.log(
      `[Pathfinding] Centered at: ${centeredPos.x}, ${centeredPos.y}, ${centeredPos.z}, rot: ${rotDegrees}`,
    );
  } catch (e) {
    console.warn("[Pathfinding] Error centering entity:", e);
  }
  if (session.options.pose !== undefined && session.options.pose !== null) {
    try {
      entity.triggerEvent(`fr:set_pose_${session.options.pose}`);
      entity.setDynamicProperty("fr:pose_index", session.options.pose);
      console.log(`[Pathfinding] Applied pose: ${session.options.pose}`);
    } catch (e) {
      console.warn("[Pathfinding] Error applying pose:", e);
    }
  }
  if (
    session.options.variant !== undefined &&
    session.options.variant !== null &&
    session.options.variant >= 0
  ) {
    try {
      entity.triggerEvent(`fr:set_variant_${session.options.variant}`);
      entity.setDynamicProperty("fr:variant_index", session.options.variant);
      console.log(`[Pathfinding] Applied variant: ${session.options.variant}`);
    } catch (e) {
      console.warn("[Pathfinding] Error applying variant:", e);
    }
  }
  if (
    session.options.rotation !== undefined &&
    session.options.rotation !== null
  ) {
    system.runTimeout(() => {
      try {
        if (!entity || !entity.isValid) return;
        const pos = entity.location;
        entity.teleport(
          { x: pos.x, y: pos.y, z: pos.z },
          { rotation: { x: 0, y: rotDegrees } },
        );
      } catch { }
    }, 3);
  }
  if (session.options.waitTime > 0) {
    session.state = "waiting";
    session.stateStartTime = Date.now();
    console.log(
      `[Pathfinding] Session ${session.sessionId}: Entering waiting state for ${session.options.waitTime}ms`,
    );
  } else {
    session.state = "completed";
    console.log(
      `[Pathfinding] Session ${session.sessionId}: No wait time, going to completed state`,
    );
    if (session.options.onArrival) {
      try {
        console.log(
          `[Pathfinding] Session ${session.sessionId}: Calling onArrival callback immediately`,
        );
        session.options.onArrival(session, entity);
        console.log(
          `[Pathfinding] Session ${session.sessionId}: onArrival callback completed successfully`,
        );
      } catch (e) {
        console.warn(
          `[Pathfinding] Session ${session.sessionId}: ERROR in onArrival callback:`,
          e,
        );
      }
    } else {
      console.log(
        `[Pathfinding] Session ${session.sessionId}: No onArrival callback defined`,
      );
    }
  }
}
function checkStuck(session, entity) {
  const now = Date.now();
  if (!session.recalcCount) session.recalcCount = 0;
  if (!session.recalcResetTime) session.recalcResetTime = now;
  if (!session.consecutiveFailures) session.consecutiveFailures = 0;
  if (now - session.recalcResetTime > 60000) {
    session.recalcCount = 0;
    session.recalcResetTime = now;
  }
  const checkInterval = PATHFINDING_CONFIG.STUCK_CHECK_INTERVAL_MS || 1500;
  if (now - session.lastProgressCheck >= checkInterval) {
    const distance = getDistance3D(entity.location, session.lastProgressPos);
    const stuckThreshold = PATHFINDING_CONFIG.STUCK_DISTANCE || 0.1;
    if (distance < stuckThreshold) {
      session.stuckCounter++;
      if (session.stuckCounter % 2 === 0) {
        console.log(
          `[Pathfinding] Session ${session.sessionId}: No progress (stuck count: ${session.stuckCounter})`,
        );
      }
      if (session.stuckCounter >= 2) {
        console.warn(
          `[Pathfinding] Session ${session.sessionId}: STUCK DETECTED! stuckCounter=${session.stuckCounter}, failures=${session.consecutiveFailures}`,
        );
        session.consecutiveFailures++;
        const skipAfter = PATHFINDING_CONFIG.SKIP_WAYPOINT_AFTER_FAILURES || 3;
        if (session.consecutiveFailures >= skipAfter) {
          console.log(
            `[Pathfinding] Session ${session.sessionId}: Too many failures (${session.consecutiveFailures}), skipping waypoint`,
          );
          session.stuckCounter = 0;
          session.consecutiveFailures = 0;
          if (session.pathIndex < session.path.length - 1) {
            session.pathIndex++;
            console.log(
              `[Pathfinding] Skipped to waypoint ${session.pathIndex + 1}/${session.path.length}`,
            );
            if (session.pathIndex >= session.path.length - 2) {
              console.log(
                `[Pathfinding] Near end, recalculating direct path to goal`,
              );
              session.currentPos = { ...entity.location };
              session.state = "calculating";
              calculateSessionPath(session);
            }
          } else {
            const distToGoal = getDistance3D(entity.location, session.goalPos);
            if (distToGoal < 3.0) {
              console.log(
                `[Pathfinding] Close to goal (${distToGoal.toFixed(1)}), forcing arrival`,
              );
              handleArrival(session, entity);
            }
          }
          return;
        }
        if (session.recalcCount >= PATHFINDING_CONFIG.MAX_RECALC_PER_MINUTE) {
          console.log(
            `[Pathfinding] Session ${session.sessionId}: Recalc limit reached, trying waypoint skip`,
          );
          session.stuckCounter = 0;
          if (session.pathIndex < session.path.length - 1) {
            session.pathIndex++;
            session.consecutiveFailures = 0;
            console.log(
              `[Pathfinding] Skipped to waypoint ${session.pathIndex + 1}/${session.path.length}`,
            );
          }
          return;
        }
        console.log(
          `[Pathfinding] Session ${session.sessionId}: Recalculating path (attempt ${session.recalcCount + 1})`,
        );
        session.currentPos = { ...entity.location };
        session.state = "calculating";
        session.stuckCounter = 0;
        session.recalcCount++;
        calculateSessionPath(session);
      }
    } else {
      if (session.stuckCounter > 0 || session.consecutiveFailures > 0) {
        console.log(
          `[Pathfinding] Session ${session.sessionId}: Progress made (${distance.toFixed(2)} blocks), resetting counters`,
        );
        session.stuckCounter = 0;
        session.consecutiveFailures = 0;
      }
    }
    session.lastProgressPos = { ...entity.location };
    session.lastProgressCheck = now;
  }
}
function findEntity(entityId, dimensionId, locationHint = null) {

  try {
    const entity = world.getEntity(entityId);
    if (entity) return entity;
  } catch { }

  try {
    const dimension = world.getDimension(dimensionId);

    if (locationHint) {
      const entities = dimension.getEntities({
        location: locationHint,
        maxDistance: 32,
      });
      for (const entity of entities) {
        if (entity.id === entityId) return entity;
      }
    }

    for (const entity of dimension.getEntities()) {
      if (entity.id === entityId) {
        return entity;
      }
    }
  } catch { }
  return null;
}
function getAnimatronicTypeForStatue(statueType) {
  const mapping = {
    "fr:bonnie_statue": "fr:fnaf1_bonnie_entity",
    "fr:chica_statue": "fr:fnaf1_chica_entity",
    "fr:foxy_statue": "fr:fnaf1_foxy_entity",
    "fr:freddy_fazbear_statue": "fr:fnaf1_freddy_entity",
    "fr:sparky_statue": "fr:fnaf1_sparky_entity",
  };
  return mapping[statueType] || "fr:fnaf1_bonnie_entity";
}
function getStatueTypeForAnimatronic(animatronicType) {
  const mapping = {
    "fr:fnaf1_bonnie_entity": "fr:bonnie_statue",
    "fr:fnaf1_chica_entity": "fr:chica_statue",
    "fr:fnaf1_foxy_entity": "fr:foxy_statue",
    "fr:fnaf1_freddy_entity": "fr:freddy_fazbear_statue",
    "fr:fnaf1_sparky_entity": "fr:sparky_statue",
  };
  return mapping[animatronicType] || "fr:bonnie_statue";
}
function isStatueType(typeId) {
  return (
    typeId.includes("_statue") ||
    typeId === "fr:bonnie_statue" ||
    typeId === "fr:chica_statue" ||
    typeId === "fr:foxy_statue" ||
    typeId === "fr:freddy_fazbear_statue"
  );
}
export function startAStarRouteTest(entity, routePoints, player, options = {}) {
  if (!entity || !routePoints || routePoints.length === 0) {
    player?.sendMessage("§c[Route Test] §7Invalid entity or no route points!");
    return null;
  }
  const dimension = entity.dimension;
  const startLocation = { ...entity.location };
  const startRotation = entity.getRotation?.()?.y || 0;
  const originalEntityType = entity.typeId;
  let variantIndex = 0;
  let poseIndex = 0;
  let statueId = null;
  let platformLocation = null;
  let routeId = null;
  let linkedStageplate = null;
  let animatronicId = null;
  try {
    variantIndex = entity.getDynamicProperty("fr:variant_index") || 0;
    poseIndex = entity.getDynamicProperty("fr:pose_index") || 0;
    statueId = entity.getDynamicProperty("fr:statue_id");
    platformLocation = entity.getDynamicProperty("fr:platform_location");
    routeId = entity.getDynamicProperty("fr:route_id");
    linkedStageplate = entity.getDynamicProperty("fr:linked_stageplate");
    animatronicId = entity.getDynamicProperty("fr:animatronic_id");
  } catch { }
  let walkingEntity = entity;
  if (isStatueType(originalEntityType)) {
    try {
      const animatronicType = getAnimatronicTypeForStatue(originalEntityType);
      walkingEntity = dimension.spawnEntity(animatronicType, startLocation);
      walkingEntity.setDynamicProperty("fr:variant_index", variantIndex);
      walkingEntity.setDynamicProperty("fr:pose_index", poseIndex);
      walkingEntity.setDynamicProperty("fr:is_route_test", true);
      if (statueId) {
        walkingEntity.setDynamicProperty("fr:statue_id", statueId);
      }
      if (platformLocation) {
        walkingEntity.setDynamicProperty(
          "fr:platform_location",
          platformLocation,
        );
      }
      if (routeId !== null && routeId !== undefined) {
        walkingEntity.setDynamicProperty("fr:route_id", routeId);
      }
      if (linkedStageplate) {
        walkingEntity.setDynamicProperty(
          "fr:linked_stageplate",
          linkedStageplate,
        );
      }
      if (animatronicId) {
        walkingEntity.setDynamicProperty("fr:animatronic_id", animatronicId);
      }
      console.log(`[A* Route Test] Copied properties to walking entity:`);
      console.log(`  - variant_index: ${variantIndex}`);
      console.log(`  - pose_index: ${poseIndex}`);
      console.log(`  - statue_id: ${statueId}`);
      console.log(`  - platform_location: ${platformLocation}`);
      console.log(`  - route_id: ${routeId}`);
      console.log(`  - linked_stageplate: ${linkedStageplate}`);
      console.log(`  - animatronic_id: ${animatronicId}`);
      if (variantIndex > 0) {
        try {
          walkingEntity.triggerEvent(`fr:set_variant_${variantIndex}`);
        } catch { }
      }
      try {
        walkingEntity.triggerEvent("fr:disable_ai_walk");
      } catch { }
      walkingEntity.addTag("fr:route_test_entity");
      entity.remove();
      player?.sendMessage(
        "§a[A* Route Test] §7Converted statue to walking animatronic.",
      );
      console.log(
        `[A* Route Test] Converted ${originalEntityType} to ${animatronicType}`,
      );
    } catch (e) {
      console.warn("[A* Route Test] Error converting statue:", e);
      player?.sendMessage(
        "§c[Route Test] §7Failed to convert statue to animatronic.",
      );
      return null;
    }
  }
  const testSession = {
    entityId: walkingEntity.id,
    entityType: walkingEntity.typeId,
    originalEntityType: originalEntityType,
    dimensionId: dimension.id,
    routePoints: routePoints,
    currentPointIndex: 0,
    playerId: player?.id,
    playerName: player?.name,
    startLocation: startLocation,
    startRotation: startRotation,
    variantIndex: variantIndex,
    poseIndex: poseIndex,
    statueId: statueId,
    platformLocation: platformLocation,
    routeId: routeId,
    linkedStageplate: linkedStageplate,
    animatronicId: animatronicId,
    pathfindingSessionId: null,
    state: "starting",
    visitedPoints: [],
    wasStatue: isStatueType(originalEntityType),
    currentStatueId: null,
    currentStatueType: null,
    currentStatueLocation: null,
    waitStartTime: 0,
    waitDuration: 0,
  };
  const routeTestId = `astar_route_${Date.now()}`;
  astarRouteTests.set(routeTestId, testSession);
  const firstPoint = routePoints[0];
  const sessionId = startPathfinding(walkingEntity, firstPoint.location, {
    pose: firstPoint.pose,
    variant: firstPoint.variant,
    rotation: normalizeCompassRotationToYaw(firstPoint.rotation),
    waitTime: (firstPoint.waitTime || 200) * 10,
    detectPlayers: options.detectPlayers ?? false,
    onArrival: (session, ent) => {
      handleRoutePointArrival(routeTestId, session, ent);
    },
    onFailed: (session) => {
      handleRoutePointFailed(routeTestId, session);
    },
  });
  testSession.pathfindingSessionId = sessionId;
  testSession.state = "moving";
  player?.sendMessage(
    `§a[A* Route Test] §7Starting with §e${routePoints.length}§7 points...`,
  );
  player?.sendMessage("§7The animatronic will find paths around obstacles.");
  player?.sendMessage("§7Press §eSNEAK + INTERACT§7 to cancel.");
  console.log(`[A* Route Test] Started: ${routeTestId}`);
  return routeTestId;
}
const astarRouteTests = new Map();
function handleRoutePointArrival(routeTestId, pathSession, entity) {
  console.log(
    `[A* Route Test] handleRoutePointArrival called for routeTestId: ${routeTestId}`,
  );
  const testSession = astarRouteTests.get(routeTestId);
  if (!testSession) {
    console.warn(
      `[A* Route Test] handleRoutePointArrival: testSession not found for ${routeTestId}`,
    );
    return;
  }
  console.log(
    `[A* Route Test] Current point index: ${testSession.currentPointIndex}, total points: ${testSession.routePoints.length}`,
  );
  if (!entity || !entity.isValid) {
    console.warn(
      `[A* Route Test] handleRoutePointArrival: Entity is invalid or null`,
    );
    notifyRouteTestPlayer(
      testSession,
      "§c[A* Route Test] §7Entity lost, test cancelled.",
    );
    astarRouteTests.delete(routeTestId);
    return;
  }
  testSession.visitedPoints.push(testSession.currentPointIndex);
  const currentPoint = testSession.routePoints[testSession.currentPointIndex];

  if (currentPoint.variant !== undefined && currentPoint.variant !== null && currentPoint.variant >= 0) {
    testSession.variantIndex = currentPoint.variant;
  }

  console.log(
    `[A* Route Test] Route point data:`,
    JSON.stringify(currentPoint),
  );
  notifyRouteTestPlayer(
    testSession,
    `§a[A* Route Test] §7Point §e${testSession.currentPointIndex + 1}§7/§e${testSession.routePoints.length}§7 reached - converting to statue`,
  );
  try {
    const dimension = world.getDimension(testSession.dimensionId);
    const currentLocation = entity.location;
    const statueType = getStatueTypeForAnimatronic(entity.typeId);
    const statue = dimension.spawnEntity(statueType, currentLocation);
    try {
      statue.addTag("fr_skip_place");
    } catch { }
    statue.setDynamicProperty("fr:variant_index", testSession.variantIndex);
    statue.setDynamicProperty("fr:pose_index", currentPoint.pose || 0);
    if (testSession.statueId) {
      statue.setDynamicProperty("fr:statue_id", testSession.statueId);
    }
    if (testSession.platformLocation) {
      statue.setDynamicProperty(
        "fr:platform_location",
        testSession.platformLocation,
      );
    }
    if (testSession.routeId !== null && testSession.routeId !== undefined) {
      statue.setDynamicProperty("fr:route_id", testSession.routeId);
    }
    if (testSession.linkedStageplate) {
      statue.setDynamicProperty(
        "fr:linked_stageplate",
        testSession.linkedStageplate,
      );
    }
    if (testSession.animatronicId) {
      statue.setDynamicProperty("fr:animatronic_id", testSession.animatronicId);
    }
    if (testSession.variantIndex > 0) {
      system.runTimeout(() => {
        try {
          statue.triggerEvent(`fr:set_variant_${testSession.variantIndex}`);
        } catch { }
      }, 2);
    }
    if (currentPoint.pose !== undefined && currentPoint.pose !== null) {
      system.runTimeout(() => {
        try {
          statue.triggerEvent(`fr:set_pose_${currentPoint.pose}`);
        } catch { }
      }, 3);
    }
    let rotDegrees = 0;
    if (currentPoint.rotation !== undefined && currentPoint.rotation !== null) {
      rotDegrees = normalizeYawRotation(currentPoint.rotation);
    }
    try {
      statue.teleport(currentLocation, {
        rotation: { x: 0, y: rotDegrees },
      });
      console.log(`[A* Route Test] Applied rotation ${rotDegrees}° to statue immediately`);
    } catch { }
    if (currentPoint.rotation !== undefined && currentPoint.rotation !== null) {
      system.runTimeout(() => {
        try {
          if (!statue || !statue.isValid) return;
          const pos = statue.location;
          statue.teleport(
            { x: pos.x, y: pos.y, z: pos.z },
            { rotation: { x: 0, y: rotDegrees } },
          );
        } catch { }
      }, 6);
    }
    testSession.currentStatueId = statue.id;
    testSession.currentStatueType = statueType;
    testSession.currentStatueLocation = { ...currentLocation };
    testSession.previousEntityId = testSession.entityId;
    testSession.entityId = statue.id;
    testSession.entityType = statueType;
    testSession.state = "waiting_as_statue";
    testSession.waitStartTime = Date.now();
    testSession.waitDuration = (currentPoint.waitTime || 100) * 10;
    entity.remove();
    console.log(
      `[A* Route Test] Converted to statue at point ${testSession.currentPointIndex + 1}, waiting ${testSession.waitDuration}ms`,
    );
    console.log(
      `[A* Route Test] Statue spawned with id: ${statue.id}, type: ${statueType}`,
    );
    console.log(
      `[A* Route Test] Updated entityId from ${testSession.previousEntityId} to ${statue.id}`,
    );
  } catch (e) {
    console.warn("[A* Route Test] Error converting to statue:", e);
    console.warn("[A* Route Test] Error details:", e.message || e.toString());
    testSession.currentPointIndex++;
    notifyRouteTestPlayer(
      testSession,
      `§c[A* Route Test] §7Failed to convert to statue at point ${testSession.currentPointIndex}, skipping...`,
    );
    if (testSession.currentPointIndex >= testSession.routePoints.length) {
      completeAStarRouteTest(routeTestId, entity);
    } else {
      proceedToNextRoutePoint(routeTestId, entity);
    }
  }
}
function processAStarRouteTestWaiting() {
  for (const [routeTestId, testSession] of astarRouteTests) {
    if (testSession.state === "waiting_as_statue") {
      const elapsed = Date.now() - testSession.waitStartTime;
      if (elapsed >= testSession.waitDuration) {
        convertStatueBackAndContinue(routeTestId);
      }
    }
  }
}
function convertStatueBackAndContinue(routeTestId) {
  const testSession = astarRouteTests.get(routeTestId);
  if (!testSession) return;
  testSession.currentPointIndex++;
  if (testSession.currentPointIndex >= testSession.routePoints.length) {
    completeRouteTestFromStatue(routeTestId);
    return;
  }
  console.log(
    `[A* Route Test] convertStatueBackAndContinue: Looking for statue id ${testSession.currentStatueId}`,
  );
  try {
    const dimension = world.getDimension(testSession.dimensionId);
    const statue = findEntity(
      testSession.currentStatueId,
      testSession.dimensionId,
    );
    if (!statue) {
      console.warn(
        `[A* Route Test] Statue not found with id: ${testSession.currentStatueId}`,
      );
      notifyRouteTestPlayer(
        testSession,
        "§c[A* Route Test] §7Statue not found, test cancelled.",
      );
      astarRouteTests.delete(routeTestId);
      return;
    }
    console.log(
      `[A* Route Test] Found statue at: ${statue.location.x}, ${statue.location.y}, ${statue.location.z}`,
    );
    const currentLocation = statue.location;
    const animatronicType = getAnimatronicTypeForStatue(
      testSession.currentStatueType,
    );
    const animatronic = dimension.spawnEntity(animatronicType, currentLocation);
    animatronic.setDynamicProperty(
      "fr:variant_index",
      testSession.variantIndex,
    );
    animatronic.setDynamicProperty("fr:pose_index", testSession.poseIndex || 0);
    animatronic.setDynamicProperty("fr:is_route_test", true);
    if (testSession.statueId) {
      animatronic.setDynamicProperty("fr:statue_id", testSession.statueId);
    }
    if (testSession.platformLocation) {
      animatronic.setDynamicProperty(
        "fr:platform_location",
        testSession.platformLocation,
      );
    }
    if (testSession.routeId !== null && testSession.routeId !== undefined) {
      animatronic.setDynamicProperty("fr:route_id", testSession.routeId);
    }
    if (testSession.linkedStageplate) {
      animatronic.setDynamicProperty(
        "fr:linked_stageplate",
        testSession.linkedStageplate,
      );
    }
    if (testSession.animatronicId) {
      animatronic.setDynamicProperty(
        "fr:animatronic_id",
        testSession.animatronicId,
      );
    }
    animatronic.addTag("fr:route_test_entity");
    console.log(
      `[A* Route Test] Copied properties to animatronic for next point:`,
    );
    console.log(`  - animatronic_id: ${testSession.animatronicId}`);
    console.log(`  - platform_location: ${testSession.platformLocation}`);
    if (testSession.variantIndex > 0) {
      system.runTimeout(() => {
        try {
          animatronic.triggerEvent(
            `fr:set_variant_${testSession.variantIndex}`,
          );
        } catch { }
      }, 2);
    }
    system.runTimeout(() => {
      try {
        animatronic.triggerEvent("fr:disable_ai_walk");
      } catch { }
    }, 3);
    statue.remove();
    testSession.previousEntityId = testSession.entityId;
    testSession.entityId = animatronic.id;
    testSession.entityType = animatronic.typeId;
    testSession.state = "moving";
    testSession.currentStatueId = null;
    console.log(
      `[A* Route Test] Updated entityId from ${testSession.previousEntityId} to ${animatronic.id}`,
    );
    notifyRouteTestPlayer(
      testSession,
      `§a[A* Route Test] §7Moving to point §e${testSession.currentPointIndex + 1}§7...`,
    );
    system.runTimeout(() => {
      proceedToNextRoutePoint(routeTestId, animatronic);
    }, 5);
    console.log(
      `[A* Route Test] Converted back to animatronic, heading to point ${testSession.currentPointIndex + 1}`,
    );
  } catch (e) {
    console.warn("[A* Route Test] Error converting back to animatronic:", e);
    console.warn("[A* Route Test] Error details:", e.message || e.toString());
    notifyRouteTestPlayer(
      testSession,
      `§c[A* Route Test] §7Error continuing test: ${e.message || e}`,
    );
    astarRouteTests.delete(routeTestId);
  }
}
function proceedToNextRoutePoint(routeTestId, entity) {
  const testSession = astarRouteTests.get(routeTestId);
  if (!testSession || !entity) return;
  const nextPoint = testSession.routePoints[testSession.currentPointIndex];
  const sessionId = startPathfinding(entity, nextPoint.location, {
    pose: nextPoint.pose,
    variant: nextPoint.variant,
    rotation: normalizeCompassRotationToYaw(nextPoint.rotation),
    waitTime: 0,
    detectPlayers: false,
    onArrival: (session, ent) => {
      handleRoutePointArrival(routeTestId, session, ent);
    },
    onFailed: (session) => {
      handleRoutePointFailed(routeTestId, session);
    },
  });
  testSession.pathfindingSessionId = sessionId;
}
function completeRouteTestFromStatue(routeTestId) {
  const testSession = astarRouteTests.get(routeTestId);
  if (!testSession) return;
  if (testSession.isReturningFromStatue) return;
  testSession.isReturningFromStatue = true;
  console.log(`[A* Route Test] Complete from statue: ${routeTestId}`);
  notifyRouteTestPlayer(
    testSession,
    `§a[A* Route Test] §7Complete! Visited §e${testSession.visitedPoints.length}§7/§e${testSession.routePoints.length}§7 points.`,
  );
  try {
    const dimension = world.getDimension(testSession.dimensionId);
    const currentStatue = findEntity(
      testSession.currentStatueId,
      testSession.dimensionId,
    );
    if (!currentStatue) {
      astarRouteTests.delete(routeTestId);
      return;
    }
    const statueLocation = { ...currentStatue.location };
    const animatronicType = getAnimatronicTypeFromStatue(
      testSession.originalEntityType,
    );
    if (!animatronicType) {
      console.warn(
        "[A* Route Test] Could not determine animatronic type, teleporting statue",
      );
      currentStatue.teleport(testSession.startLocation, {
        rotation: { x: 0, y: testSession.startRotation },
      });
      astarRouteTests.delete(routeTestId);
      return;
    }
    currentStatue.remove();
    const walkingAnimatronic = dimension.spawnEntity(
      animatronicType,
      statueLocation,
    );
    if (testSession.variantIndex > 0) {
      try {
        walkingAnimatronic.triggerEvent(
          `fr:set_variant_${testSession.variantIndex}`,
        );
      } catch { }
    }
    try {
      walkingAnimatronic.triggerEvent("fr:start_walking");
    } catch { }
    notifyRouteTestPlayer(
      testSession,
      `§a[A* Route Test] §7Walking back to platform...`,
    );
    testSession.returningEntityId = walkingAnimatronic.id;
    testSession.returningEntityType = animatronicType;
    const returnSessionId = startPathfinding(
      walkingAnimatronic,
      testSession.startLocation,
      {
        pose: 0,
        variant: testSession.variantIndex,
        rotation: testSession.startRotation,
        waitTime: 0,
        detectPlayers: false,
        onArrival: (session, ent) => {
          handleStatueReturnArrival(routeTestId, ent);
        },
        onFailed: (session) => {
          handleStatueReturnFailed(routeTestId);
        },
      },
    );
    if (!returnSessionId) {
      console.warn(
        "[A* Route Test] Could not start return pathfinding from statue, using teleport fallback",
      );
      finalizeStatueReturn(routeTestId, walkingAnimatronic);
    } else {
      testSession.returnPathfindingSessionId = returnSessionId;
    }
  } catch (e) {
    console.warn("[A* Route Test] Error completing from statue:", e);
    astarRouteTests.delete(routeTestId);
  }
}
function handleStatueReturnArrival(routeTestId, entity) {
  const testSession = astarRouteTests.get(routeTestId);
  if (!testSession) return;
  console.log(
    `[A* Route Test] Arrived back at start from statue: ${routeTestId}`,
  );
  try {
    entity.triggerEvent("fr:stop_walking");
  } catch { }
  notifyRouteTestPlayer(
    testSession,
    `§a[A* Route Test] §7Arrived at platform.`,
  );
  finalizeStatueReturn(routeTestId, entity);
}
function handleStatueReturnFailed(routeTestId) {
  const testSession = astarRouteTests.get(routeTestId);
  if (!testSession) return;
  console.warn(
    `[A* Route Test] Failed to walk back from statue: ${routeTestId}`,
  );
  notifyRouteTestPlayer(
    testSession,
    `§c[A* Route Test] §7Could not walk back, teleporting...`,
  );
  const entity = findEntity(
    testSession.returningEntityId,
    testSession.dimensionId,
  );
  finalizeStatueReturn(routeTestId, entity);
}
function finalizeStatueReturn(routeTestId, walkingEntity) {
  const testSession = astarRouteTests.get(routeTestId);
  if (!testSession) return;
  try {
    const dimension = world.getDimension(testSession.dimensionId);
    if (walkingEntity) {
      try {
        walkingEntity.teleport(testSession.startLocation, {
          rotation: { x: 0, y: testSession.startRotation },
        });
      } catch { }
    }
    system.runTimeout(() => {
      try {
        const statueType = testSession.originalEntityType;
        const newStatue = dimension.spawnEntity(
          statueType,
          testSession.startLocation,
        );
        newStatue.setDynamicProperty(
          "fr:variant_index",
          testSession.variantIndex,
        );
        newStatue.setDynamicProperty(
          "fr:pose_index",
          testSession.poseIndex || 0,
        );
        if (testSession.statueId) {
          newStatue.setDynamicProperty("fr:statue_id", testSession.statueId);
        }
        if (testSession.platformLocation) {
          newStatue.setDynamicProperty(
            "fr:platform_location",
            testSession.platformLocation,
          );
        }
        if (testSession.routeId !== null && testSession.routeId !== undefined) {
          newStatue.setDynamicProperty("fr:route_id", testSession.routeId);
        }
        if (testSession.linkedStageplate) {
          newStatue.setDynamicProperty(
            "fr:linked_stageplate",
            testSession.linkedStageplate,
          );
        }
        if (testSession.animatronicId) {
          newStatue.setDynamicProperty(
            "fr:animatronic_id",
            testSession.animatronicId,
          );
        }
        if (testSession.variantIndex > 0) {
          try {
            newStatue.triggerEvent(
              `fr:set_variant_${testSession.variantIndex}`,
            );
          } catch { }
        }
        if (testSession.poseIndex > 0) {
          try {
            newStatue.triggerEvent(`fr:set_pose_${testSession.poseIndex}`);
          } catch { }
        }
        try {
          newStatue.teleport(testSession.startLocation, {
            rotation: { x: 0, y: testSession.startRotation },
          });
        } catch { }
        if (walkingEntity) {
          walkingEntity.remove();
        }
        notifyRouteTestPlayer(
          testSession,
          `§a[A* Route Test] §7Converted back to statue at platform.`,
        );
      } catch (e) {
        console.warn("[A* Route Test] Error converting back to statue:", e);
      }
      astarRouteTests.delete(routeTestId);
    }, 5);
  } catch (e) {
    console.warn("[A* Route Test] Error finalizing statue return:", e);
    astarRouteTests.delete(routeTestId);
  }
}
function getAnimatronicTypeFromStatue(statueType) {
  const statueToAnimatronic = {
    "fr:bonnie_statue": "fr:fnaf1_bonnie_entity",
    "fr:chica_statue": "fr:fnaf1_chica_entity",
    "fr:foxy_statue": "fr:fnaf1_foxy_entity",
    "fr:freddy_fazbear_statue": "fr:fnaf1_freddy_entity",
  };
  return statueToAnimatronic[statueType] || null;
}
function handleRoutePointFailed(routeTestId, pathSession) {
  const testSession = astarRouteTests.get(routeTestId);
  if (!testSession) return;
  notifyRouteTestPlayer(
    testSession,
    `§c[A* Route Test] §7Could not reach point §e${testSession.currentPointIndex + 1}§7, skipping...`,
  );
  testSession.currentPointIndex++;
  if (testSession.currentPointIndex >= testSession.routePoints.length) {
    completeAStarRouteTest(routeTestId, null);
  } else {
    const entity = findEntity(testSession.entityId, testSession.dimensionId);
    if (entity) {
      const nextPoint = testSession.routePoints[testSession.currentPointIndex];
      const sessionId = startPathfinding(entity, nextPoint.location, {
        pose: nextPoint.pose,
        variant: nextPoint.variant,
        rotation: normalizeCompassRotationToYaw(nextPoint.rotation),
        waitTime: (nextPoint.waitTime || 200) * 50,
        detectPlayers: true,
        onArrival: (session, ent) => {
          handleRoutePointArrival(routeTestId, session, ent);
        },
        onFailed: (session) => {
          handleRoutePointFailed(routeTestId, session);
        },
      });
      testSession.pathfindingSessionId = sessionId;
    }
  }
}
function completeAStarRouteTest(routeTestId, entity) {
  const testSession = astarRouteTests.get(routeTestId);
  if (!testSession) return;
  console.log(`[A* Route Test] Complete: ${routeTestId}`);
  notifyRouteTestPlayer(
    testSession,
    `§a[A* Route Test] §7Complete! Visited §e${testSession.visitedPoints.length}§7/§e${testSession.routePoints.length}§7 points.`,
  );
  if (testSession.isReturning) return;
  testSession.isReturning = true;
  if (!entity) {
    astarRouteTests.delete(routeTestId);
    return;
  }
  notifyRouteTestPlayer(
    testSession,
    `§a[A* Route Test] §7Walking back to platform...`,
  );
  try {
    entity.triggerEvent("fr:start_walking");
  } catch { }
  const returnSessionId = startPathfinding(entity, testSession.startLocation, {
    pose: 0,
    variant: testSession.variantIndex,
    rotation: testSession.startRotation,
    waitTime: 0,
    detectPlayers: false,
    onArrival: (session, ent) => {
      handleReturnToStartArrival(routeTestId, ent);
    },
    onFailed: (session) => {
      handleReturnToStartFailed(routeTestId);
    },
  });
  if (!returnSessionId) {
    console.warn(
      "[A* Route Test] Could not start return pathfinding, using teleport fallback",
    );
    finalizeRouteTestCompletion(routeTestId, entity);
  } else {
    testSession.returnPathfindingSessionId = returnSessionId;
  }
}
function handleReturnToStartArrival(routeTestId, entity) {
  const testSession = astarRouteTests.get(routeTestId);
  if (!testSession) return;
  console.log(`[A* Route Test] Arrived back at start: ${routeTestId}`);
  try {
    entity.triggerEvent("fr:stop_walking");
  } catch { }
  notifyRouteTestPlayer(
    testSession,
    `§a[A* Route Test] §7Arrived at platform.`,
  );
  finalizeRouteTestCompletion(routeTestId, entity);
}
function handleReturnToStartFailed(routeTestId) {
  const testSession = astarRouteTests.get(routeTestId);
  if (!testSession) return;
  console.warn(`[A* Route Test] Failed to walk back to start: ${routeTestId}`);
  notifyRouteTestPlayer(
    testSession,
    `§c[A* Route Test] §7Could not walk back, teleporting...`,
  );
  const entity = findEntity(testSession.entityId, testSession.dimensionId);
  finalizeRouteTestCompletion(routeTestId, entity);
}
function finalizeRouteTestCompletion(routeTestId, entity) {
  const testSession = astarRouteTests.get(routeTestId);
  if (!testSession) return;
  try {
    const dimension = world.getDimension(testSession.dimensionId);
    if (testSession.wasStatue && entity) {
      try {
        entity.teleport(testSession.startLocation, {
          rotation: { x: 0, y: testSession.startRotation },
        });
      } catch { }
      system.runTimeout(() => {
        try {
          const statueType = testSession.originalEntityType;
          const statue = dimension.spawnEntity(
            statueType,
            testSession.startLocation,
          );
          statue.setDynamicProperty(
            "fr:variant_index",
            testSession.variantIndex,
          );
          statue.setDynamicProperty(
            "fr:pose_index",
            testSession.poseIndex || 0,
          );
          if (testSession.statueId) {
            statue.setDynamicProperty("fr:statue_id", testSession.statueId);
          }
          if (testSession.platformLocation) {
            statue.setDynamicProperty(
              "fr:platform_location",
              testSession.platformLocation,
            );
          }
          if (
            testSession.routeId !== null &&
            testSession.routeId !== undefined
          ) {
            statue.setDynamicProperty("fr:route_id", testSession.routeId);
          }
          if (testSession.linkedStageplate) {
            statue.setDynamicProperty(
              "fr:linked_stageplate",
              testSession.linkedStageplate,
            );
          }
          if (testSession.animatronicId) {
            statue.setDynamicProperty(
              "fr:animatronic_id",
              testSession.animatronicId,
            );
          }
          if (testSession.variantIndex > 0) {
            try {
              statue.triggerEvent(`fr:set_variant_${testSession.variantIndex}`);
            } catch { }
          }
          if (testSession.poseIndex > 0) {
            try {
              statue.triggerEvent(`fr:set_pose_${testSession.poseIndex}`);
            } catch { }
          }
          try {
            statue.teleport(testSession.startLocation, {
              rotation: { x: 0, y: testSession.startRotation },
            });
          } catch { }
          entity.remove();
          notifyRouteTestPlayer(
            testSession,
            `§a[A* Route Test] §7Converted back to statue at platform.`,
          );
        } catch (e) {
          console.warn("[A* Route Test] Error converting to statue:", e);
        }
        astarRouteTests.delete(routeTestId);
      }, 5);
    } else if (entity) {
      try {
        entity.teleport(testSession.startLocation, {
          rotation: { x: 0, y: testSession.startRotation },
        });
        entity.triggerEvent("fr:set_pose_0");
      } catch { }
      notifyRouteTestPlayer(
        testSession,
        `§a[A* Route Test] §7Returned to start position.`,
      );
      astarRouteTests.delete(routeTestId);
    } else {
      astarRouteTests.delete(routeTestId);
    }
  } catch (e) {
    console.warn("[A* Route Test] Error completing test:", e);
    astarRouteTests.delete(routeTestId);
  }
}
export function cancelAStarRouteTest(routeTestId) {
  const testSession = astarRouteTests.get(routeTestId);
  if (!testSession) return false;
  if (testSession.pathfindingSessionId) {
    stopPathfinding(testSession.pathfindingSessionId);
  }
  try {
    const dimension = world.getDimension(testSession.dimensionId);
    const entity = findEntity(testSession.entityId, testSession.dimensionId);
    if (testSession.wasStatue) {
      const statueType = testSession.originalEntityType;
      const statue = dimension.spawnEntity(
        statueType,
        testSession.startLocation,
      );
      statue.setDynamicProperty("fr:variant_index", testSession.variantIndex);
      if (testSession.variantIndex > 0) {
        try {
          statue.triggerEvent(`fr:set_variant_${testSession.variantIndex}`);
        } catch { }
      }
      try {
        statue.teleport(testSession.startLocation, {
          rotation: { x: 0, y: testSession.startRotation },
        });
      } catch { }
      if (entity) {
        entity.remove();
      }
    } else if (entity) {
      entity.teleport(testSession.startLocation, {
        rotation: { x: 0, y: testSession.startRotation },
      });
      entity.triggerEvent("fr:set_pose_0");
    }
  } catch (e) {
    console.warn("[A* Route Test] Error cancelling test:", e);
  }
  notifyRouteTestPlayer(testSession, `§c[A* Route Test] §7Test cancelled.`);
  astarRouteTests.delete(routeTestId);
  return true;
}
function notifyRouteTestPlayer(testSession, message) {
  try {
    for (const player of world.getAllPlayers()) {
      if (
        player.id === testSession.playerId ||
        player.name === testSession.playerName
      ) {
        player.sendMessage(message);
        return;
      }
    }
  } catch { }
}
export function getActiveAStarRouteTests() {
  return astarRouteTests;
}
export function initAStarPathfinding() {

  initDynamicPathfinding();

  system.runInterval(() => {
    processAStarRouteTestWaiting();
  }, 10);
  system.runInterval(() => {
    visualizeActivePathsWithParticles();
  }, 10);
  console.log(
    "[A* Pathfinding] System initialized with dynamic pathfinding support",
  );
}
function visualizeActivePathsWithParticles() {
  if (!PATHFINDING_CONFIG.SHOW_PATH_PARTICLES) return;
  for (const [sessionId, session] of pathfindingSessions) {
    if (
      session.state !== "moving" ||
      !session.path ||
      session.path.length === 0
    ) {
      continue;
    }
    try {
      const dimension = world.getDimension(session.dimensionId);
      const particleType = PATHFINDING_CONFIG.PARTICLE_TYPE;
      if (session.pathIndex < session.path.length) {
        const currentTarget = session.path[session.pathIndex];
        dimension.spawnParticle("minecraft:heart_particle", {
          x: currentTarget.x,
          y: currentTarget.y + 1.2,
          z: currentTarget.z,
        });
      }
      for (let i = session.pathIndex; i < session.path.length; i++) {
        const point = session.path[i];
        dimension.spawnParticle(particleType, {
          x: point.x,
          y: point.y + 0.5,
          z: point.z,
        });
        if (i < session.path.length - 1) {
          const nextPoint = session.path[i + 1];
          drawPathLineParticles(dimension, point, nextPoint, particleType);
        }
      }
      if (session.path.length > 0) {
        const goal = session.path[session.path.length - 1];
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
          dimension.spawnParticle("minecraft:villager_happy", {
            x: goal.x + Math.cos(angle) * 0.4,
            y: goal.y + 0.8,
            z: goal.z + Math.sin(angle) * 0.4,
          });
        }
      }
    } catch (e) {
    }
  }
}
function drawPathLineParticles(dimension, from, to, particleType) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (distance < 0.3) return;
  const spacing = PATHFINDING_CONFIG.PARTICLE_SPACING || 0.5;
  const numParticles = Math.ceil(distance / spacing);
  for (let j = 1; j < numParticles; j++) {
    const t = j / numParticles;
    try {
      dimension.spawnParticle(particleType, {
        x: from.x + dx * t,
        y: from.y + dy * t + 0.3,
        z: from.z + dz * t,
      });
    } catch { }
  }
}
export function startDynamicEntityPathfinding(entity, goalPos, options = {}) {
  if (!entity || !goalPos) {
    console.warn("[A* Dynamic] Invalid entity or goal position");
    return null;
  }
  return startDynamicPathfinding(entity, goalPos, {
    ...options,
    showParticles:
      options.showParticles ?? PATHFINDING_CONFIG.SHOW_PATH_PARTICLES,
    onArrival: options.onArrival,
    onFailed: options.onFailed,
    onPathUpdate: (session, index) => {
      console.log(
        `[A* Dynamic] Path updated, now at waypoint ${index + 1}/${session.path?.length}`,
      );
    },
  });
}
export function stopDynamicEntityPathfinding(sessionId) {
  return stopDynamicPathfinding(sessionId);
}
export function hasEntityDynamicPathfinding(entityId) {
  return hasActiveDynamicPathfinding(entityId);
}
export function findDynamicAStarPath(dimension, start, goal, options = {}) {
  return findDynamicPath(dimension, start, goal, options, (exploredNodes) => {
    if (options.showExploration && exploredNodes.length > 0) {
      try {
        const lastNode = exploredNodes[exploredNodes.length - 1];
        dimension.spawnParticle("minecraft:critical_hit_emitter", {
          x: lastNode.x,
          y: lastNode.y,
          z: lastNode.z,
        });
      } catch { }
    }
  });
}
export {
  startDynamicPathfinding,
  stopDynamicPathfinding,
  getDynamicPathfindingSession,
  hasActiveDynamicPathfinding,
};
