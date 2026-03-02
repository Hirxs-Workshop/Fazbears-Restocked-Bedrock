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
import { broadcastDebug, isCreativeMode, distance3D as getDistance3D } from "../utils.js";

export const DYNAMIC_PATHFINDING_CONFIG = {
  MAX_ITERATIONS: 1000,
  MAX_PATH_LENGTH: 80,
  ENTITY_HEIGHT: 2,
  MOVE_SPEED: 0.14,
  MOVE_INTERVAL_TICKS: 2,
  ARRIVAL_THRESHOLD: 0.6,
  RECALC_INTERVAL_TICKS: 60,
  RECALC_EVERY_BLOCKS: 12,
  STUCK_THRESHOLD: 40,
  LOOKAHEAD_DISTANCE: 5,
  WALL_AVOIDANCE_COST: 0.3,
  DIRECTION_CHANGE_PENALTY: 0.8,
  STRAIGHT_LINE_BONUS: 0.2,
  PARTICLE_ENABLED: false,
  showPointParticles: false,
  PARTICLE_INTERVAL_TICKS: 10,
  PARTICLE_PATH: "minecraft:villager_happy",
  PARTICLE_TARGET: "minecraft:heart_particle",
  PARTICLE_BLOCKED: "minecraft:villager_angry",

  USE_APPLY_IMPULSE: true,
  HORIZONTAL_IMPULSE: 0.08,
  JUMP_IMPULSE: 0.42,
  JUMP_FORWARD_BOOST: 0.1,
  MAX_HORIZONTAL_SPEED: 0.2,
  JUMP_COOLDOWN_TICKS: 5,

  PLAYER_DETECTION_RANGE: 15,
  PLAYER_CHASE_RANGE: 25,
  CHASE_SPEED_MULTIPLIER: 1.5,
  DETECTION_INTERVAL_TICKS: 20,
};
const PASSABLE_BLOCKS = new Set([
  "minecraft:air",
  "minecraft:cave_air",
  "minecraft:void_air",
  "minecraft:light_block",
  "minecraft:structure_void",
  "fr:stage_platform",
  "fr:route_point",
]);
const NON_SOLID_PATTERNS = [

  "air",

  "door",
  "gate",
  "sign",
  "banner",
  "torch",
  "button",
  "lever",
  "pressure_plate",
  "rail",
  "redstone_wire",
  "flower",
  "sapling",
  "fern",
  "tall_grass",
  "dead_bush",
  "vine",
  "ladder",
  "snow_layer",
  "trash",
  "paper"
];

const FR_SOLID_PATTERNS = [
  "chair",
  "table",
  "arcade",
  "stool",
  "machine",
  "desk",
  "cabinet",
  "counter",
  "shelf",
  "lamp",
  "phone",
  "poster",
  "sofa",
  "couch",
];
const DEBUG_PATHFINDING = true;
const LOG_NEIGHBOR_CHECKS = false;
const LOG_BLOCK_CHECKS = false;
let isCalculatingPath = false;

const ITERATIONS_PER_TICK = 15;
const pendingPathRequests = new Map();
let nextPathRequestId = 1;

class AsyncPathRequest {
  constructor(dimension, start, goal, options, callback) {
    this.id = nextPathRequestId++;
    this.dimension = dimension;
    this.validStart = null;
    this.validGoal = null;
    this.start = start;
    this.goal = goal;
    this.options = options;
    this.callback = callback;
    this.height = options.height ?? DYNAMIC_PATHFINDING_CONFIG.ENTITY_HEIGHT;

this.frontier = new PriorityQueue();
    this.cameFrom = new Map();
    this.costSoFar = new Map();
    this.iterations = 0;
    this.maxIterations = options.maxIterations ?? 3000;
    this.state = 'init';
    this.bestKey = null;
    this.bestDist = Infinity;
    this.horizontalOnly = options.horizontalOnly ?? false;
  }
}

export function requestPathAsync(dimension, start, goal, options, callback) {
  const request = new AsyncPathRequest(dimension, start, goal, options, callback);
  pendingPathRequests.set(request.id, request);
  return request.id;
}

export function cancelPathRequest(requestId) {
  pendingPathRequests.delete(requestId);
}

export function processAsyncPathRequests() {
  let budgetRemaining = ITERATIONS_PER_TICK;

  for (const [id, request] of pendingPathRequests) {
    if (budgetRemaining <= 0) break;

    const iterationsUsed = processPathRequestChunk(request, budgetRemaining);
    budgetRemaining -= iterationsUsed;

    if (request.state === 'complete' || request.state === 'failed') {
      pendingPathRequests.delete(id);
      if (request.callback) {
        request.callback(request.result);
      }
    }
  }
}

function processPathRequestChunk(request, budget) {
  let used = 0;

if (request.state === 'init') {
    request.validStart = findValidStart(
      request.dimension, request.start.x, request.start.y, request.start.z, request.height
    );
    request.validGoal = findValidStart(
      request.dimension, request.goal.x, request.goal.y, request.goal.z, request.height, 5
    );

    if (!request.validStart || !request.validGoal) {
      request.state = 'failed';
      request.result = null;
      return 10;
    }

    const startKey = posKey(request.validStart.x, request.validStart.y, request.validStart.z);
    const goalKey = posKey(request.validGoal.x, request.validGoal.y, request.validGoal.z);

    if (startKey === goalKey) {
      request.state = 'complete';
      request.result = [{ x: request.validGoal.x + 0.5, y: request.validGoal.y, z: request.validGoal.z + 0.5 }];
      return 5;
    }

    request.startKey = startKey;
    request.goalKey = goalKey;
    request.frontier.put(startKey, 0);
    request.cameFrom.set(startKey, { parent: null, dir: null });
    request.costSoFar.set(startKey, 0);
    request.bestKey = startKey;
    request.state = 'processing';
    return 20;
  }

while (!request.frontier.empty() && used < budget && request.iterations < request.maxIterations) {
    request.iterations++;
    used++;

    const currentKey = request.frontier.get();

    if (currentKey === request.goalKey) {

      request.result = reconstructPath(request.cameFrom, request.goalKey);
      request.state = 'complete';
      return used;
    }

    const [cx, cy, cz] = currentKey.split(",").map(Number);

const distToGoal = Math.sqrt(
      (cx - request.validGoal.x) ** 2 + (cy - request.validGoal.y) ** 2 + (cz - request.validGoal.z) ** 2
    );
    if (distToGoal < request.bestDist) {
      request.bestDist = distToGoal;
      request.bestKey = currentKey;
    }

    const currentData = request.cameFrom.get(currentKey);
    const prevDir = currentData?.dir;
    const neighbors = getNeighbors(request.dimension, cx, cy, cz, request.height, request.horizontalOnly);

    for (const next of neighbors) {
      const nextKey = posKey(next.x, next.y, next.z);
      const newDir = { dx: next.x - cx, dz: next.z - cz };
      const directionCost = getDirectionChangeCost(prevDir, newDir.dx, newDir.dz);
      const newCost = request.costSoFar.get(currentKey) + next.cost + directionCost;

      if (!request.costSoFar.has(nextKey) || newCost < request.costSoFar.get(nextKey)) {
        request.costSoFar.set(nextKey, newCost);
        const priority = newCost + heuristic(
          next.x, next.y, next.z,
          request.validGoal.x, request.validGoal.y, request.validGoal.z
        );
        request.frontier.put(nextKey, priority);
        request.cameFrom.set(nextKey, { parent: currentKey, dir: newDir });
      }
    }
  }

if (request.frontier.empty() || request.iterations >= request.maxIterations) {

    if (request.bestKey !== request.startKey) {
      request.result = reconstructPath(request.cameFrom, request.bestKey);

    } else {
      request.result = null;
    }
    request.state = request.result ? 'complete' : 'failed';
  }

  return used;
}

