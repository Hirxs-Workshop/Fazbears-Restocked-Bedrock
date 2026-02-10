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

export const PATHFINDING_CONFIG = {
    MAX_ITERATIONS: 1000,
    MAX_PATH_LENGTH: 80,
    ENTITY_HEIGHT: 2,
    MOVE_SPEED: 0.15,
    MOVE_INTERVAL_TICKS: 2,
    ARRIVAL_THRESHOLD: 0.6,
    RECALC_INTERVAL_TICKS: 60,
    STUCK_THRESHOLD: 20,
    LOOKAHEAD_DISTANCE: 5,
    WALL_AVOIDANCE_COST: 0.3,
    DIRECTION_CHANGE_PENALTY: 0.8,
    STRAIGHT_LINE_BONUS: 0.2,
    PARTICLE_ENABLED: false,
    SHOW_POINT_PARTICLES: false,
    PARTICLE_INTERVAL_TICKS: 3,
    PARTICLE_PATH: "minecraft:villager_happy",
    PARTICLE_TARGET: "minecraft:heart_particle",
    PARTICLE_BLOCKED: "minecraft:villager_angry",
    SHOW_PATH_PARTICLES: false,
    PARTICLE_TYPE: "minecraft:endrod",
    PARTICLE_SPACING: 0.5,
    USE_APPLY_IMPULSE: true,
    HORIZONTAL_IMPULSE: 0.12,
    JUMP_IMPULSE: 0.55,
    MAX_HORIZONTAL_SPEED: 0.22,
    JUMP_COOLDOWN_TICKS: 8,
};

export const PASSABLE_BLOCKS = new Set([
    "minecraft:air",
    "minecraft:cave_air",
    "minecraft:void_air",
    "minecraft:light_block",
    "minecraft:structure_void",
    "fr:stage_platform",
    "fr:route_point",
]);

export const NON_SOLID_PATTERNS = [
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
    "water",
    "lava",
    "carpet",
    "slab",
    "pizza",
    "support",
];