function reconstructPath(cameFrom, targetKey) {
  const path = [];
  let current = targetKey;
  while (current !== null) {
    const [px, py, pz] = current.split(",").map(Number);
    path.unshift({ x: px + 0.5, y: py, z: pz + 0.5 });
    const data = cameFrom.get(current);
    current = data?.parent ?? null;
  }
  return path;
}

function debugLog(...args) {
  if (DEBUG_PATHFINDING) {
    const details = args.map(a => {
      if (Array.isArray(a) && a.length > 3) return `[Array(${a.length})]`;
      return typeof a === 'object' ? JSON.stringify(a) : a;
    }).join(' ');
    broadcastDebug(`${details}`, "§a[Pathfinding]");
  }
}
class PriorityQueue {
  constructor() {
    this.elements = [];
  }
  empty() {
    return this.elements.length === 0;
  }
  put(item, priority) {
    this.elements.push({ item, priority });
    this._bubbleUp(this.elements.length - 1);
  }
  get() {
    if (this.empty()) return null;
    const result = this.elements[0].item;
    const last = this.elements.pop();
    if (this.elements.length > 0) {
      this.elements[0] = last;
      this._bubbleDown(0);
    }
    return result;
  }
  _bubbleUp(idx) {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.elements[parentIdx].priority <= this.elements[idx].priority)
        break;
      [this.elements[parentIdx], this.elements[idx]] = [
        this.elements[idx],
        this.elements[parentIdx],
      ];
      idx = parentIdx;
    }
  }
  _bubbleDown(idx) {
    const length = this.elements.length;
    while (true) {
      const leftIdx = 2 * idx + 1;
      const rightIdx = 2 * idx + 2;
      let smallest = idx;
      if (
        leftIdx < length &&
        this.elements[leftIdx].priority < this.elements[smallest].priority
      ) {
        smallest = leftIdx;
      }
      if (
        rightIdx < length &&
        this.elements[rightIdx].priority < this.elements[smallest].priority
      ) {
        smallest = rightIdx;
      }
      if (smallest === idx) break;
      [this.elements[smallest], this.elements[idx]] = [
        this.elements[idx],
        this.elements[smallest],
      ];
      idx = smallest;
    }
  }
}

function posKey(x, y, z) {
  return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

function heuristic(ax, ay, az, bx, by, bz) {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  const dz = Math.abs(az - bz);
  const maxHoriz = Math.max(dx, dz);
  const minHoriz = Math.min(dx, dz);
  const F = Math.SQRT2 - 1;
  return maxHoriz + F * minHoriz + dy * 1.5;
}

function getBlock(dimension, x, y, z) {
  try {
    return dimension.getBlock({
      x: Math.floor(x),
      y: Math.floor(y),
      z: Math.floor(z),
    });
  } catch {
    return null;
  }
}
function isPassable(dimension, x, y, z) {
  const block = getBlock(dimension, x, y, z);
  if (!block) {
    debugLog(`Block at (${x},${y},${z}) is null - treating as NOT passable`);
    return false;
  }
  const typeId = block.typeId;

for (const pattern of FR_SOLID_PATTERNS) {
    if (typeId.includes(pattern)) {
      if (LOG_BLOCK_CHECKS && isCalculatingPath) {
        console.log(`[BLOCK-CHECK] isPassable FALSE (FR solid): "${typeId}" at (${x},${y},${z})`);
      }
      return false;
    }
  }

  if (typeId.includes("air")) return true;
  if (PASSABLE_BLOCKS.has(typeId)) return true;
  for (const pattern of NON_SOLID_PATTERNS) {
    if (typeId.includes(pattern)) return true;
  }

if (typeId.includes("carpet")) {
    return false;
  }

  if (LOG_BLOCK_CHECKS && isCalculatingPath) {
    console.log(
      `[BLOCK-CHECK] isPassable FALSE: "${typeId}" at (${x},${y},${z})`,
    );
  }
  return false;
}
function isSolid(dimension, x, y, z) {
  const block = getBlock(dimension, x, y, z);
  if (!block) {
    if (LOG_BLOCK_CHECKS && isCalculatingPath) {
      console.log(
        `[BLOCK-CHECK] isSolid TRUE (null block) at (${x},${y},${z})`,
      );
    }
    return true;
  }
  const typeId = block.typeId;
  if (typeId.includes("air")) return false;
  if (PASSABLE_BLOCKS.has(typeId)) return false;
  for (const pattern of NON_SOLID_PATTERNS) {
    if (typeId.includes(pattern)) return false;
  }

if (typeId.includes("carpet")) {
    return true;
  }

  if (LOG_BLOCK_CHECKS && isCalculatingPath) {
    console.log(`[BLOCK-CHECK] isSolid TRUE: "${typeId}" at (${x},${y},${z})`);
  }
  return true;
}

function canStandOn(dimension, x, y, z) {
  const block = getBlock(dimension, x, y, z);
  if (!block) return true;

  const typeId = block.typeId;
  if (typeId.includes("air")) return false;
  if (PASSABLE_BLOCKS.has(typeId)) return false;

const standablePatterns = ["stairs", "slab", "fence", "wall", "path"];
  for (const pattern of standablePatterns) {
    if (typeId.includes(pattern)) return true;
  }

return isSolid(dimension, x, y, z);
}
function isWalkable(dimension, x, y, z, height = 2) {
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const fz = Math.floor(z);

const groundStandable = canStandOn(dimension, fx, fy - 1, fz);
  if (!groundStandable) {
    if (LOG_BLOCK_CHECKS) debugLog(
      `Ground at (${fx},${fy - 1},${fz}) is not standable`,
    );
    return false;
  }

for (let h = 0; h < height; h++) {
    const bodyBlock = getBlock(dimension, fx, fy + h, fz);
    if (!bodyBlock) {
      if (LOG_BLOCK_CHECKS) debugLog(`No block at body position (${fx},${fy + h},${fz})`);
      return false;
    }

    const bodyPassable = isPassable(dimension, fx, fy + h, fz);
    if (!bodyPassable) {
      if (LOG_BLOCK_CHECKS) debugLog(
        `Body blocked at (${fx},${fy + h},${fz}) by "${bodyBlock.typeId}"`,
      );
      return false;
    }
  }

const ceilingBlock = getBlock(dimension, fx, fy + height, fz);
  if (ceilingBlock) {
    const ceilingSolid = isSolid(dimension, fx, fy + height, fz);
    if (ceilingSolid) {

let actualClearance = 0;
      for (let h = 0; h < height + 2; h++) {
        if (isPassable(dimension, fx, fy + h, fz)) {
          actualClearance++;
        } else {
          break;
        }
      }

if (actualClearance < height) {
        if (LOG_BLOCK_CHECKS) debugLog(
          `Insufficient clearance at (${fx},${fy},${fz}): only ${actualClearance} blocks, need ${height}`,
        );
        return false;
      }
    }
  }

  if (LOG_BLOCK_CHECKS) debugLog(`Position (${fx},${fy},${fz}) IS walkable`);
  return true;
}
function canMoveBetween(
  dimension,
  fromX,
  fromY,
  fromZ,
  toX,
  toY,
  toZ,
  height = 2,
) {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const dy = toY - fromY;

for (let h = 0; h < height; h++) {
    if (!isPassable(dimension, toX, toY + h, toZ)) {
      if (LOG_BLOCK_CHECKS) debugLog(`canMoveBetween: destination blocked at height ${h}`);
      return false;
    }
  }

const ceilingAtDest = getBlock(dimension, toX, toY + height, toZ);
  if (ceilingAtDest && isSolid(dimension, toX, toY + height, toZ)) {

let clearHeight = 0;
    for (let h = 0; h < height + 1; h++) {
      if (isPassable(dimension, toX, toY + h, toZ)) {
        clearHeight++;
      } else {
        break;
      }
    }

    if (clearHeight < height) {
      if (LOG_BLOCK_CHECKS) debugLog(`canMoveBetween: insufficient vertical clearance at destination (${clearHeight} < ${height})`);
      return false;
    }
  }

if (dx !== 0 && dz !== 0) {

    for (let h = 0; h < height; h++) {
      if (!isPassable(dimension, fromX + dx, fromY + h, fromZ)) {
        if (LOG_BLOCK_CHECKS) debugLog(
          `canMoveBetween: X-adjacent wall at (${fromX + dx},${fromY + h},${fromZ})`,
        );
        return false;
      }
      if (!isPassable(dimension, fromX, fromY + h, fromZ + dz)) {
        if (LOG_BLOCK_CHECKS) debugLog(
          `canMoveBetween: Z-adjacent wall at (${fromX},${fromY + h},${fromZ + dz})`,
        );
        return false;
      }
    }

const midX = fromX + dx * 0.5;
    const midZ = fromZ + dz * 0.5;
    for (let h = 0; h < height; h++) {
      if (isSolid(dimension, Math.floor(midX), fromY + h, Math.floor(fromZ))) {
        if (LOG_BLOCK_CHECKS) debugLog(`canMoveBetween: diagonal clips solid at midpoint`);
        return false;
      }
      if (isSolid(dimension, Math.floor(fromX), fromY + h, Math.floor(midZ))) {
        if (LOG_BLOCK_CHECKS) debugLog(`canMoveBetween: diagonal clips solid at midpoint`);
        return false;
      }
    }
  }

if ((dx !== 0 && dz === 0) || (dx === 0 && dz !== 0)) {
    for (let h = 0; h < height; h++) {
      if (isSolid(dimension, toX, toY + h, toZ)) {
        if (LOG_BLOCK_CHECKS) debugLog(
          `canMoveBetween: cardinal blocked by solid at (${toX},${toY + h},${toZ})`,
        );
        return false;
      }
    }
  }

if (dy > 0) {

    if (dy > 1) {
      if (LOG_BLOCK_CHECKS) debugLog(`canMoveBetween: step up too high (${dy} > 1)`);
      return false;
    }

for (let h = 0; h < height; h++) {
      if (!isPassable(dimension, fromX, fromY + height + h, fromZ)) {
        if (LOG_BLOCK_CHECKS) debugLog(`canMoveBetween: no headroom for step up`);
        return false;
      }

      if (!isPassable(dimension, toX, toY + h, toZ)) {
        if (LOG_BLOCK_CHECKS) debugLog(`canMoveBetween: no headroom at step up destination`);
        return false;
      }
    }

if (!isSolid(dimension, toX, toY - 1, toZ)) {
      if (LOG_BLOCK_CHECKS) debugLog(`canMoveBetween: no ground at step up destination`);
      return false;
    }
  }

if (dy < 0) {

    if (dy < -3) {
      if (LOG_BLOCK_CHECKS) debugLog(`canMoveBetween: step down too deep (${dy} < -3)`);
      return false;
    }

    if (!isSolid(dimension, toX, toY - 1, toZ)) {
      if (LOG_BLOCK_CHECKS) debugLog(`canMoveBetween: no ground at step down destination`);
      return false;
    }
  }

  return true;
}
function getWallProximityCost(dimension, x, y, z, height = 2) {
  let wallCount = 0;
  const checkDirs = [
    { dx: 1, dz: 0 },
    { dx: -1, dz: 0 },
    { dx: 0, dz: 1 },
    { dx: 0, dz: -1 },
  ];
  for (const dir of checkDirs) {
    for (let h = 0; h < height; h++) {
      if (!isPassable(dimension, x + dir.dx, y + h, z + dir.dz)) {
        wallCount++;
        break;
      }
    }
  }
  return wallCount * DYNAMIC_PATHFINDING_CONFIG.WALL_AVOIDANCE_COST;
}

function getNeighbors(dimension, x, y, z, height = 2, horizontalOnly = false) {
  const neighbors = [];

const s0 = isWalkable(dimension, x, y, z - 1, height);
  const s1 = isWalkable(dimension, x + 1, y, z, height);
  const s2 = isWalkable(dimension, x, y, z + 1, height);
  const s3 = isWalkable(dimension, x - 1, y, z, height);

if (s0) neighbors.push({ x: x, y: y, z: z - 1, cost: 1.0 });
  if (s1) neighbors.push({ x: x + 1, y: y, z: z, cost: 1.0 });
  if (s2) neighbors.push({ x: x, y: y, z: z + 1, cost: 1.0 });
  if (s3) neighbors.push({ x: x - 1, y: y, z: z, cost: 1.0 });

const d0 = s3 && s0;
  const d1 = s0 && s1;
  const d2 = s1 && s2;
  const d3 = s2 && s3;

if (d0 && isWalkable(dimension, x - 1, y, z - 1, height)) {
    neighbors.push({ x: x - 1, y: y, z: z - 1, cost: 1.414 });
  }
  if (d1 && isWalkable(dimension, x + 1, y, z - 1, height)) {
    neighbors.push({ x: x + 1, y: y, z: z - 1, cost: 1.414 });
  }
  if (d2 && isWalkable(dimension, x + 1, y, z + 1, height)) {
    neighbors.push({ x: x + 1, y: y, z: z + 1, cost: 1.414 });
  }
  if (d3 && isWalkable(dimension, x - 1, y, z + 1, height)) {
    neighbors.push({ x: x - 1, y: y, z: z + 1, cost: 1.414 });
  }

if (horizontalOnly) {
    return neighbors;
  }

const stepUpDirs = [
    { dx: 0, dz: -1, name: "N-UP" },
    { dx: 1, dz: 0, name: "E-UP" },
    { dx: 0, dz: 1, name: "S-UP" },
    { dx: -1, dz: 0, name: "W-UP" },
  ];

  for (const dir of stepUpDirs) {
    const nx = x + dir.dx;
    const nz = z + dir.dz;
    const ny = y + 1;

if (!isWalkable(dimension, nx, ny, nz, height)) continue;

let hasHeadroom = true;
    for (let h = 0; h < height; h++) {
      if (!isPassable(dimension, x, y + height + h, z)) {
        hasHeadroom = false;
        break;
      }
    }
    if (!hasHeadroom) continue;

if (!canStandOn(dimension, nx, ny - 1, nz)) continue;

    neighbors.push({ x: nx, y: ny, z: nz, cost: 2.0 });
  }

const stepDownLevels = [
    { dy: -1, costVertical: 1.0, costLateral: 1.5 },
    { dy: -2, costVertical: 1.5, costLateral: 2.0 },
    { dy: -3, costVertical: 2.0, costLateral: 2.8 },
  ];

for (const level of stepDownLevels) {
    const ny = y + level.dy;

if (!isWalkable(dimension, x, ny, z, height)) continue;

if (!canStandOn(dimension, x, ny - 1, z)) continue;

let canFall = true;
    for (let dropY = ny; dropY < y; dropY++) {
      for (let h = 0; h < height; h++) {
        if (!isPassable(dimension, x, dropY + h, z)) {
          canFall = false;
          break;
        }
      }
      if (!canFall) break;
    }
    if (!canFall) continue;

    neighbors.push({ x: x, y: ny, z: z, cost: level.costVertical });
  }

return neighbors;
}

function getDirectionChangeCost(prevDir, newDx, newDz) {
  if (!prevDir) return 0;
  if (prevDir.dx === newDx && prevDir.dz === newDz) {
    return -DYNAMIC_PATHFINDING_CONFIG.STRAIGHT_LINE_BONUS;
  }
  if (prevDir.dx === -newDx && prevDir.dz === -newDz) {
    return DYNAMIC_PATHFINDING_CONFIG.DIRECTION_CHANGE_PENALTY * 2;
  }
  if (prevDir.dx !== newDx || prevDir.dz !== newDz) {
    return DYNAMIC_PATHFINDING_CONFIG.DIRECTION_CHANGE_PENALTY;
  }
  return 0;
}
function octileHeuristic(ax, ay, az, bx, by, bz) {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  const dz = Math.abs(az - bz);
  const maxHoriz = Math.max(dx, dz);
  const minHoriz = Math.min(dx, dz);
  return maxHoriz + 0.414 * minHoriz + dy;
}

function findValidStart(dimension, x, y, z, height, radius = 3) {
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const fz = Math.floor(z);

if (isWalkable(dimension, fx, fy, fz, height)) {
    return { x: fx, y: fy, z: fz };
  }

for (let dy = -2; dy <= 2; dy++) {
    if (isWalkable(dimension, fx, fy + dy, fz, height)) {
      console.log(`[A*] Adjusted start height by ${dy} blocks`);
      return { x: fx, y: fy + dy, z: fz };
    }
  }

for (let r = 1; r <= radius; r++) {

    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) === r || Math.abs(dz) === r) {

          if (isWalkable(dimension, fx + dx, fy, fz + dz, height)) {
            console.log(`[A*] Found valid start at offset (${dx}, 0, ${dz})`);
            return { x: fx + dx, y: fy, z: fz + dz };
          }

for (let dy = -r; dy <= r; dy++) {
            if (isWalkable(dimension, fx + dx, fy + dy, fz + dz, height)) {
              console.log(`[A*] Found valid start at offset (${dx}, ${dy}, ${dz})`);
              return { x: fx + dx, y: fy + dy, z: fz + dz };
            }
          }
        }
      }
    }
  }

  return null;
}
export function findPathAStar(dimension, start, goal, options = {}) {
  const height = options.height ?? DYNAMIC_PATHFINDING_CONFIG.ENTITY_HEIGHT;

const dx = goal.x - start.x;
  const dy = goal.y - start.y;
  const dz = goal.z - start.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

const baseIterations = Math.min(Math.floor(distance * 100), 2500);
  const maxIterations = options.maxIterations
    ? Math.min(options.maxIterations, baseIterations)
    : baseIterations;

  isCalculatingPath = true;

  console.log(
    `[A*] Finding path: (${Math.floor(start.x)},${Math.floor(start.y)},${Math.floor(start.z)}) -> (${Math.floor(goal.x)},${Math.floor(goal.y)},${Math.floor(goal.z)}) dist=${distance.toFixed(1)} maxIter=${maxIterations}`,
  );

const validStart = findValidStart(
    dimension,
    start.x,
    start.y,
    start.z,
    height,
  );
  if (!validStart) {
    console.warn("[A*] No valid start position found within search radius");
    isCalculatingPath = false;
    return null;
  }

const validGoal = findValidStart(
    dimension,
    goal.x,
    goal.y,
    goal.z,
    height,
    5,
  );
  if (!validGoal) {
    console.warn("[A*] No valid goal position found within search radius");
    isCalculatingPath = false;
    return null;
  }

const sameYLevel = Math.abs(validStart.y - validGoal.y) <= 1;

  if (sameYLevel) {
    const horizontalPath = findPathAStarInternal(
      dimension,
      validStart,
      validGoal,
      height,
      Math.floor(maxIterations * 0.4),
      true,
      true
    );

    if (horizontalPath && horizontalPath.length > 0) {
      console.log(`[A*] ✓ Found horizontal path with ${horizontalPath.length} points`);
      isCalculatingPath = false;
      if (DYNAMIC_PATHFINDING_CONFIG.PARTICLE_ENABLED) {
        visualizeCalculatedPath(dimension, horizontalPath);
      }
      return horizontalPath;
    }
  }

const fullPath = findPathAStarInternal(
    dimension,
    validStart,
    validGoal,
    height,
    Math.floor(maxIterations * 0.6),
    false,
    true
  );

  isCalculatingPath = false;

  if (fullPath && fullPath.length > 0) {
    console.log(`[A*] ✓ Found path with ${fullPath.length} points`);
    if (DYNAMIC_PATHFINDING_CONFIG.PARTICLE_ENABLED) {
      visualizeCalculatedPath(dimension, fullPath);
    }
    return fullPath;
  }

  console.warn("[A*] No path found in either phase");
  return null;
}