export class PriorityQueue {
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

export function getBlock(dimension, x, y, z) {
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

export function isPassable(dimension, x, y, z) {
    const block = getBlock(dimension, x, y, z);
    if (!block) return false;
    const typeId = block.typeId;
    if (typeId.includes("air")) return true;
    if (PASSABLE_BLOCKS.has(typeId)) return true;
    for (const pattern of NON_SOLID_PATTERNS) {
        if (typeId.includes(pattern)) return true;
    }
    return false;
}

export function isSolid(dimension, x, y, z) {
    const block = getBlock(dimension, x, y, z);
    if (!block) return true;
    const typeId = block.typeId;
    if (typeId.includes("air")) return false;
    if (PASSABLE_BLOCKS.has(typeId)) return false;
    for (const pattern of NON_SOLID_PATTERNS) {
        if (typeId.includes(pattern)) return false;
    }
    return true;
}

export function isWalkable(dimension, x, y, z, height = 2) {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const fz = Math.floor(z);

    const groundBlock = getBlock(dimension, fx, fy - 1, fz);
    if (!groundBlock) return false;

    const groundSolid = isSolid(dimension, fx, fy - 1, fz);
    if (!groundSolid) return false;

    for (let h = 0; h < height; h++) {
        const bodyBlock = getBlock(dimension, fx, fy + h, fz);
        if (!bodyBlock) return false;
        const bodyPassable = isPassable(dimension, fx, fy + h, fz);
        if (!bodyPassable) return false;
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
            if (actualClearance < height) return false;
        }
    }

    return true;
}

export function canMoveBetween(dimension, fromX, fromY, fromZ, toX, toY, toZ, height = 2) {
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const dy = toY - fromY;

    for (let h = 0; h < height; h++) {
        if (!isPassable(dimension, toX, toY + h, toZ)) return false;
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
        if (clearHeight < height) return false;
    }

    if (dx !== 0 && dz !== 0) {
        for (let h = 0; h < height; h++) {
            if (!isPassable(dimension, fromX + dx, fromY + h, fromZ)) return false;
            if (!isPassable(dimension, fromX, fromY + h, fromZ + dz)) return false;
        }
        const midX = fromX + dx * 0.5;
        const midZ = fromZ + dz * 0.5;
        for (let h = 0; h < height; h++) {
            if (isSolid(dimension, Math.floor(midX), fromY + h, Math.floor(fromZ))) return false;
            if (isSolid(dimension, Math.floor(fromX), fromY + h, Math.floor(midZ))) return false;
        }
    }

    if ((dx !== 0 && dz === 0) || (dx === 0 && dz !== 0)) {
        for (let h = 0; h < height; h++) {
            if (isSolid(dimension, toX, toY + h, toZ)) return false;
        }
    }

    if (dy > 0) {
        if (dy > 1) return false;
        for (let h = 0; h < height; h++) {
            if (!isPassable(dimension, fromX, fromY + height + h, fromZ)) return false;
            if (!isPassable(dimension, toX, toY + h, toZ)) return false;
        }
        if (!isSolid(dimension, toX, toY - 1, toZ)) return false;
    }

    if (dy < 0) {
        if (dy < -1) return false;
        if (!isSolid(dimension, toX, toY - 1, toZ)) return false;
    }

    return true;
}

export function heuristic(ax, ay, az, bx, by, bz) {
    const dx = ax - bx;
    const dy = ay - by;
    const dz = az - bz;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    const verticalDist = Math.abs(dy);
    const baseCost = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const heightPenalty = verticalDist * 1.5;
    return (baseCost + heightPenalty) * 1.1;
}

export function octileHeuristic(ax, ay, az, bx, by, bz) {
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    const dz = Math.abs(az - bz);
    const maxHoriz = Math.max(dx, dz);
    const minHoriz = Math.min(dx, dz);
    return maxHoriz + 0.414 * minHoriz + dy;
}

export function getWallProximityCost(dimension, x, y, z, height = 2) {
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
    return wallCount * PATHFINDING_CONFIG.WALL_AVOIDANCE_COST;
}

export function getNeighbors(dimension, x, y, z, height = 2) {
    const neighbors = [];

    const directions = [
        { dx: 1, dz: 0, dy: 0, cost: 1.0, cardinal: true, name: "E" },
        { dx: -1, dz: 0, dy: 0, cost: 1.0, cardinal: true, name: "W" },
        { dx: 0, dz: 1, dy: 0, cost: 1.0, cardinal: true, name: "S" },
        { dx: 0, dz: -1, dy: 0, cost: 1.0, cardinal: true, name: "N" },
        { dx: 1, dz: 1, dy: 0, cost: 1.414, cardinal: false, name: "SE" },
        { dx: 1, dz: -1, dy: 0, cost: 1.414, cardinal: false, name: "NE" },
        { dx: -1, dz: 1, dy: 0, cost: 1.414, cardinal: false, name: "SW" },
        { dx: -1, dz: -1, dy: 0, cost: 1.414, cardinal: false, name: "NW" },
        { dx: 1, dz: 0, dy: -1, cost: 1.3, cardinal: true, name: "E-DOWN" },
        { dx: -1, dz: 0, dy: -1, cost: 1.3, cardinal: true, name: "W-DOWN" },
        { dx: 0, dz: 1, dy: -1, cost: 1.3, cardinal: true, name: "S-DOWN" },
        { dx: 0, dz: -1, dy: -1, cost: 1.3, cardinal: true, name: "N-DOWN" },
        { dx: 1, dz: 0, dy: 1, cost: 2.0, cardinal: true, name: "E-UP" },
        { dx: -1, dz: 0, dy: 1, cost: 2.0, cardinal: true, name: "W-UP" },
        { dx: 0, dz: 1, dy: 1, cost: 2.0, cardinal: true, name: "S-UP" },
        { dx: 0, dz: -1, dy: 1, cost: 2.0, cardinal: true, name: "N-UP" },
    ];

    for (const dir of directions) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        const nz = z + dir.dz;

        if (!isWalkable(dimension, nx, ny, nz, height)) continue;
        if (!canMoveBetween(dimension, x, y, z, nx, ny, nz, height)) continue;

        if (!dir.cardinal && dir.dy === 0) {
            const adj1Walkable = isWalkable(dimension, x + dir.dx, y, z, height);
            const adj2Walkable = isWalkable(dimension, x, y, z + dir.dz, height);
            if (!adj1Walkable || !adj2Walkable) continue;
        }

        if (dir.dy > 0) {
            let canStepUp = true;
            for (let h = 0; h < height; h++) {
                if (!isPassable(dimension, x, y + height + h, z)) {
                    canStepUp = false;
                    break;
                }
            }
            if (canStepUp) {
                for (let h = 0; h < height; h++) {
                    if (!isPassable(dimension, nx, ny + h, nz)) {
                        canStepUp = false;
                        break;
                    }
                }
            }
            if (!canStepUp) continue;
        }

        let finalCost = dir.cost;
        if (dir.dy > 0) {
            const wallProximity = getWallProximityCost(dimension, nx, ny, nz, height);
            if (wallProximity > 0) {
                finalCost += wallProximity * 2.0;
            }
        } else {
            finalCost += getWallProximityCost(dimension, nx, ny, nz, height);
        }

        neighbors.push({ x: nx, y: ny, z: nz, cost: finalCost });
    }