function findPathAStarInternal(dimension, validStart, validGoal, height, maxIterations, horizontalOnly, allowPartial = false) {

  const startKey = posKey(validStart.x, validStart.y, validStart.z);
  const goalKey = posKey(validGoal.x, validGoal.y, validGoal.z);

if (startKey === goalKey) {
    return [{ x: validGoal.x + 0.5, y: validGoal.y, z: validGoal.z + 0.5 }];
  }

const frontier = new PriorityQueue();
  frontier.put(startKey, 0);

  const cameFrom = new Map();
  const costSoFar = new Map();

  cameFrom.set(startKey, { parent: null, dir: null });
  costSoFar.set(startKey, 0);

  let iterations = 0;
  let found = false;
  let bestKey = startKey;
  let bestDist = Infinity;

while (!frontier.empty() && iterations < maxIterations) {
    iterations++;

    const currentKey = frontier.get();

    if (currentKey === goalKey) {
      found = true;
      break;
    }

    const [cx, cy, cz] = currentKey.split(",").map(Number);

const distToGoal = Math.sqrt(
      (cx - validGoal.x) ** 2 + (cy - validGoal.y) ** 2 + (cz - validGoal.z) ** 2
    );
    if (distToGoal < bestDist) {
      bestDist = distToGoal;
      bestKey = currentKey;
    }

    const currentData = cameFrom.get(currentKey);
    const prevDir = currentData?.dir;

const neighbors = getNeighbors(dimension, cx, cy, cz, height, horizontalOnly);

    for (const next of neighbors) {
      const nextKey = posKey(next.x, next.y, next.z);
      const newDir = { dx: next.x - cx, dz: next.z - cz };

const directionCost = getDirectionChangeCost(
        prevDir,
        newDir.dx,
        newDir.dz,
      );
      const newCost = costSoFar.get(currentKey) + next.cost + directionCost;

if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)) {
        costSoFar.set(nextKey, newCost);
        const priority =
          newCost +
          heuristic(
            next.x,
            next.y,
            next.z,
            validGoal.x,
            validGoal.y,
            validGoal.z,
          );
        frontier.put(nextKey, priority);
        cameFrom.set(nextKey, { parent: currentKey, dir: newDir });
      }
    }
  }

const targetKey = found ? goalKey : (allowPartial && bestKey !== startKey ? bestKey : null);

  if (!targetKey) {
    return null;
  }

const rawPath = [];
  let current = targetKey;
  while (current !== null) {
    const [px, py, pz] = current.split(",").map(Number);
    rawPath.unshift({ x: px + 0.5, y: py, z: pz + 0.5 });
    const data = cameFrom.get(current);
    current = data?.parent ?? null;
  }

  if (!found && allowPartial && rawPath.length > 1) {
    console.log(`[A*] Using partial path (${rawPath.length} pts, ${bestDist.toFixed(1)} blocks from goal)`);
  }

  return rawPath;
}

function visualizeCalculatedPath(dimension, path) {
  if (!path || path.length === 0) return;

  try {
    const config = DYNAMIC_PATHFINDING_CONFIG;

    console.log(`[A*] 🎨 Visualizing path with ${path.length} points...`);

for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];

const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dz = p2.z - p1.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

const numParticles = Math.ceil(distance * 5);

for (let j = 0; j <= numParticles; j++) {
        const t = j / numParticles;
        const x = p1.x + dx * t;
        const y = p1.y + dy * t + 0.6;
        const z = p1.z + dz * t;

        dimension.spawnParticle(config.PARTICLE_PATH, { x, y, z });
      }
    }

const start = path[0];
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      dimension.spawnParticle("minecraft:crop_growth_emitter", {
        x: start.x + Math.cos(a) * 0.5,
        y: start.y + 0.5,
        z: start.z + Math.sin(a) * 0.5,
      });
    }

const goal = path[path.length - 1];
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {

      dimension.spawnParticle(config.PARTICLE_TARGET, {
        x: goal.x + Math.cos(a) * 0.8,
        y: goal.y + 0.8,
        z: goal.z + Math.sin(a) * 0.8,
      });

dimension.spawnParticle(config.PARTICLE_TARGET, {
        x: goal.x + Math.cos(a) * 0.4,
        y: goal.y + 1.2,
        z: goal.z + Math.sin(a) * 0.4,
      });
    }

for (let h = 0; h < 3; h += 0.2) {
      dimension.spawnParticle(config.PARTICLE_TARGET, {
        x: goal.x,
        y: goal.y + h,
        z: goal.z,
      });
    }

    console.log(`[A*] ✓ Path visualization complete`);
  } catch (e) {
    console.warn("[A*] Error visualizing path:", e);
  }
}
function smoothPathWithLOS(dimension, path, height = 2) {
  if (path.length <= 2) return path;

  const smoothed = [path[0]];
  let current = 0;

  while (current < path.length - 1) {
    let furthest = current + 1;

const maxLookAhead = Math.min(path.length - 1, current + 2);

    for (let i = maxLookAhead; i > current + 1; i--) {
      if (hasLineOfSight(dimension, path[current], path[i], height)) {
        furthest = i;
        break;
      }
    }

    smoothed.push(path[furthest]);
    current = furthest;
  }

  return smoothed;
}
function hasLineOfSight(dimension, from, to, height = 2) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (distance < 1.2) return true;

if (Math.abs(dy) > 1.0) return false;