    return neighbors;
}

export function posKey(x, y, z) {
    return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

export function getDirectionChangeCost(prevDir, newDx, newDz) {
    if (!prevDir) return 0;
    if (prevDir.dx === newDx && prevDir.dz === newDz) {
        return -PATHFINDING_CONFIG.STRAIGHT_LINE_BONUS;
    }
    if (prevDir.dx === -newDx && prevDir.dz === -newDz) {
        return PATHFINDING_CONFIG.DIRECTION_CHANGE_PENALTY * 2;
    }
    if (prevDir.dx !== newDx || prevDir.dz !== newDz) {
        return PATHFINDING_CONFIG.DIRECTION_CHANGE_PENALTY;
    }
    return 0;
}

export function findValidStart(dimension, x, y, z, height, radius = 3) {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const fz = Math.floor(z);

    if (isWalkable(dimension, fx, fy, fz, height)) {
        return { x: fx, y: fy, z: fz };
    }

    for (let dy = -2; dy <= 2; dy++) {
        if (isWalkable(dimension, fx, fy + dy, fz, height)) {
            return { x: fx, y: fy + dy, z: fz };
        }
    }

    for (let r = 1; r <= radius; r++) {
        for (let dx = -r; dx <= r; dx++) {
            for (let dz = -r; dz <= r; dz++) {
                if (Math.abs(dx) === r || Math.abs(dz) === r) {
                    if (isWalkable(dimension, fx + dx, fy, fz + dz, height)) {
                        return { x: fx + dx, y: fy, z: fz + dz };
                    }
                    for (let dy = -r; dy <= r; dy++) {
                        if (isWalkable(dimension, fx + dx, fy + dy, fz + dz, height)) {
                            return { x: fx + dx, y: fy + dy, z: fz + dz };
                        }
                    }
                }
            }
        }
    }

    return null;
}

export function findEntity(entityId, dimensionId) {

    try {
        const entity = world.getEntity(entityId);
        if (entity) return entity;
    } catch { }

    try {
        const dimName = (dimensionId || "overworld").replace("minecraft:", "");
        const dimension = world.getDimension(dimName);

for (const entity of dimension.getEntities()) {
            if (entity.id === entityId) {
                return entity;
            }
        }
    } catch (e) {

    }
    return null;
}

export function findEntityByDynamicProperty(propertyName, propertyValue, dimensionId) {
    try {
        const dimName = (dimensionId || "overworld").replace("minecraft:", "");
        const dimension = world.getDimension(dimName);
        for (const entity of dimension.getEntities()) {
            try {
                if (entity.getDynamicProperty(propertyName) === propertyValue) {
                    return entity;
                }
            } catch { }
        }
    } catch { }
    return null;
}

export function hasLineOfSight(dimension, from, to, height = 2) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < 0.1) return true;

    const steps = Math.ceil(dist * 2);
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const checkX = from.x + dx * t;
        const checkY = from.y + dy * t;
        const checkZ = from.z + dz * t;

        if (!isWalkable(dimension, checkX, checkY, checkZ, height)) {
            return false;
        }
    }

    return true;
}

export function smoothPathWithLOS(dimension, path, height = 2) {
    if (!path || path.length <= 2) return path;

    const smoothed = [path[0]];
    let current = 0;

    while (current < path.length - 1) {
        let furthest = current + 1;
        for (let i = path.length - 1; i > current + 1; i--) {
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

export function visualizeCalculatedPath(dimension, path) {
    if (!path || path.length === 0) return;

    try {
        const config = PATHFINDING_CONFIG;
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
            dimension.spawnParticle("minecraft:villager_happy", {
                x: start.x + Math.cos(a) * 0.5,
                y: start.y + 0.7,
                z: start.z + Math.sin(a) * 0.5,
            });
        }

        const end = path[path.length - 1];
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
            dimension.spawnParticle(config.PARTICLE_TARGET, {
                x: end.x + Math.cos(a) * 0.5,
                y: end.y + 0.7,
                z: end.z + Math.sin(a) * 0.5,
            });
        }

        console.log("[A*] ✓ Path visualization complete");
    } catch (e) {
        console.warn("[A*] Particle visualization error:", e);
    }
}

export function normalizeCompassRotationToYaw(compass) {
    if (compass === undefined || compass === null) return 0;
    const num = parseInt(compass, 10);
    if (isNaN(num)) return 0;
    switch (num) {
        case 0: return 180;
        case 1: return 270;
        case 2: return 0;
        case 3: return 90;
        default: return (num * 90) % 360;
    }
}