const steps = Math.ceil(distance * 6);
  if (steps <= 1) return true;

  const stepX = dx / steps;
  const stepY = dy / steps;
  const stepZ = dz / steps;

  let lastBlockX = Math.floor(from.x);
  let lastBlockZ = Math.floor(from.z);

  for (let i = 1; i < steps; i++) {
    const px = from.x + stepX * i;
    const py = from.y + stepY * i;
    const pz = from.z + stepZ * i;

    const blockX = Math.floor(px);
    const blockY = Math.floor(py);
    const blockZ = Math.floor(pz);

for (let h = 0; h < height; h++) {
      if (isSolid(dimension, blockX, blockY + h, blockZ)) {
        debugLog(`LOS blocked by solid at (${blockX},${blockY + h},${blockZ})`);
        return false;
      }
    }

const ceilingBlock = getBlock(dimension, blockX, blockY + height, blockZ);
    if (ceilingBlock && isSolid(dimension, blockX, blockY + height, blockZ)) {

      let clearHeight = 0;
      for (let h = 0; h < height + 1; h++) {
        if (isPassable(dimension, blockX, blockY + h, blockZ)) {
          clearHeight++;
        } else {
          break;
        }
      }

      if (clearHeight < height) {
        debugLog(`LOS blocked by low ceiling at (${blockX},${blockY},${blockZ}) - only ${clearHeight} blocks clearance`);
        return false;
      }
    }

if (blockX !== lastBlockX && blockZ !== lastBlockZ) {

for (let h = 0; h < height; h++) {
        if (isSolid(dimension, lastBlockX, blockY + h, blockZ)) {
          debugLog(
            `LOS blocked by corner wall at (${lastBlockX},${blockY + h},${blockZ})`,
          );
          return false;
        }
      }

for (let h = 0; h < height; h++) {
        if (isSolid(dimension, blockX, blockY + h, lastBlockZ)) {
          debugLog(
            `LOS blocked by corner wall at (${blockX},${blockY + h},${lastBlockZ})`,
          );
          return false;
        }
      }

if (isSolid(dimension, lastBlockX, blockY + height, blockZ)) {
        debugLog(`LOS blocked by low ceiling at corner (${lastBlockX},${blockY + height},${blockZ})`);
        return false;
      }

      if (isSolid(dimension, blockX, blockY + height, lastBlockZ)) {
        debugLog(`LOS blocked by low ceiling at corner (${blockX},${blockY + height},${lastBlockZ})`);
        return false;
      }

const midX = (lastBlockX + blockX) / 2;
      const midZ = (lastBlockZ + blockZ) / 2;
      const midBlockX = Math.floor(midX);
      const midBlockZ = Math.floor(midZ);

      for (let h = 0; h < height; h++) {
        if (isSolid(dimension, midBlockX, blockY + h, midBlockZ)) {
          debugLog(`LOS blocked by wall at midpoint (${midBlockX},${blockY + h},${midBlockZ})`);
          return false;
        }
      }
    }

if (!isSolid(dimension, blockX, blockY - 1, blockZ)) {
      const floorBelow = isSolid(dimension, blockX, blockY - 2, blockZ);
      if (!floorBelow) {
        debugLog(
          `LOS blocked - no ground at (${blockX},${blockY - 1},${blockZ})`,
        );
        return false;
      }
    }

    lastBlockX = blockX;
    lastBlockZ = blockZ;
  }

  return true;
}
const activeSessions = new Map();
let sessionIdCounter = 0;
class PathfindingSession {
  constructor(entityId, dimensionId, goalPos, options = {}) {
    this.id = ++sessionIdCounter;
    this.entityId = entityId;
    this.dimensionId = dimensionId;
    this.goalPos = goalPos;
    this.options = options;
    this.path = [];
    this.pathIndex = 0;
    this.state = "idle";
    this.tickCounter = 0;
    this.lastRecalcTick = 0;
    this.stuckCounter = 0;
    this.lastPosition = null;
    this.onArrival = options.onArrival ?? null;
    this.onFailed = options.onFailed ?? null;
    this.onChaseEnd = options.onChaseEnd ?? null;
    this.lastJumpTick = -999;
  }
  getEntity() {

    try {
      const entity = world.getEntity(this.entityId);
      if (entity) return entity;
    } catch { }

    try {
      const dimension = world.getDimension(this.dimensionId);

if (this.lastPosition) {
        try {
          const entities = dimension.getEntities({
            location: this.lastPosition,
            maxDistance: 32
          });
          for (const entity of entities) {
            if (entity.id === this.entityId) return entity;
          }
        } catch { }
      }

for (const entity of dimension.getEntities()) {
        if (entity.id === this.entityId) return entity;
      }
    } catch { }
    return null;
  }
}
export function startDynamicPathfinding(entity, goalPos, options = {}) {
  if (!entity || !goalPos) {
    console.warn("[Pathfinding] Invalid entity or goal");
    return null;
  }
  const session = new PathfindingSession(
    entity.id,
    entity.dimension.id,
    goalPos,
    options,
  );

  session.state = "waiting_for_path";
  session.pathRequestId = requestPathAsync(
    entity.dimension,
    entity.location,
    goalPos,
    {
      height: options.height ?? DYNAMIC_PATHFINDING_CONFIG.ENTITY_HEIGHT,
      maxIterations: DYNAMIC_PATHFINDING_CONFIG.MAX_ITERATIONS
    },
    (path) => {
      session.pathRequestId = null;
      if (path && path.length > 0) {
        session.path = path;
        session.state = "moving";
        console.log(`[Pathfinding] Path found for session ${session.id}: ${path.length} waypoints`);
      } else {
        console.warn(`[Pathfinding] Failed to find initial path for session ${session.id}`);
        session.state = "failed";
        if (session.onFailed) session.onFailed(session);
      }
    }
  );

  activeSessions.set(session.id, session);
  console.log(
    `[Pathfinding] Session ${session.id} started (async calculation)...`,
  );
  return session.id;
}
export function stopDynamicPathfinding(sessionId) {
  if (activeSessions.has(sessionId)) {
    activeSessions.delete(sessionId);
    console.log(`[Pathfinding] Session ${sessionId} stopped`);
    return true;
  }
  return false;
}
export function getDynamicPathfindingSession(sessionId) {
  return activeSessions.get(sessionId);
}
export function hasActiveDynamicPathfinding(entityId) {
  for (const session of activeSessions.values()) {
    if (session.entityId === entityId) return true;
  }
  return false;
}

export function getActivePathfindingSessions() {
  return activeSessions.keys();
}
export function getSessionByEntityId(entityId) {
  for (const session of activeSessions.values()) {
    if (session.entityId === entityId) return session;
  }
  return null;
}
function processSession(session) {
  session.tickCounter++;
  const entity = session.getEntity();
  if (!entity) {
    session.state = "failed";
    return;
  }

if (session.state === "moving" && session.isChasing && session.chaseTargetId) {
    if (session.tickCounter % 5 === 0) {
      const target = findEntity(session.chaseTargetId, session.dimensionId, entity.location);
      if (target) {
        const distToTarget = getDistance3D(entity.location, target.location);
        const distToGoal = getDistance3D(target.location, session.goalPos);

if (distToGoal > 2.0) {
          broadcastDebug(`[Smart Chase] Target moved! Recalculating...`);

          if (hasLineOfSight(entity.dimension, entity.location, target.location, 2.0)) {
            broadcastDebug(`[Smart Chase] Line of sight restored! Switching to Direct Chase.`);
            session.state = "chasing";
            processChasing(session, entity);
            return;
          } else {

            session.goalPos = { ...target.location };
            session.state = "calculating";
            recalculatePath(session, entity);
            return;
          }
        }
      }
    }
  }

if (session.state === "waiting_for_path") {
    return;
  }

if (session.state === "chasing") {

    if (typeof processChasing === "function") {
      processChasing(session, entity);
    }
    return;
  }

  if (session.state !== "moving" && session.state !== "calculating") return;

  const config = DYNAMIC_PATHFINDING_CONFIG;
  const dimension = entity.dimension;
  const currentPos = entity.location;

  if (!session.path || session.pathIndex >= session.path.length) {

    const distToGoal = Math.sqrt(
      Math.pow(currentPos.x - session.goalPos.x, 2) +
      Math.pow(currentPos.y - session.goalPos.y, 2) +
      Math.pow(currentPos.z - session.goalPos.z, 2)
    );

    if (distToGoal < config.ARRIVAL_THRESHOLD + 1.5) {
      handleArrival(session, entity);
    } else {

      debugLog("[Pathfinding] Partial path end reached, continuing...");
      recalculatePath(session, entity);
    }
    return;
  }

  const target = session.path[session.pathIndex];
  const dx = target.x - currentPos.x;
  const dy = target.y - currentPos.y;
  const dz = target.z - currentPos.z;
  const horizontalDist = Math.sqrt(dx * dx + dz * dz);
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

if (dist < config.ARRIVAL_THRESHOLD) {
    session.pathIndex++;
    session.stuckCounter = 0;

if (session.waypointsCompleted === undefined) {
      session.waypointsCompleted = 0;
    }
    session.waypointsCompleted++;

const recalcEvery = config.RECALC_EVERY_BLOCKS || 6;
    const remainingWaypoints = session.path.length - session.pathIndex;
    const nextWaypoint = session.path[session.pathIndex];
    const isVerticalMove = nextWaypoint && Math.abs(nextWaypoint.y - currentPos.y) > 0.5;

if (session.waypointsCompleted % recalcEvery === 0 && remainingWaypoints > 6 && !isVerticalMove) {
      recalculatePath(session, entity);
      return;
    }

    if (session.pathIndex >= session.path.length) {
      handleArrival(session, entity);
      return;
    }
    return;
  }

const targetX = Math.floor(target.x);
  const targetY = Math.floor(target.y);
  const targetZ = Math.floor(target.z);
  let targetBlocked = false;

  for (let h = 0; h < config.ENTITY_HEIGHT; h++) {
    if (!isPassable(dimension, targetX, targetY + h, targetZ)) {
      console.warn(`[Pathfinding] Session ${session.id}: Target blocked, recalculating...`);
      targetBlocked = true;
      break;
    }
  }

  if (targetBlocked) {
    recalculatePath(session, entity);
    return;
  }

if (session.lastPosition) {
    const moved = Math.sqrt(
      Math.pow(currentPos.x - session.lastPosition.x, 2) +
      Math.pow(currentPos.z - session.lastPosition.z, 2)
    );

    if (moved < 0.05) {
      session.stuckCounter++;
      if (session.stuckCounter > config.STUCK_THRESHOLD) {
        console.log(`[Pathfinding] Stuck for ${session.stuckCounter} ticks, recalculating...`);
        session.stuckCounter = 0;
        session.failedRecalcs = (session.failedRecalcs || 0) + 1;

        if (session.failedRecalcs > 3 && session.pathIndex < session.path.length - 2) {
          console.log("[Pathfinding] Multiple failures, skipping waypoint");
          session.pathIndex++;
          session.failedRecalcs = 0;
        } else {
          recalculatePath(session, entity);
        }
        return;
      }
    } else {
      session.stuckCounter = 0;
      session.failedRecalcs = 0;
    }
  }
  session.lastPosition = { ...currentPos };

if (config.USE_APPLY_IMPULSE) {
    try {

      const blockBelow = getBlock(dimension, Math.floor(currentPos.x), Math.floor(currentPos.y) - 1, Math.floor(currentPos.z));
      const onGround = blockBelow && isSolid(dimension, Math.floor(currentPos.x), Math.floor(currentPos.y) - 1, Math.floor(currentPos.z));

if (horizontalDist > 0.1) {
        const dirX = dx / horizontalDist;
        const dirZ = dz / horizontalDist;

        const velocity = entity.getVelocity();
        const currentSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);

        if (currentSpeed < config.MAX_HORIZONTAL_SPEED) {
          entity.applyImpulse({
            x: dirX * config.HORIZONTAL_IMPULSE,
            y: 0,
            z: dirZ * config.HORIZONTAL_IMPULSE
          });
        }
      }

const needsJump = onGround && dy > 0.2 && dy <= 1.6 && horizontalDist < 3.0;
      const canJump = (session.tickCounter - session.lastJumpTick) > config.JUMP_COOLDOWN_TICKS;

      if (needsJump && canJump) {

        const forwardBoost = config.JUMP_FORWARD_BOOST || 0.18;
        const dirX = horizontalDist > 0.1 ? dx / horizontalDist : 0;
        const dirZ = horizontalDist > 0.1 ? dz / horizontalDist : 0;

        entity.applyImpulse({
          x: dirX * forwardBoost,
          y: config.JUMP_IMPULSE,
          z: dirZ * forwardBoost
        });
        session.lastJumpTick = session.tickCounter;
        console.log(`[Pathfinding] Session ${session.id}: JUMPING! dy=${dy.toFixed(2)}, hdist=${horizontalDist.toFixed(2)}`);
      }

if (onGround && dy < -0.3 && dy >= -2.0 && horizontalDist < 2.5) {
        const dirX = horizontalDist > 0.1 ? dx / horizontalDist : 0;
        const dirZ = horizontalDist > 0.1 ? dz / horizontalDist : 0;
        entity.applyImpulse({
          x: dirX * 0.15,
          y: -0.1,
          z: dirZ * 0.15
        });
      }

const yaw = Math.atan2(-dx, dz) * (180 / Math.PI);
      entity.setRotation({ x: entity.getRotation().x, y: yaw });

    } catch (e) {
      console.warn("[Pathfinding] Error with applyImpulse:", e);
    }
  } else {

}
}

function recalculatePath(session, entity) {

  if (session.state === "waiting_for_path") return;

if (session.pathRequestId) {
    cancelPathRequest(session.pathRequestId);
  }

  const recalcAttempts = session.recalcAttempts || 0;
  session.recalcAttempts = recalcAttempts + 1;

  if (recalcAttempts > 5) {
    console.warn("[Pathfinding] Too many recalc failures, marking as failed");
    session.state = "failed";
    if (session.onFailed) session.onFailed(session);
    return;
  }

  session.state = "waiting_for_path";

session.pathRequestId = requestPathAsync(
    entity.dimension,
    entity.location,
    session.goalPos,
    {
      height: session.options.height ?? DYNAMIC_PATHFINDING_CONFIG.ENTITY_HEIGHT,
      maxIterations: Math.min(DYNAMIC_PATHFINDING_CONFIG.MAX_ITERATIONS + recalcAttempts * 250, 3000),
    },
    (newPath) => {
      session.pathRequestId = null;
      if (session.state === "chasing") return;
      if (newPath && newPath.length > 0) {
        const isValid = validatePath(
          entity.dimension,
          newPath,
          session.options.height ?? DYNAMIC_PATHFINDING_CONFIG.ENTITY_HEIGHT,
        );
        if (isValid) {
          session.path = newPath;
          session.pathIndex = 0;
          session.waypointsCompleted = 0;
          session.lastRecalcTick = session.tickCounter;
          session.recalcAttempts = 0;
          session.state = "moving";
          debugLog(`[Pathfinding] Path recalculated: ${newPath.length} waypoints`);
        } else {
          console.warn("[Pathfinding] New path failed validation, trying to resume current...");
          session.state = "moving";
          if (session.path && session.pathIndex < session.path.length - 1) {
            session.pathIndex++;
          }
        }
      } else {
        console.warn(`[Pathfinding] Recalc attempt ${recalcAttempts} failed`);
        session.state = "moving";
      }
    }
  );
}
function validatePath(dimension, path, height = 2) {
  if (!path || path.length < 2) return true;
  for (let i = 0; i < path.length; i++) {
    const point = path[i];
    const px = Math.floor(point.x);
    const py = Math.floor(point.y);
    const pz = Math.floor(point.z);
    if (!isWalkable(dimension, px, py, pz, height)) {
      console.warn(
        `[Pathfinding] Path validation failed at point ${i}: (${px},${py},${pz})`,
      );
      return false;
    }
    if (i > 0) {
      const prev = path[i - 1];
      const prevX = Math.floor(prev.x);
      const prevY = Math.floor(prev.y);
      const prevZ = Math.floor(prev.z);
      if (!canMoveBetween(dimension, prevX, prevY, prevZ, px, py, pz, height)) {
        console.warn(
          `[Pathfinding] Path validation failed: can't move from (${prevX},${prevY},${prevZ}) to (${px},${py},${pz})`,
        );
        return false;
      }
    }
  }
  return true;
}
function handleArrival(session, entity) {
  session.state = "arrived";
  console.log(`[Pathfinding] Session ${session.id} arrived!`);
  try {
    const goal = session.goalPos;
    entity.teleport({
      x: Math.floor(goal.x) + 0.5,
      y: goal.y,
      z: Math.floor(goal.z) + 0.5,
    });
  } catch { }
  if (session.onArrival) session.onArrival(session, entity);

  activeSessions.delete(session.id);
}
function visualizePaths() {
  const config = DYNAMIC_PATHFINDING_CONFIG;
  if (!config.PARTICLE_ENABLED || !config.showPointParticles) return;

  for (const session of activeSessions.values()) {
    if (session.state !== "moving" || !session.path) continue;

    try {
      const dimension = world.getDimension(session.dimensionId);

if (session.pathIndex < session.path.length) {
        const target = session.path[session.pathIndex];

for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
          dimension.spawnParticle(config.PARTICLE_TARGET, {
            x: target.x + Math.cos(a) * 0.5,
            y: target.y + 1.2,
            z: target.z + Math.sin(a) * 0.5,
          });
        }
      }

for (let i = session.pathIndex; i < session.path.length - 1; i++) {
        const p1 = session.path[i];
        const p2 = session.path[i + 1];

const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

const numParticles = Math.ceil(distance * 4);

for (let j = 0; j <= numParticles; j++) {
          const t = j / numParticles;
          const x = p1.x + dx * t;
          const y = p1.y + dy * t + 0.5;
          const z = p1.z + dz * t;

          dimension.spawnParticle(config.PARTICLE_PATH, { x, y, z });
        }
      }

const goal = session.path[session.path.length - 1];
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {

        dimension.spawnParticle(config.PARTICLE_TARGET, {
          x: goal.x + Math.cos(a) * 0.7,
          y: goal.y + 0.8,
          z: goal.z + Math.sin(a) * 0.7,
        });

dimension.spawnParticle(config.PARTICLE_TARGET, {
          x: goal.x + Math.cos(a) * 0.4,
          y: goal.y + 1.0,
          z: goal.z + Math.sin(a) * 0.4,
        });
      }

for (let h = 0; h < 2; h += 0.3) {
        dimension.spawnParticle(config.PARTICLE_TARGET, {
          x: goal.x,
          y: goal.y + h,
          z: goal.z,
        });
      }

    } catch (e) {

    }
  }
}
export function processDynamicPathfindingTick() {
  if (system.currentTick % 200 === 0 && activeSessions.size > 0) {
    broadcastDebug(`[Dynamic AI] Sessions active: ${activeSessions.size}`);
  }

  processAsyncPathRequests();

  for (const [id, session] of activeSessions) {
    try {
      processSession(session);
    } catch (e) {
      console.warn(`[Pathfinding] Error in session ${id}:`, e);
      session.state = "failed";
    }
    if (session.state === "failed" || session.state === "arrived") {
      activeSessions.delete(id);
    }
  }
}

function findEntity(entityId, dimensionId, locationHint) {
  try {
    const entity = world.getEntity(entityId);
    if (entity) return entity;
  } catch { }

  try {
    const dim = world.getDimension(dimensionId || "overworld");

    if (locationHint) {
      const nearby = dim.getEntities({ location: locationHint, maxDistance: 32 });
      for (const ent of nearby) if (ent.id === entityId) return ent;
    }

    for (const ent of dim.getEntities()) if (ent.id === entityId) return ent;
  } catch { }
  return null;
}

function findNearestPlayer(dimension, position, maxRange) {
  try {
    const players = dimension.getPlayers({ location: position, maxDistance: maxRange });
    let nearest = null;
    let minDist = Infinity;

    for (const player of players) {

      const gm = String(player.getGameMode()).toLowerCase();
      if (gm === "creative" || gm === "1" || gm === "spectator" || gm === "3") {
        continue;
      }
      const dist = getDistance3D(position, player.location);
      if (dist < minDist) {
        minDist = dist;
        nearest = player;
      }
    }
    return nearest ? { player: nearest, distance: minDist } : null;
  } catch { return null; }
}

function processChasing(session, entity) {
  const target = findEntity(session.chaseTargetId, session.dimensionId, entity.location);

  if (!target) {
    broadcastDebug(`[Chase] Target lost for ${session.id}`);
    session.isChasing = false;
    session.state = "completed";

try {
      entity.triggerEvent("fr:stop_chasing");
      entity.triggerEvent("fr:start_walking");
    } catch { }
    return;
  }

  const distance = getDistance3D(entity.location, target.location);

const MAX_CHASE_DISTANCE = 20;
  if (distance > MAX_CHASE_DISTANCE) {
    broadcastDebug(`[Chase] Target too far (${distance.toFixed(1)}m > ${MAX_CHASE_DISTANCE}m). Ending chase.`);
    session.isChasing = false;
    session.state = "completed";

try {
      entity.triggerEvent("fr:stop_chasing");
      entity.triggerEvent("fr:start_walking");

      const entityType = entity.typeId.split(":")[1];
      if (entityType.includes("freddy")) {
        entity.triggerEvent("freddy_stop_chase");
      } else if (entityType.includes("bonnie")) {
        entity.triggerEvent("bonnie_stop_chase");
      } else if (entityType.includes("chica")) {
        entity.triggerEvent("chica_stop_chase");
      } else if (entityType.includes("foxy")) {
        entity.triggerEvent("foxy_stop_chase");
      }
    } catch { }

if (session.onChaseEnd) {
      try { session.onChaseEnd(session); } catch { }
    }
    return;
  }

if (session.tickCounter % 20 === 0) {
    broadcastDebug(`[Chase] ${entity.typeId.split(":")[1]} -> ${target.name} (${distance.toFixed(1)}m)`);
  }

if (session.tickCounter === 1 || session.tickCounter % 40 === 0) {
    try {

      entity.triggerEvent("fr:start_chasing");

const entityType = entity.typeId.split(":")[1];
      if (entityType.includes("freddy")) {
        entity.triggerEvent("freddy_start_chase");
      } else if (entityType.includes("bonnie")) {
        entity.triggerEvent("bonnie_start_chase");
      } else if (entityType.includes("chica")) {
        entity.triggerEvent("chica_start_chase");
      } else if (entityType.includes("foxy")) {
        entity.triggerEvent("foxy_start_chase");
      }
    } catch { }
  }

if (distance < 8 && distance > 1.5) {
    try {
      const dx = target.location.x - entity.location.x;
      const dz = target.location.z - entity.location.z;
      const mag = Math.sqrt(dx * dx + dz * dz);
      if (mag > 0) {

        const speed = 0.25;
        entity.applyImpulse({ x: (dx / mag) * speed, y: 0, z: (dz / mag) * speed });
      }
    } catch { }
  }

if (distance <= 3.0) {
    try {
      const entityType = entity.typeId.split(":")[1];
      if (entityType.includes("freddy")) {
        entity.triggerEvent("freddy_try_attack");
      } else if (entityType.includes("bonnie")) {
        entity.triggerEvent("bonnie_try_attack");
      } else if (entityType.includes("chica")) {
        entity.triggerEvent("chica_try_attack");
      } else if (entityType.includes("foxy")) {
        entity.triggerEvent("foxy_try_attack");
      }
      entity.triggerEvent("fr:caught_player");
    } catch { }
  }

  session.currentPos = entity.location;
}

let tickCounter = 0;
export function initDynamicPathfinding() {
  console.log("[A* Pathfinding] Initializing...");
  system.runInterval(() => {
    tickCounter++;
    processDynamicPathfindingTick();
    if (
      tickCounter % DYNAMIC_PATHFINDING_CONFIG.PARTICLE_INTERVAL_TICKS ===
      0
    ) {
      visualizePaths();
    }
  }, 1);
  console.log("[A* Pathfinding] Initialized");
}

export function cancelAllPathfindingForEntity(entityId) {
  let count = 0;
  for (const [id, session] of activeSessions) {
    if (session.entityId === entityId) {
      activeSessions.delete(id);
      count++;
    }
  }
  return count;
}
export { DYNAMIC_PATHFINDING_CONFIG as CONFIG };
