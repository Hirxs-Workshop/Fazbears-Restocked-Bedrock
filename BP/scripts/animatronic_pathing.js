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

import { world, system, BlockPermutation, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

const MAX_SELECTOR_DISTANCE = 32;
const MAX_WAYPOINTS_PER_STATUE = 32;
const MIN_MOVE_TIME = 0;
const MAX_MOVE_TIME = 6000;
const MAX_NIGHTS = 7;

const PATHING_CONFIG = {
    STUCK_TIMEOUT_MS: 60000,
    STUCK_CHECK_INTERVAL_MS: 8000,
    MIN_PROGRESS_DISTANCE: 0.3,
    MAX_RETRIES: 3,
    ARRIVAL_DISTANCE: 3.0,
    TELEPORT_FALLBACK: true,
    MOVE_SPEED: 0.10,
    PATH_DRAW_INTERVAL: 2,
    MAX_PATH_SEARCH: 12000
};

const STATUE_TYPES = [
    "fr:bonnie_statue",
    "fr:chica_statue",
    "fr:foxy_statue",
    "fr:freddy_fazbear_statue"
];

const ANIMATRONIC_TYPES = [
    "fr:fnaf1_bonnie_entity",
    "fr:bonnie_the_rabbit",
    "fr:chica_the_chicken",
    "fr:fr_fnaf1_foxy",
    "fr:freddy_fazbear"
];

const ABILITY_TYPES = {
    NONE: "none",
    CAMERA_BLACKOUT: "camera_blackout",
    EMIT_SOUND: "emit_sound"
};

const waypointRegistry = new Map();
const activePathing = new Map();
const blockSelectorMode = new Map();
const nightTimeConfig = new Map();
const walkingEntities = new Map();

let nextPathingSessionId = 1;

export function getWaypointKey(location, dimensionId) {
    const x = Math.floor(location.x);
    const y = Math.floor(location.y);
    const z = Math.floor(location.z);
    const dimShort = dimensionId.replace("minecraft:", "");
    return `fr:wp_${x}_${y}_${z}_${dimShort}`;
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
        abilities: []
    };
    
    if (!data) return defaultData;
    
    try {
        const parsed = JSON.parse(data);
        return { ...defaultData, ...parsed };
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

export function saveWaypoint(location, dimensionId, config) {
    return setWaypointData(location, dimensionId, config);
}

export function loadWaypoint(location, dimensionId) {
    return getWaypointData(location, dimensionId);
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
                    location: { x: x + 0.5, y, z: z + 0.5 },
                    dimensionId: dimId,
                    order: wpData.order,
                    pose: wpData.pose,
                    rotation: wpData.rotation || 0,
                    waitTime: wpData.waitTime,
                    abilities: wpData.abilities || []
                });
            }
        } catch {}
    }

    waypoints.sort((a, b) => a.order - b.order);
    return waypoints;
}

export function refreshWaypointCache(statueId) {
    const newWaypoints = getWaypointsForStatue(statueId);
    
    if (newWaypoints.length > 0) {
        waypointRegistry.set(statueId, newWaypoints);
    } else {
        waypointRegistry.delete(statueId);
    }
    
    return newWaypoints;
}

export function linkWaypointToStatue(statueId, waypointLocation, dimensionId, order = 0, pose = 0, waitTime = 0, rotation = 0) {
    setWaypointData(waypointLocation, dimensionId, {
        order: order,
        pose: pose,
        rotation: rotation,
        waitTime: waitTime,
        linkedStatueId: statueId,
        abilities: []
    });

    refreshWaypointCache(statueId);
    console.log(`[Pathing] Linked waypoint to statue ${statueId}. Total: ${waypointRegistry.get(statueId)?.length || 0}`);
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

export function setNightMoveTime(entity, nightNumber, time) {
    if (nightNumber < 1 || nightNumber > MAX_NIGHTS) return false;
    if (time < MIN_MOVE_TIME || time > MAX_MOVE_TIME) return false;
    
    const entityId = entity.id;
    let config = nightTimeConfig.get(entityId) || {};
    
    config[nightNumber] = {
        moveTime: time,
        enabled: true 
    };
    
    nightTimeConfig.set(entityId, config);
    
    entity.setDynamicProperty("fr:night_times", JSON.stringify(config));
    
    return true;
}

export function getNightMoveTime(entity, nightNumber) {
    const entityId = entity.id;
    let config = nightTimeConfig.get(entityId);
    
    if (!config) {
        const stored = entity.getDynamicProperty("fr:night_times");
        if (stored) {
            try {
                config = JSON.parse(stored);
                nightTimeConfig.set(entityId, config);
            } catch {
                config = {};
            }
        } else {
            config = {};
        }
    }
    
    return config[nightNumber] || { moveTime: 0, enabled: false };
}

export function loadNightTimeConfig(entity) {
    const stored = entity.getDynamicProperty("fr:night_times");
    if (stored) {
        try {
            const config = JSON.parse(stored);
            nightTimeConfig.set(entity.id, config);
            return config;
        } catch {}
    }
    return {};
}

export function saveNightTimes(entity, config) {
    entity.setDynamicProperty("fr:night_times", JSON.stringify(config));
    nightTimeConfig.set(entity.id, config);
}

export function loadNightTimes(entity) {
    return loadNightTimeConfig(entity);
}

export function startBlockSelectorMode(player, statueId, entityName) {
    const playerId = player.id;
    
    if (isInBlockSelectorMode(player)) {
        cancelBlockSelectorMode(player);
    }
    
    const lookPos = getPlayerLookBlock(player, MAX_SELECTOR_DISTANCE);
    if (!lookPos) {
        player.sendMessage("§c[Pathing] No valid block in range");
        return false;
    }
    
    const dimension = player.dimension;
    
    try {
        const selector = dimension.spawnEntity("fr:terminal_animatronic_selector", {
            x: lookPos.x + 0.5,
            y: lookPos.y + 1,
            z: lookPos.z + 0.5
        });
        
        blockSelectorMode.set(playerId, {
            active: true,
            statueId: statueId,
            entityName: entityName,
            selectorEntityId: selector.id,
            currentPosition: lookPos,
            maxDistance: MAX_SELECTOR_DISTANCE,
            startTime: Date.now()
        });
        
        startWaypointVisualization(statueId, dimension, playerId);
        
        try {
            const inventory = player.getComponent("minecraft:inventory");
            if (inventory && inventory.container) {
                const waypointItem = new ItemStack("fr:faz-diver_repairman", 1);
                waypointItem.setLore([
                    `§7Waypoint Creator`,
                    `§aStatue ID: §f${statueId}`,
                    `§aEntity: §f${entityName}`,
                    `§7Use to place waypoints`
                ]);
                waypointItem.nameTag = `§a${entityName} §7Waypoint Tool`;
                const selectedSlot = player.selectedSlotIndex;
                inventory.container.setItem(selectedSlot, waypointItem);
            }
        } catch (e) {
            console.warn("[Pathing] Could not give waypoint item:", e);
        }
        
        player.sendMessage(`§a[Pathing] Block selector mode activated for ${entityName}`);
        player.sendMessage("§7Look at a block and interact to place waypoints");
        player.sendMessage("§7Press §eSNEAK + INTERACT§7 to cancel");
        
        return true;
    } catch (e) {
        console.warn("[Pathing] Failed to create selector entity:", e);
        return false;
    }
}

export function updateSelectorPosition(player) {
    const playerId = player.id;
    const state = blockSelectorMode.get(playerId);
    
    if (!state || !state.active) return;
    
    const playerPos = player.location;
    const lookPos = getPlayerLookBlock(player, MAX_SELECTOR_DISTANCE);
    
    if (!lookPos) return;
    
    const dx = lookPos.x - playerPos.x;
    const dy = lookPos.y - playerPos.y;
    const dz = lookPos.z - playerPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    let finalPos = lookPos;
    if (distance > MAX_SELECTOR_DISTANCE) {
        const viewDir = player.getViewDirection();
        finalPos = {
            x: Math.floor(playerPos.x + viewDir.x * MAX_SELECTOR_DISTANCE),
            y: Math.floor(playerPos.y + viewDir.y * MAX_SELECTOR_DISTANCE),
            z: Math.floor(playerPos.z + viewDir.z * MAX_SELECTOR_DISTANCE)
        };
    }
    
    state.currentPosition = finalPos;
    
    const dimension = player.dimension;
    try {
        for (const entity of dimension.getEntities({ type: "fr:terminal_animatronic_selector" })) {
            if (entity.id === state.selectorEntityId) {
                entity.teleport({
                    x: finalPos.x + 0.5,
                    y: finalPos.y + 1,
                    z: finalPos.z + 0.5
                });
                break;
            }
        }
    } catch {}
}

export function waypointExistsAtPosition(location, dimensionId, statueId) {
    const key = getWaypointKey(location, dimensionId);
    const data = world.getDynamicProperty(key);
    
    if (!data) return false;
    
    try {
        const wpData = JSON.parse(data);
        return wpData.linkedStatueId === statueId;
    } catch {
        return false;
    }
}

export function getNextWaypointOrder(statueId) {
    const existingWaypoints = getWaypointsForStatue(statueId);
    if (existingWaypoints.length === 0) return 0;
    
    const maxOrder = Math.max(...existingWaypoints.map(wp => wp.order));
    return maxOrder + 1;
}

export function createWaypoint(location, dimensionId, statueId, options = {}) {
    if (waypointExistsAtPosition(location, dimensionId, statueId)) {
        return { error: "duplicate", message: "A waypoint already exists at this position" };
    }
    
    const existingWaypoints = getWaypointsForStatue(statueId);
    if (existingWaypoints.length >= MAX_WAYPOINTS_PER_STATUE) {
        return { error: "max_reached", message: `Maximum waypoints (${MAX_WAYPOINTS_PER_STATUE}) reached` };
    }
    
    const nextOrder = getNextWaypointOrder(statueId);
    
    const waypointConfig = {
        order: nextOrder,
        pose: options.pose ?? 0,
        rotation: options.rotation ?? 0,
        waitTime: options.waitTime ?? 0,
        linkedStatueId: statueId,
        abilities: options.abilities ?? []
    };
    
    setWaypointData(location, dimensionId, waypointConfig);
    refreshWaypointCache(statueId);
    
    return {
        location,
        dimensionId,
        config: waypointConfig
    };
}

export function placeWaypointAtSelector(player) {
    const playerId = player.id;
    const state = blockSelectorMode.get(playerId);
    
    if (!state || !state.active) return null;
    
    const location = state.currentPosition;
    const dimensionId = player.dimension.id;
    const statueId = state.statueId;
    const result = createWaypoint(location, dimensionId, statueId);
    
    if (result.error) {
        if (result.error === "duplicate") {
            player.sendMessage(`§c[Pathing] A waypoint already exists at this position!`);
        } else if (result.error === "max_reached") {
            player.sendMessage(`§c[Pathing] ${result.message}`);
        }
        return null;
    }
    
    player.sendMessage(`§a[Pathing] Waypoint #${result.config.order} placed at (${Math.floor(location.x)}, ${Math.floor(location.y)}, ${Math.floor(location.z)})`);
    
    return result;
}

export function cancelBlockSelectorMode(player) {
    const playerId = player.id;
    const state = blockSelectorMode.get(playerId);
    
    if (!state) return;
    
    if (state.statueId) {
        stopWaypointVisualization(state.statueId);
    }
    
    const dimension = player.dimension;
    try {
        for (const entity of dimension.getEntities({ type: "fr:terminal_animatronic_selector" })) {
            if (entity.id === state.selectorEntityId) {
                entity.remove();
                break;
            }
        }
    } catch {}
    
    blockSelectorMode.delete(playerId);
    player.sendMessage("§c[Pathing] Block selector mode cancelled");
}

export function isInBlockSelectorMode(player) {
    const state = blockSelectorMode.get(player.id);
    return state && state.active;
}

export function getBlockSelectorState(player) {
    return blockSelectorMode.get(player.id);
}

function getPlayerLookBlock(player, maxDistance) {
    try {
        const viewDir = player.getViewDirection();
        const startPos = player.getHeadLocation();
        const dimension = player.dimension;

        for (let dist = 1; dist <= maxDistance; dist++) {
            const checkPos = {
                x: Math.floor(startPos.x + viewDir.x * dist),
                y: Math.floor(startPos.y + viewDir.y * dist),
                z: Math.floor(startPos.z + viewDir.z * dist)
            };
            
            const block = dimension.getBlock(checkPos);
            if (block && block.typeId !== "minecraft:air" && block.typeId !== "minecraft:cave_air") {
                return checkPos;
            }
        }

        return {
            x: Math.floor(startPos.x + viewDir.x * maxDistance),
            y: Math.floor(startPos.y + viewDir.y * maxDistance),
            z: Math.floor(startPos.z + viewDir.z * maxDistance)
        };
    } catch {
        return null;
    }
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


export function isLinkableEntity(entity) {
    return STATUE_TYPES.includes(entity.typeId) || ANIMATRONIC_TYPES.includes(entity.typeId);
}


export function getEntityDisplayName(entity) {
    const nameTag = entity.nameTag;
    if (nameTag && nameTag.trim() !== "") {
        return nameTag;
    }
    const typeId = entity.typeId.replace("fr:", "").replace(/_/g, " ");
    return typeId.charAt(0).toUpperCase() + typeId.slice(1);
}




const DETECTION_CONFIG = {
    BASE_RANGE: 20,
    SNEAK_RANGE: 8,
    SNEAK_CHANCE_REDUCTION: 0.7,
    CHECK_INTERVAL_TICKS: 20,
    CHASE_UPDATE_TICKS: 5,
    CHASE_TIMEOUT_MS: 30000,
    CHASE_ARRIVAL_DISTANCE: 2.0
};

const temporaryStatues = new Map();

const simulationSessions = new Map();

const NIGHT_START = 13000;
const NIGHT_END = 23000;

const DEFAULT_WAIT_TIME = 2400;
const MIN_WAIT_TIME = 600;
const MAX_WAIT_TIME = 7200;





export function spawnLureAtLocation(dimension, location) {
    try {

        const nearbyLures = dimension.getEntities({ 
            type: "fr:platform_lure", 
            location: location, 
            maxDistance: 3 
        });
        for (const lure of nearbyLures) {
            lure.remove();
        }

        dimension.spawnEntity("fr:platform_lure", {
            x: location.x + 0.5,
            y: location.y + 0.5,
            z: location.z + 0.5
        });
        console.log(`[Pathing] Spawned lure at ${Math.floor(location.x)}, ${Math.floor(location.y)}, ${Math.floor(location.z)}`);
    } catch (e) {
        console.warn(`[Pathing] Error spawning lure: ${e}`);
    }
}


export function removeLureAtLocation(dimension, location) {
    try {
        const nearbyLures = dimension.getEntities({ 
            type: "fr:platform_lure", 
            location: location, 
            maxDistance: 5 
        });
        for (const lure of nearbyLures) {
            lure.remove();
        }
    } catch (e) {
        console.warn(`[Pathing] Error removing lure: ${e}`);
    }
}


export function removeAllLures() {
    let count = 0;
    for (const dimName of ["overworld", "nether", "the_end"]) {
        try {
            const dim = world.getDimension(dimName);
            const lures = dim.getEntities({ type: "fr:platform_lure" });
            for (const lure of lures) {
                lure.remove();
                count++;
            }
        } catch {}
    }
    console.log(`[Pathing] Removed ${count} lures`);
    return count;
}


export function cleanupLuresNearEntity(entity) {
    if (!entity) return;
    try {
        const nearbyLures = entity.dimension.getEntities({ 
            type: "fr:platform_lure", 
            location: entity.location, 
            maxDistance: 50 
        });
        for (const lure of nearbyLures) {
            lure.remove();
        }
        console.log(`[Pathing] Cleaned up ${nearbyLures.length} lures near entity`);
    } catch (e) {
        console.warn(`[Pathing] Error cleaning up lures near entity: ${e}`);
    }
}





export function findEntityById(entityId, entityType, preferredDimId = null) {
    const dimNames = ["overworld", "nether", "the_end"];

    if (preferredDimId) {
        const dimName = preferredDimId.replace("minecraft:", "");
        if (dimNames.includes(dimName)) {
            dimNames.splice(dimNames.indexOf(dimName), 1);
            dimNames.unshift(dimName);
        }
    }

    for (const dimName of dimNames) {
        try {
            const dim = world.getDimension(dimName);
            if (entityType) {
                const entities = dim.getEntities({ type: entityType });
                const entity = entities.find(e => e.id === entityId);
                if (entity) return entity;
            } else {
                for (const e of dim.getEntities()) {
                    if (e.id === entityId) return e;
                }
            }
        } catch {}
    }
    return null;
}





function isPlayerInSurvivalMode(player) {
    try {
        if (typeof player.getGameMode === 'function') {
            const mode = player.getGameMode();
            const modeStr = String(mode).toLowerCase();
            return modeStr === "survival" || modeStr === "adventure" || 
                   modeStr.includes("survival") || modeStr.includes("adventure");
        }
        if (player.hasTag && player.hasTag("creative_mode")) {
            return false;
        }
        return true;
    } catch (e) {
        console.warn(`[Detection] Error checking game mode: ${e}`);
        return false;
    }
}


export function detectNearbyPlayer(entity, dimension) {
    try {
        const entityLoc = entity.location;
        const entityRot = entity.getRotation();
        const allPlayers = dimension.getPlayers();

        let closestPlayer = null;
        let closestDistance = Infinity;

        for (const player of allPlayers) {
            if (!isPlayerInSurvivalMode(player)) continue;

            const playerLoc = player.location;
            const distance = Math.sqrt(
                Math.pow(playerLoc.x - entityLoc.x, 2) +
                Math.pow(playerLoc.y - entityLoc.y, 2) +
                Math.pow(playerLoc.z - entityLoc.z, 2)
            );

            if (distance > DETECTION_CONFIG.BASE_RANGE) continue;

            const isSneaking = player.isSneaking;
            const effectiveRange = isSneaking ? DETECTION_CONFIG.SNEAK_RANGE : DETECTION_CONFIG.BASE_RANGE;

            if (distance > effectiveRange) continue;

            if (isSneaking && Math.random() < DETECTION_CONFIG.SNEAK_CHANCE_REDUCTION) {
                continue;
            }

            const hasLineOfSight = checkLineOfSight(dimension, entityLoc, playerLoc);
            if (!hasLineOfSight) continue;

            const angleToPlayer = Math.atan2(
                playerLoc.x - entityLoc.x,
                playerLoc.z - entityLoc.z
            ) * (180 / Math.PI);

            let angleDiff = Math.abs(angleToPlayer - (-entityRot.y));
            if (angleDiff > 180) angleDiff = 360 - angleDiff;

            if (angleDiff > 60) continue;

            if (distance < closestDistance) {
                closestDistance = distance;
                closestPlayer = player;
            }
        }

        return closestPlayer;
    } catch (e) {
        console.warn(`[Detection] Error detecting player: ${e}`);
        return null;
    }
}


export function checkLineOfSight(dimension, from, to) {
    try {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dz = to.z - from.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const steps = Math.ceil(distance * 2);

        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const checkLoc = {
                x: from.x + dx * t,
                y: from.y + 1 + dy * t,
                z: from.z + dz * t
            };

            const block = dimension.getBlock(checkLoc);
            if (block && !block.isAir && !block.isLiquid) {
                const typeId = block.typeId;
                if (!typeId.includes("glass") && 
                    !typeId.includes("door") && 
                    !typeId.includes("fence") &&
                    !typeId.includes("bars") &&
                    !typeId.includes("leaves")) {
                    return false;
                }
            }
        }
        return true;
    } catch {
        return true;
    }
}





export function isNightTime() {
    try {
        const time = world.getTimeOfDay();
        return time >= NIGHT_START && time < NIGHT_END;
    } catch (e) {
        console.warn(`[Pathing] Error checking time: ${e}`);
        return true;
    }
}





export function createPathingSession(entityId, statueId, entityType, dimensionId, originLocation = null, variantIndex = 0) {
    const sessionId = `session_${nextPathingSessionId++}`;

    if (!waypointRegistry.has(statueId)) {
        refreshWaypointCache(statueId);
    }

    const waypoints = waypointRegistry.get(statueId);
    if (!waypoints || waypoints.length === 0) {
        console.log(`[Pathing] No waypoints for statue ${statueId}`);
        return null;
    }

    let origin = originLocation;
    if (!origin) {
        try {
            const dim = world.getDimension(dimensionId.replace("minecraft:", ""));
            for (const e of dim.getEntities({ type: entityType })) {
                if (e.id === entityId) {
                    origin = { ...e.location };
                    break;
                }
            }
        } catch {}
    }

    const randomIndex = Math.floor(Math.random() * waypoints.length);
    const now = Date.now();

    activePathing.set(sessionId, {
        sessionId: sessionId,
        statueId: statueId,
        entityType: entityType,
        currentEntityId: entityId,
        dimensionId: dimensionId,
        waypointIndex: randomIndex,
        state: "moving",
        stateStartTime: now,
        lastProgressCheck: now,
        lastKnownPosition: null,
        originLocation: origin,
        lastSuccessfulLocation: origin,
        retryCount: 0,
        failedWaypoints: new Set(),
        isWalkCommandActive: false,
        useRandomOrder: true,
        variantIndex: variantIndex,
        isChasing: false,
        chaseTargetId: null,
        chaseTargetLocation: null,
        chaseStartTime: null,
        chaseWalkActive: false,
        lastDetectionCheck: 0
    });

    console.log(`[Pathing] Created session ${sessionId} for entity ${entityId} (statue ${statueId}, starting wp ${randomIndex})`);
    return sessionId;
}


export function startPathing(entityId, statueId, entityType = null) {
    let dimensionId = "minecraft:overworld";
    for (const dimName of ["overworld", "nether", "the_end"]) {
        try {
            const dim = world.getDimension(dimName);
            const entities = dim.getEntities({ type: entityType });
            const entity = entities.find(e => e.id === entityId);
            if (entity) {
                dimensionId = entity.dimension.id;
                break;
            }
        } catch {}
    }

    const sessionId = createPathingSession(entityId, statueId, entityType, dimensionId);
    return sessionId !== null;
}


export function stopPathing(sessionId) {
    const tempData = temporaryStatues.get(sessionId);
    if (tempData) {
        try {
            const dimension = world.getDimension(tempData.dimensionId.replace("minecraft:", ""));
            for (const e of dimension.getEntities({ type: tempData.statueType })) {
                if (e.id === tempData.statueId) {
                    e.remove();
                    break;
                }
            }
        } catch (e) {
            console.warn(`[Pathing] Error cleaning up temporary statue: ${e}`);
        }
        temporaryStatues.delete(sessionId);
    }

    const session = activePathing.get(sessionId);
    if (session) {
        const waypoints = waypointRegistry.get(session.statueId);
        if (waypoints && waypoints[session.waypointIndex]) {
            try {
                const dim = world.getDimension(session.dimensionId?.replace("minecraft:", "") || "overworld");
                removeLureAtLocation(dim, waypoints[session.waypointIndex].location);
            } catch {}
        }
    }

    activePathing.delete(sessionId);
    console.log(`[Pathing] Stopped session ${sessionId}`);
}


export function stopPathingForEntity(entityId) {
    let found = false;
    for (const [sessionId, pathData] of activePathing) {
        if (pathData.currentEntityId === entityId) {
            stopPathing(sessionId);
            found = true;
            break;
        }
    }

    try {
        for (const dimName of ["overworld", "nether", "the_end"]) {
            const dim = world.getDimension(dimName);
            const entities = dim.getEntities({ type: "fr:fnaf1_bonnie_entity" });
            for (const entity of entities) {
                if (entity.id === entityId) {
                    cleanupLuresNearEntity(entity);
                    break;
                }
            }
        }
    } catch {}

    return found;
}


export function stopPathingForStatue(statueId) {
    const sessionsToStop = [];
    for (const [sessionId, pathData] of activePathing) {
        if (pathData.statueId === statueId) {
            sessionsToStop.push(sessionId);
        }
    }
    for (const sessionId of sessionsToStop) {
        stopPathing(sessionId);
    }
    return sessionsToStop.length;
}





function getWaitTimeFromState(state) {
    switch (state) {
        case 0: return MIN_WAIT_TIME + Math.random() * (DEFAULT_WAIT_TIME - MIN_WAIT_TIME);
        case 1: return 600;
        case 2: return 1200;
        case 3: return 2400;
        case 4: return 3600;
        case 5: return 4800;
        case 6: return 6000;
        case 7: return 7200;
        default: return DEFAULT_WAIT_TIME;
    }
}


export function getStatueTypeForAnimatronic(animatronicType) {
    const mapping = {
        "fr:fnaf1_bonnie_entity": "fr:bonnie_statue",
        "fr:fnaf1_chica_entity": "fr:chica_statue",
        "fr:fnaf1_foxy_entity": "fr:foxy_statue",
        "fr:fnaf1_freddy_entity": "fr:freddy_fazbear_statue"
    };
    return mapping[animatronicType] || "fr:bonnie_statue";
}


export function getAnimatronicTypeForStatue(statueType) {
    const mapping = {
        "fr:bonnie_statue": "fr:fnaf1_bonnie_entity",
        "fr:chica_statue": "fr:fnaf1_chica_entity",
        "fr:foxy_statue": "fr:fnaf1_foxy_entity",
        "fr:freddy_fazbear_statue": "fr:fnaf1_freddy_entity"
    };
    return mapping[statueType] || "fr:fnaf1_bonnie_entity";
}


function selectNextWaypoint(pathData, waypoints) {
    console.log(`[Pathing] Selecting next waypoint. Total: ${waypoints.length}, Current: ${pathData.waypointIndex}`);

    pathData.failedWaypoints.delete(pathData.waypointIndex);

    if (pathData.useRandomOrder && waypoints.length > 1) {
        const validIndices = [];
        for (let i = 0; i < waypoints.length; i++) {
            if (i !== pathData.waypointIndex && !pathData.failedWaypoints.has(i)) {
                validIndices.push(i);
            }
        }

        if (validIndices.length > 0) {
            const selectedIndex = validIndices[Math.floor(Math.random() * validIndices.length)];
            return selectedIndex;
        }

        pathData.failedWaypoints.clear();
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * waypoints.length);
        } while (newIndex === pathData.waypointIndex && waypoints.length > 1);
        return newIndex;
    } else {
        let nextIndex = (pathData.waypointIndex + 1) % waypoints.length;
        let attempts = 0;

        while (pathData.failedWaypoints.has(nextIndex) && attempts < waypoints.length) {
            nextIndex = (nextIndex + 1) % waypoints.length;
            attempts++;
        }

        if (attempts >= waypoints.length) {
            pathData.failedWaypoints.clear();
            nextIndex = (pathData.waypointIndex + 1) % waypoints.length;
        }

        return nextIndex;
    }
}


function handleStuckEntity(pathData, entity, waypoints, currentWp, sessionId = null) {
    pathData.retryCount++;
    console.log(`[Pathing] Entity stuck (attempt ${pathData.retryCount}/${PATHING_CONFIG.MAX_RETRIES})`);

    if (entity?.dimension) {
        removeLureAtLocation(entity.dimension, currentWp.location);
    }

    if (pathData.retryCount >= PATHING_CONFIG.MAX_RETRIES) {
        pathData.failedWaypoints.add(pathData.waypointIndex);

        if (pathData.isSimulation && pathData.simulationId) {
            recordSimulationResult(pathData.simulationId, pathData.waypointIndex, false, "Stuck/Timeout", currentWp?.location);
        }

        if (PATHING_CONFIG.TELEPORT_FALLBACK && entity) {
            try {
                entity.teleport(currentWp.location);
                pathData.retryCount = 0;
                pathData.state = "arriving";
                return;
            } catch (e) {
                console.warn(`[Pathing] Failed to teleport: ${e}`);
            }
        }

        pathData.waypointIndex = selectNextWaypoint(pathData, waypoints);
        pathData.retryCount = 0;
    }

    pathData.state = "moving";
    pathData.isWalkCommandActive = false;
    pathData.stateStartTime = Date.now();
    pathData.lastProgressCheck = Date.now();
    pathData.lastKnownPosition = entity?.location ? { ...entity.location } : null;

    const targetWp = waypoints[pathData.waypointIndex];
    if (targetWp && entity?.dimension) {
        spawnLureAtLocation(entity.dimension, targetWp.location);
    }
}





function cleanupOrphanedSessions() {
    const sessionsToRemove = [];

    for (const [sessionId, pathData] of activePathing) {
        if (pathData.state === "posing" || pathData.state === "arriving") {
            continue;
        }

        if (pathData.currentEntityId) {
            const entity = findEntityById(pathData.currentEntityId, pathData.entityType, pathData.dimensionId);
            if (!entity) {
                sessionsToRemove.push(sessionId);
            }
        }
    }

    for (const sessionId of sessionsToRemove) {
        console.log(`[Pathing] Cleaning orphaned session ${sessionId}`);
        stopPathing(sessionId);
    }
}


export function cleanupBuggedWaypoints() {
    const allKeys = world.getDynamicPropertyIds();
    let removedCount = 0;
    let checkedCount = 0;

    for (const key of allKeys) {
        if (!key.startsWith("fr:wp_")) continue;
        checkedCount++;

        const data = world.getDynamicProperty(key);
        if (!data) {
            world.setDynamicProperty(key, undefined);
            removedCount++;
            continue;
        }

        try {
            const wpData = JSON.parse(data);
            const parts = key.replace("fr:wp_", "").split("_");
            
            if (parts.length < 4) {
                world.setDynamicProperty(key, undefined);
                removedCount++;
                continue;
            }

            const x = parseInt(parts[0]);
            const y = parseInt(parts[1]);
            const z = parseInt(parts[2]);
            const dimShort = parts[3];

            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                world.setDynamicProperty(key, undefined);
                removedCount++;
                continue;
            }

            try {
                const dim = world.getDimension("minecraft:" + dimShort);
                const block = dim.getBlock({ x, y, z });

                if (!block || block.typeId !== "fr:waypoint") {
                    console.log(`[Pathing] Removing orphaned waypoint data at ${x}, ${y}, ${z}`);
                    world.setDynamicProperty(key, undefined);
                    removedCount++;

                    if (wpData.linkedStatueId) {
                        refreshWaypointCache(wpData.linkedStatueId);
                    }
                }
            } catch {}
        } catch {
            world.setDynamicProperty(key, undefined);
            removedCount++;
        }
    }

    console.log(`[Pathing] Checked ${checkedCount} waypoints, removed ${removedCount} bugged entries`);
    return removedCount;
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
        } catch {}
    }

    waypointRegistry.delete(statueId);
}





export function getPathingDebugInfo() {
    const info = {
        activeSessions: activePathing.size,
        temporaryStatues: temporaryStatues.size,
        cachedStatues: waypointRegistry.size,
        sessions: []
    };

    for (const [sessionId, data] of activePathing) {
        info.sessions.push({
            id: sessionId,
            state: data.state,
            waypoint: data.waypointIndex,
            retries: data.retryCount,
            entityId: data.currentEntityId,
            statueId: data.statueId
        });
    }

    return info;
}





export function startPathingSimulation(statue, player, maxWaypoints = 10) {
    try {
        const statueId = statue.id;
        const waypointStatueId = statue.getDynamicProperty("fr:statue_id");

        if (!waypointStatueId) {
            player.sendMessage("§c[Simulation] §7No waypoint ID assigned to this statue!");
            return false;
        }

        refreshWaypointCache(waypointStatueId);
        const waypoints = waypointRegistry.get(waypointStatueId);

        if (!waypoints || waypoints.length === 0) {
            player.sendMessage("§c[Simulation] §7No waypoints configured for this statue!");
            return false;
        }

        let platformLocation = null;
        try {
            const platformData = statue.getDynamicProperty("fr:platform_location");
            if (platformData) {
                platformLocation = JSON.parse(platformData);
            }
        } catch {}

        if (!platformLocation) {
            player.sendMessage("§c[Simulation] §7No platform linked! Link a platform first.");
            return false;
        }

        const dimension = statue.dimension;
        const spawnLocation = platformLocation;
        const entityRotation = statue.getRotation();
        const rawRotation = entityRotation ? entityRotation.y : 0;

        let statueVariantIndex = 0;
        try {
            statueVariantIndex = statue.getDynamicProperty("fr:variant_index") || 0;
        } catch {}

        const statueData = {
            platformLocation: platformLocation,
            rotation: rawRotation,
            poseIndex: 0,
            variantIndex: statueVariantIndex,
            dimensionId: dimension.id,
            waypointStatueId: waypointStatueId
        };

        const animatronic = dimension.spawnEntity("fr:fnaf1_bonnie_entity", spawnLocation);

        animatronic.setDynamicProperty("fr:statue_id", waypointStatueId);
        animatronic.setDynamicProperty("fr:platform_location", JSON.stringify(platformLocation));
        animatronic.setDynamicProperty("fr:variant_index", statueVariantIndex);

        if (statueVariantIndex > 0) {
            system.run(() => {
                try {
                    animatronic.triggerEvent(`fr:set_variant_${statueVariantIndex}`);
                } catch {}
            });
        }

        animatronic.addTag("fr:simulation_mode");
        statue.remove();

        player.sendMessage(`§a[Simulation] §7Starting pathing simulation...`);
        player.sendMessage(`§7Waypoints to visit: §e${Math.min(maxWaypoints, waypoints.length)}`);

        system.run(() => {
            system.run(() => {
                try {
                    const sessionId = createPathingSession(
                        animatronic.id,
                        waypointStatueId,
                        animatronic.typeId,
                        animatronic.dimension.id,
                        null,
                        statueVariantIndex
                    );

                    if (!sessionId) {
                        player.sendMessage("§c[Simulation] §7Failed to create pathing session!");
                        return;
                    }

                    simulationSessions.set(sessionId, {
                        maxWaypoints: Math.min(maxWaypoints, waypoints.length),
                        waypointsVisited: 0,
                        successes: [],
                        failures: [],
                        startTime: Date.now(),
                        isSimulation: true,
                        playerId: player.id,
                        playerName: player.name,
                        platformLocation: platformLocation,
                        statueData: statueData,
                        totalWaypoints: waypoints.length,
                        selectionMode: waypoints.length > 1 ? "random" : "sequential"
                    });

                    const session = activePathing.get(sessionId);
                    if (session) {
                        session.isSimulation = true;
                        session.simulationId = sessionId;

                        if (waypoints[session.waypointIndex]) {
                            spawnLureAtLocation(animatronic.dimension, waypoints[session.waypointIndex].location);
                        }
                    }

                    player.sendMessage(`§a[Simulation] §7Session §e${sessionId}§7 started!`);
                } catch (e) {
                    console.warn(`[Simulation] Error starting: ${e}`);
                    player.sendMessage(`§c[Simulation] §7Error: ${e}`);
                }
            });
        });

        return true;
    } catch (e) {
        console.warn(`[Simulation] Error in startPathingSimulation: ${e}`);
        player.sendMessage(`§c[Simulation] §7Error: ${e}`);
        return false;
    }
}


function recordSimulationResult(sessionId, waypointIndex, success, reason = "", waypointLocation = null) {
    const simData = simulationSessions.get(sessionId);
    if (!simData) return;

    simData.waypointsVisited++;
    const timeElapsed = Date.now() - simData.startTime;

    if (success) {
        simData.successes.push({
            waypoint: waypointIndex,
            time: timeElapsed,
            location: waypointLocation
        });
    } else {
        simData.failures.push({
            waypoint: waypointIndex,
            reason: reason,
            time: timeElapsed,
            location: waypointLocation
        });
    }

    console.log(`[Simulation] Recorded waypoint ${waypointIndex}: ${success ? 'SUCCESS' : 'FAIL'} (${simData.waypointsVisited}/${simData.maxWaypoints})`);
}


function checkSimulationComplete(sessionId, pathData) {
    const simData = simulationSessions.get(sessionId);
    if (!simData || !simData.isSimulation) return false;

    if (simData.waypointsVisited >= simData.maxWaypoints) {
        console.log(`[Simulation] Complete! Visited ${simData.waypointsVisited} waypoints`);
        return true;
    }

    const waypoints = waypointRegistry.get(pathData.statueId);
    if (waypoints && pathData.failedWaypoints) {
        const allFailed = waypoints.every((_, idx) => pathData.failedWaypoints.has(idx));
        if (allFailed) {
            console.log(`[Simulation] All waypoints unreachable! Ending simulation.`);
            return true;
        }
    }

    return false;
}


function endSimulation(sessionId, animatronic) {
    const simData = simulationSessions.get(sessionId);
    if (!simData) return;

    let player = null;
    for (const p of world.getAllPlayers()) {
        if (p.id === simData.playerId || p.name === simData.playerName) {
            player = p;
            break;
        }
    }

    const totalTime = Math.floor((Date.now() - simData.startTime) / 1000);
    const successCount = simData.successes.length;
    const failCount = simData.failures.length;
    const totalVisited = simData.waypointsVisited;
    const successRate = totalVisited > 0 ? Math.round((successCount / totalVisited) * 100) : 0;

    const summaryLines = [
        `§6•••••••••••••••••••••••••••••••••••`,
        `§6    SIMULATION COMPLETE    `,
        `§6•••••••••••••••••••••••••••••••••••`,
        ``,
        `§7Total Time: §e${totalTime}s`,
        `§7Waypoints Visited: §e${totalVisited}/${simData.maxWaypoints}`,
        ``,
        `§aSuccesses: §f${successCount}`,
        `§cFailures: §f${failCount}`,
        `§7Success Rate: §${successRate >= 70 ? 'a' : successRate >= 40 ? 'e' : 'c'}${successRate}%`,
        ``
    ];

    if (simData.failures.length > 0) {
        summaryLines.push(`§c--- Failure Details ---`);
        for (const fail of simData.failures) {
            const timeStr = Math.floor(fail.time / 1000);
            let posStr = "";
            if (fail.location) {
                posStr = ` §8[${Math.floor(fail.location.x)}, ${Math.floor(fail.location.y)}, ${Math.floor(fail.location.z)}]`;
            }
            summaryLines.push(`§7  WP#${fail.waypoint}: §c${fail.reason || 'Stuck/Timeout'} §7(${timeStr}s)${posStr}`);
        }
    }

    summaryLines.push(`§6•••••••••••••••••••••••••••••••••••`);

    if (player) {
        for (const line of summaryLines) {
            player.sendMessage(line);
        }
    }

    stopPathing(sessionId);

    if (animatronic) {
        cleanupLuresNearEntity(animatronic);
        try { animatronic.removeTag("fr:simulation_mode"); } catch {}

        if (simData.platformLocation) {
            const platformLoc = simData.platformLocation;
            const dimension = animatronic.dimension;

            if (player) {
                player.sendMessage(`§7Returning to platform...`);
            }

            try {
                animatronic.teleport(platformLoc);
                const statueData = simData.statueData;
                const statue = dimension.spawnEntity("fr:bonnie_statue", platformLoc);

                if (statueData.waypointStatueId > 0) {
                    statue.setDynamicProperty("fr:statue_id", statueData.waypointStatueId);
                }
                statue.setDynamicProperty("fr:platform_location", JSON.stringify(platformLoc));

                system.run(() => {
                    try {
                        statue.teleport(statue.location, { rotation: { x: 0, y: statueData.rotation } });
                    } catch {}
                });

                animatronic.remove();

                if (player) {
                    player.sendMessage(`§a[Simulation] §7Returned to platform successfully!`);
                }
            } catch (e) {
                console.warn(`[Simulation] Error returning to platform: ${e}`);
                animatronic.remove();
            }
        } else {
            animatronic.remove();
        }
    }

    simulationSessions.delete(sessionId);
}


export function getSimulationInfo(sessionId) {
    return simulationSessions.get(sessionId) || null;
}


export function isSimulationSession(sessionId) {
    const simData = simulationSessions.get(sessionId);
    return simData?.isSimulation === true;
}





export function startPathingForAnimatronic(animatronic, waypointStatueId, forceStart = false) {
    console.log(`[Pathing] startPathingForAnimatronic called: entity=${animatronic?.id}, waypointId=${waypointStatueId}, force=${forceStart}`);

    if (!animatronic || !waypointStatueId) {
        console.warn("[Pathing] Invalid animatronic or waypointStatueId");
        return false;
    }

    if (!forceStart && !isNightTime()) {
        console.log("[Pathing] Not starting pathing - it's daytime");
        return false;
    }

    try {
        animatronic.triggerEvent("fr:start_pathing");
    } catch (e) {
        console.warn(`[Pathing] Could not trigger fr:start_pathing: ${e}`);
    }

    let variantIndex = 0;
    try {
        variantIndex = animatronic.getDynamicProperty("fr:variant_index") || 0;
    } catch {}

    const sessionId = createPathingSession(
        animatronic.id, 
        waypointStatueId, 
        animatronic.typeId,
        animatronic.dimension.id,
        null,
        variantIndex
    );

    if (!sessionId) {
        console.log(`[Pathing] Failed to create session - no waypoints?`);
        return false;
    }

    const session = activePathing.get(sessionId);
    if (session) {
        const waypoints = waypointRegistry.get(waypointStatueId);
        console.log(`[Pathing] Session created: ${sessionId}, waypoints=${waypoints?.length || 0}, startIndex=${session.waypointIndex}`);
        if (waypoints && waypoints[session.waypointIndex]) {
            spawnLureAtLocation(animatronic.dimension, waypoints[session.waypointIndex].location);
        }
    }

    return true;
}





export async function showPathingSettingsMenu(player, entity) {
    const statueId = getOrCreateStatueId(entity);
    const entityName = getEntityDisplayName(entity);
    const waypointCount = getWaypointsForStatue(statueId).length;
    
    const form = new ActionFormData()
        .title(`§l§aPATHING`)
        .body(`§7Entity: §a${entityName}\n§7Statue ID: §e${statueId}\n§7Waypoints: §f${waypointCount}`)
        .button(`§aWaypoints: §f${waypointCount}`)
        .button("§eTest Pathing")
        .button("§eSet ID")
        .button("§eNight Times")
        .button("§aCreate Waypoints")
        .button("§7Back");
    
    try {
        const response = await form.show(player);
        
        if (response.canceled) {
            return;
        }
        
        switch (response.selection) {
            case 0:
                if (waypointCount > 0) {
                    player.sendMessage(`§a[Pathing] §7${entityName} has ${waypointCount} waypoints configured`);
                } else {
                    player.sendMessage(`§c[Pathing] §7No waypoints configured. Use 'Create Waypoints' to add some.`);
                }
                system.runTimeout(() => showPathingSettingsMenu(player, entity), 5);
                break;
                
            case 1:
                if (waypointCount === 0) {
                    player.sendMessage("§c[Pathing] §7No waypoints to test! Create waypoints first.");
                    system.runTimeout(() => showPathingSettingsMenu(player, entity), 5);
                } else {
                    player.sendMessage(`§a[Pathing] §7Starting pathing test for ${entityName}...`);
                    startPathingSimulation(entity, player, Math.min(10, waypointCount));
                }
                break;
                
            case 2:
                system.runTimeout(() => showSetIdMenu(player, entity), 5);
                break;
                
            case 3:
                system.runTimeout(() => showNightTimeConfigMenu(player, entity), 5);
                break;
                
            case 4:

                if (startBlockSelectorMode(player, statueId, entityName)) {
                    system.runTimeout(() => showBlockSelectorMenu(player), 5);
                }
                break;
                
            case 5:

                player.sendMessage("§7[Pathing] Returning to editor...");
                break;
        }
    } catch (e) {
        console.warn("[Pathing] Error showing pathing settings menu:", e);
    }
}


async function showSetIdMenu(player, entity) {
    const currentId = entity.getDynamicProperty("fr:statue_id") || 0;
    
    const form = new ModalFormData()
        .title("§l§aSet Statue ID")
        .textField("Statue ID", "Enter a number", String(currentId));
    
    try {
        const response = await form.show(player);
        
        if (response.canceled) {
            system.runTimeout(() => showPathingSettingsMenu(player, entity), 5);
            return;
        }
        
        const newId = parseInt(response.formValues[0]);
        
        if (isNaN(newId) || newId < 0) {
            player.sendMessage("§c[Pathing] §7Invalid ID. Please enter a positive number.");
        } else {
            entity.setDynamicProperty("fr:statue_id", newId);
            refreshWaypointCache(newId);
            player.sendMessage(`§a[Pathing] §7Statue ID set to §e${newId}`);
        }
        
        system.runTimeout(() => showPathingSettingsMenu(player, entity), 5);
    } catch (e) {
        console.warn("[Pathing] Error in set ID menu:", e);
    }
}





export async function showBlockSelectorMenu(player) {
    const state = getBlockSelectorState(player);
    if (!state || !state.active) {
        player.sendMessage("§c[Pathing] Not in block selector mode");
        return;
    }
    
    const pos = state.currentPosition;
    const posText = pos ? `Position: (${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)})` : "No position selected";
    const waypointCount = getWaypointsForStatue(state.statueId).length;
    
    const form = new ActionFormData()
        .title(`§l§aWaypoint Creator`)
        .body(`§7Entity: §a${state.entityName}\n§7Statue ID: §e${state.statueId}\n§7Waypoints: §f${waypointCount}\n\n§7${posText}\n\n§7Use §e< >§7 to adjust distance`)
        .button("§l<")
        .button("§l§aPLACE")
        .button("§l>")
        .button("§c§lCANCEL");
    
    try {
        const response = await form.show(player);
        
        if (response.canceled || response.cancelationReason === "UserBusy") {
            return;
        }
        
        switch (response.selection) {
            case 0:
                adjustSelectorDistance(player, -1);
                system.runTimeout(() => showBlockSelectorMenu(player), 1);
                break;
                
            case 1:
                const placed = placeWaypointAtSelector(player);
                if (placed) {

                    system.runTimeout(() => showWaypointConfigMenu(player, placed), 5);
                } else {
                    system.runTimeout(() => showBlockSelectorMenu(player), 1);
                }
                break;
                
            case 2:
                adjustSelectorDistance(player, 1);
                system.runTimeout(() => showBlockSelectorMenu(player), 1);
                break;
                
            case 3:
                cancelBlockSelectorMode(player);
                break;
        }
    } catch (e) {
        console.warn("[Pathing] Error showing block selector menu:", e);
    }
}


function adjustSelectorDistance(player, direction) {
    const state = blockSelectorMode.get(player.id);
    if (!state || !state.active) return;

    const playerPos = player.location;
    const currentPos = state.currentPosition;
    
    if (!currentPos) return;
    
    const dx = currentPos.x - playerPos.x;
    const dy = currentPos.y - playerPos.y;
    const dz = currentPos.z - playerPos.z;
    const currentDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const viewDir = player.getViewDirection();
    const newDist = Math.max(1, Math.min(MAX_SELECTOR_DISTANCE, currentDist + direction));
    
    const newPos = {
        x: Math.floor(playerPos.x + viewDir.x * newDist),
        y: Math.floor(playerPos.y + viewDir.y * newDist),
        z: Math.floor(playerPos.z + viewDir.z * newDist)
    };
    
    state.currentPosition = newPos;

    try {
        for (const entity of player.dimension.getEntities({ type: "fr:terminal_animatronic_selector" })) {
            if (entity.id === state.selectorEntityId) {
                entity.teleport({
                    x: newPos.x + 0.5,
                    y: newPos.y + 1,
                    z: newPos.z + 0.5
                });
                break;
            }
        }
    } catch {}
}


export async function showWaypointConfigMenu(player, waypointData) {
    const state = getBlockSelectorState(player);
    if (!state) return;
    
    const { location, dimensionId, config } = waypointData;
    const posText = `(${Math.floor(location.x)}, ${Math.floor(location.y)}, ${Math.floor(location.z)})`;
    
    const form = new ActionFormData()
        .title(`§l§aWaypoint #${config.order}`)
        .body(`§7Position: §f${posText}\n§7Statue ID: §e${state.statueId}\n\n§7Configure this waypoint or continue placing more.`)
        .button("§aContinue Placing")
        .button("§eEdit Waypoint")
        .button("§cRemove Waypoint")
        .button("§7Done");
    
    try {
        const response = await form.show(player);
        
        if (response.canceled) {

            system.runTimeout(() => showBlockSelectorMenu(player), 1);
            return;
        }
        
        switch (response.selection) {
            case 0:
                system.runTimeout(() => showBlockSelectorMenu(player), 1);
                break;
                
            case 1:
                system.runTimeout(() => showWaypointEditMenu(player, location, dimensionId, config), 1);
                break;
                
            case 2:
                removeWaypointData(location, dimensionId);
                refreshWaypointCache(state.statueId);
                player.sendMessage(`§c[Pathing] Waypoint #${config.order} removed`);
                system.runTimeout(() => showBlockSelectorMenu(player), 1);
                break;
                
            case 3:
                cancelBlockSelectorMode(player);
                player.sendMessage(`§a[Pathing] Waypoint placement complete. Total: ${getWaypointsForStatue(state.statueId).length}`);
                break;
        }
    } catch (e) {
        console.warn("[Pathing] Error showing waypoint config menu:", e);
    }
}


export async function showWaypointEditMenu(player, location, dimensionId, currentConfig) {
    const state = getBlockSelectorState(player);
    
    const waitTimeOptions = ["0s (No wait)", "30s", "60s", "120s", "180s", "240s", "300s", "360s"];
    const currentWaitIndex = Math.min(7, Math.floor(currentConfig.waitTime / 600));
    
    const form = new ModalFormData()
        .title(`§l§aEdit Waypoint #${currentConfig.order}`)
        .slider("Order", 0, 31, 1, currentConfig.order)
        .slider("Pose Index", 0, 15, 1, currentConfig.pose || 0)
        .slider("Rotation (degrees)", 0, 360, 15, currentConfig.rotation || 0)
        .dropdown("Wait Time", waitTimeOptions, currentWaitIndex);
    
    try {
        const response = await form.show(player);
        
        if (response.canceled) {
            if (state) {
                system.runTimeout(() => showBlockSelectorMenu(player), 1);
            }
            return;
        }
        
        const [newOrder, newPose, newRotation, waitTimeIndex] = response.formValues;

        const waitTimes = [0, 600, 1200, 2400, 3600, 4800, 6000, 7200];
        const newWaitTime = waitTimes[waitTimeIndex] || 0;

        const updatedConfig = {
            ...currentConfig,
            order: newOrder,
            pose: newPose,
            rotation: newRotation,
            waitTime: newWaitTime
        };
        
        setWaypointData(location, dimensionId, updatedConfig);
        
        if (state) {
            refreshWaypointCache(state.statueId);
        }
        
        player.sendMessage(`§a[Pathing] Waypoint #${newOrder} updated`);
        
        if (state) {
            system.runTimeout(() => showBlockSelectorMenu(player), 1);
        }
    } catch (e) {
        console.warn("[Pathing] Error showing waypoint edit menu:", e);
    }
}





export async function showWaypointAbilitiesMenu(player, location, dimensionId, currentConfig) {
    const state = getBlockSelectorState(player);
    const abilities = currentConfig.abilities || [];
    
    const hasBlackout = abilities.some(a => a.type === ABILITY_TYPES.CAMERA_BLACKOUT);
    const hasSound = abilities.some(a => a.type === ABILITY_TYPES.EMIT_SOUND);
    
    const blackoutStatus = hasBlackout ? "§a[ON]" : "§7[OFF]";
    const soundStatus = hasSound ? "§a[ON]" : "§7[OFF]";
    
    const form = new ActionFormData()
        .title(`§l§aWaypoint Abilities`)
        .body(`§7Configure special abilities for this waypoint.\n§7These trigger when the animatronic arrives.`)
        .button(`Camera Blackout ${blackoutStatus}`)
        .button(`Emit Sound ${soundStatus}`)
        .button("§cClear All Abilities")
        .button("§7Back");
    
    try {
        const response = await form.show(player);
        
        if (response.canceled) {
            return;
        }
        
        switch (response.selection) {
            case 0:
                system.runTimeout(() => showCameraBlackoutConfig(player, location, dimensionId, currentConfig), 1);
                break;
                
            case 1:
                system.runTimeout(() => showEmitSoundConfig(player, location, dimensionId, currentConfig), 1);
                break;
                
            case 2:
                currentConfig.abilities = [];
                setWaypointData(location, dimensionId, currentConfig);
                player.sendMessage("§c[Pathing] All abilities cleared");
                system.runTimeout(() => showWaypointAbilitiesMenu(player, location, dimensionId, currentConfig), 1);
                break;
                
            case 3:
                if (state) {
                    system.runTimeout(() => showBlockSelectorMenu(player), 1);
                }
                break;
        }
    } catch (e) {
        console.warn("[Pathing] Error showing abilities menu:", e);
    }
}


async function showCameraBlackoutConfig(player, location, dimensionId, currentConfig) {
    const abilities = currentConfig.abilities || [];
    const existingBlackout = abilities.find(a => a.type === ABILITY_TYPES.CAMERA_BLACKOUT);
    
    const form = new ModalFormData()
        .title("§l§aCamera Blackout")
        .toggle("Enable Camera Blackout", existingBlackout ? true : false)
        .slider("Duration (seconds)", 1, 30, 1, existingBlackout?.duration || 5)
        .textField("Camera ID (optional)", "Leave empty for all cameras", existingBlackout?.cameraId || "");
    
    try {
        const response = await form.show(player);
        
        if (response.canceled) {
            system.runTimeout(() => showWaypointAbilitiesMenu(player, location, dimensionId, currentConfig), 1);
            return;
        }
        
        const [enabled, duration, cameraId] = response.formValues;

        currentConfig.abilities = (currentConfig.abilities || []).filter(a => a.type !== ABILITY_TYPES.CAMERA_BLACKOUT);
        
        if (enabled) {
            currentConfig.abilities.push({
                type: ABILITY_TYPES.CAMERA_BLACKOUT,
                duration: duration,
                cameraId: cameraId || null
            });
            player.sendMessage(`§a[Pathing] Camera blackout enabled (${duration}s)`);
        } else {
            player.sendMessage("§7[Pathing] Camera blackout disabled");
        }
        
        setWaypointData(location, dimensionId, currentConfig);
        system.runTimeout(() => showWaypointAbilitiesMenu(player, location, dimensionId, currentConfig), 1);
    } catch (e) {
        console.warn("[Pathing] Error in camera blackout config:", e);
    }
}


async function showEmitSoundConfig(player, location, dimensionId, currentConfig) {
    const abilities = currentConfig.abilities || [];
    const existingSound = abilities.find(a => a.type === ABILITY_TYPES.EMIT_SOUND);
    
    const soundOptions = [
        "ambient.cave",
        "mob.zombie.say",
        "random.door_open",
        "random.door_close",
        "mob.ghast.scream",
        "random.glass",
        "note.bass",
        "note.pling"
    ];
    
    const currentSoundIndex = existingSound ? soundOptions.indexOf(existingSound.soundId) : 0;
    
    const form = new ModalFormData()
        .title("§l§aEmit Sound")
        .toggle("Enable Sound", existingSound ? true : false)
        .dropdown("Sound", soundOptions, currentSoundIndex >= 0 ? currentSoundIndex : 0)
        .slider("Volume", 0.1, 2.0, 0.1, existingSound?.volume || 1.0)
        .slider("Pitch", 0.5, 2.0, 0.1, existingSound?.pitch || 1.0);
    
    try {
        const response = await form.show(player);
        
        if (response.canceled) {
            system.runTimeout(() => showWaypointAbilitiesMenu(player, location, dimensionId, currentConfig), 1);
            return;
        }
        
        const [enabled, soundIndex, volume, pitch] = response.formValues;

        currentConfig.abilities = (currentConfig.abilities || []).filter(a => a.type !== ABILITY_TYPES.EMIT_SOUND);
        
        if (enabled) {
            currentConfig.abilities.push({
                type: ABILITY_TYPES.EMIT_SOUND,
                soundId: soundOptions[soundIndex],
                volume: volume,
                pitch: pitch
            });
            player.sendMessage(`§a[Pathing] Sound enabled: ${soundOptions[soundIndex]}`);
        } else {
            player.sendMessage("§7[Pathing] Sound disabled");
        }
        
        setWaypointData(location, dimensionId, currentConfig);
        system.runTimeout(() => showWaypointAbilitiesMenu(player, location, dimensionId, currentConfig), 1);
    } catch (e) {
        console.warn("[Pathing] Error in emit sound config:", e);
    }
}


export function executeWaypointAbilities(entity, waypoint, dimension) {
    const abilities = waypoint.abilities || [];
    
    for (const ability of abilities) {
        switch (ability.type) {
            case ABILITY_TYPES.CAMERA_BLACKOUT:
                executeCameraBlackout(ability, dimension);
                break;
                
            case ABILITY_TYPES.EMIT_SOUND:
                executeEmitSound(ability, waypoint.location, dimension);
                break;
        }
    }
}


function executeCameraBlackout(ability, dimension) {
    const durationTicks = (ability.duration || 5) * 20;

    for (const player of dimension.getPlayers()) {
        try {

            const isViewingCamera = player.hasTag("fr:viewing_camera");
            
            if (isViewingCamera) {

                if (ability.cameraId) {
                    const viewingCameraId = player.getDynamicProperty("fr:current_camera_id");
                    if (viewingCameraId !== ability.cameraId) continue;
                }

                player.addTag("fr:camera_blackout");
                player.runCommand(`title @s title §0`);
                player.runCommand(`title @s subtitle §8[SIGNAL LOST]`);

                system.runTimeout(() => {
                    try {
                        player.removeTag("fr:camera_blackout");
                        player.runCommand(`title @s clear`);
                    } catch {}
                }, durationTicks);
            }
        } catch (e) {
            console.warn("[Pathing] Error executing camera blackout:", e);
        }
    }
}


function executeEmitSound(ability, location, dimension) {
    try {
        dimension.playSound(ability.soundId || "ambient.cave", location, {
            volume: ability.volume || 1.0,
            pitch: ability.pitch || 1.0
        });
    } catch (e) {
        console.warn("[Pathing] Error playing sound:", e);
    }
}





export async function showNightTimeConfigMenu(player, entity) {
    const config = loadNightTimeConfig(entity) || {};

    let bodyText = "§7Configure when the animatronic starts moving each night.\n\n";
    
    for (let night = 1; night <= MAX_NIGHTS; night++) {
        const nightConfig = config[night];
        if (nightConfig && nightConfig.enabled) {
            const timeStr = ticksToTimeString(nightConfig.moveTime);
            bodyText += `§aNight ${night}: §f${timeStr}\n`;
        } else {
            bodyText += `§7Night ${night}: §8Disabled\n`;
        }
    }
    
    const form = new ActionFormData()
        .title("§l§aNight Time Config")
        .body(bodyText)
        .button("§eNight 1")
        .button("§eNight 2")
        .button("§eNight 3")
        .button("§eNight 4")
        .button("§eNight 5")
        .button("§eNight 6")
        .button("§eNight 7")
        .button("§cClear All")
        .button("§7Back");
    
    try {
        const response = await form.show(player);
        
        if (response.canceled) return;
        
        if (response.selection >= 0 && response.selection <= 6) {

            const nightNumber = response.selection + 1;
            system.runTimeout(() => showNightTimeEditMenu(player, entity, nightNumber), 1);
        } else if (response.selection === 7) {

            for (let night = 1; night <= MAX_NIGHTS; night++) {
                delete config[night];
            }
            entity.setDynamicProperty("fr:night_times", JSON.stringify(config));
            nightTimeConfig.set(entity.id, config);
            player.sendMessage("§c[Pathing] All night times cleared");
            system.runTimeout(() => showNightTimeConfigMenu(player, entity), 1);
        }

    } catch (e) {
        console.warn("[Pathing] Error showing night time config:", e);
    }
}


async function showNightTimeEditMenu(player, entity, nightNumber) {
    const config = loadNightTimeConfig(entity) || {};
    const nightConfig = config[nightNumber] || { moveTime: 0, enabled: false };

    const timeOptions = [
        "12:00 AM (Midnight)",
        "12:30 AM",
        "1:00 AM",
        "1:30 AM",
        "2:00 AM",
        "2:30 AM",
        "3:00 AM",
        "3:30 AM",
        "4:00 AM",
        "4:30 AM",
        "5:00 AM",
        "5:30 AM",
        "6:00 AM"
    ];

    const currentIndex = Math.min(12, Math.floor(nightConfig.moveTime / 500));
    
    const form = new ModalFormData()
        .title(`§l§aNight ${nightNumber} Config`)
        .toggle("Enable for this night", nightConfig.enabled)
        .dropdown("Start moving at", timeOptions, currentIndex);
    
    try {
        const response = await form.show(player);
        
        if (response.canceled) {
            system.runTimeout(() => showNightTimeConfigMenu(player, entity), 1);
            return;
        }
        
        const [enabled, timeIndex] = response.formValues;

        const moveTime = timeIndex * 500;
        
        if (enabled) {
            config[nightNumber] = {
                moveTime: moveTime,
                enabled: true
            };
            const timeStr = timeOptions[timeIndex];
            player.sendMessage(`§a[Pathing] Night ${nightNumber} set to start at ${timeStr}`);
        } else {
            config[nightNumber] = {
                moveTime: 0,
                enabled: false
            };
            player.sendMessage(`§7[Pathing] Night ${nightNumber} disabled`);
        }
        
        entity.setDynamicProperty("fr:night_times", JSON.stringify(config));
        nightTimeConfig.set(entity.id, config);
        
        system.runTimeout(() => showNightTimeConfigMenu(player, entity), 1);
    } catch (e) {
        console.warn("[Pathing] Error in night time edit:", e);
    }
}


function ticksToTimeString(ticks) {

    const totalMinutes = Math.floor(ticks / 500) * 30;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    const displayHour = hours === 0 ? 12 : hours;
    const ampm = hours < 6 ? "AM" : "AM";
    
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}


export function checkAndStartPathing(entity) {
    const config = loadNightTimeConfig(entity);
    if (!config) return false;


    const currentTime = world.getTimeOfDay();

    if (currentTime < NIGHT_START || currentTime >= NIGHT_END) {
        return false;
    }


    const nightProgress = currentTime - NIGHT_START;

    for (let night = 1; night <= MAX_NIGHTS; night++) {
        const nightConfig = config[night];
        if (nightConfig && nightConfig.enabled) {
            if (nightProgress >= nightConfig.moveTime) {
                return true;
            }
        }
    }
    
    return false;
}





function handleWaypointPlacementInteraction(event) {
    const { player, block, itemStack } = event;

    if (!isInBlockSelectorMode(player)) return;

    if (!itemStack || itemStack.typeId !== "fr:faz-diver_repairman") return;
    
    const state = getBlockSelectorState(player);
    if (!state || !state.active) return;

    state.currentPosition = {
        x: block.location.x,
        y: block.location.y,
        z: block.location.z
    };

    const result = placeWaypointAtSelector(player);
    
    if (result) {

        system.runTimeout(() => showWaypointConfigMenu(player, result), 5);
    }
}

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
    handleWaypointPlacementInteraction(event);
});




system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (isInBlockSelectorMode(player)) {
            updateSelectorPosition(player);
        }
    }
}, 2);

system.runInterval(() => {


}, 20);

system.runInterval(() => {
    cleanupOrphanedSessions();
}, 1200);




const visualizationStates = new Map();

let visualizationIntervalId = null;

const VISUALIZATION_CONFIG = {
    PARTICLE_INTERVAL_TICKS: 10,
    HIGHLIGHT_DISTANCE: 5,
    LINE_PARTICLE_SPACING: 1.5,
    CUBE_PARTICLE_COUNT: 8,
    HIGHLIGHT_PARTICLE_TYPE: "minecraft:villager_happy",
    NORMAL_PARTICLE_TYPE: "minecraft:endrod",
    LINE_PARTICLE_TYPE: "minecraft:endrod"
};


export function startWaypointVisualization(statueId, dimension, playerId) {

    if (visualizationStates.has(statueId)) {
        console.log(`[Visualization] Already visualizing statue ${statueId}`);
        return false;
    }

    const waypoints = getWaypointsForStatue(statueId);
    if (waypoints.length === 0) {
        console.log(`[Visualization] No waypoints to visualize for statue ${statueId}`);
        return false;
    }

    visualizationStates.set(statueId, {
        isActive: true,
        statueId: statueId,
        playerId: playerId,
        dimensionId: dimension.id,
        highlightedWaypointIndex: null,
        lastUpdateTick: 0
    });

    if (visualizationIntervalId === null) {
        visualizationIntervalId = system.runInterval(() => {
            processWaypointVisualization();
        }, VISUALIZATION_CONFIG.PARTICLE_INTERVAL_TICKS);
    }
    
    console.log(`[Visualization] Started visualization for statue ${statueId} with ${waypoints.length} waypoints`);
    return true;
}


export function stopWaypointVisualization(statueId) {
    if (!visualizationStates.has(statueId)) {
        return;
    }
    
    visualizationStates.delete(statueId);
    console.log(`[Visualization] Stopped visualization for statue ${statueId}`);

    if (visualizationStates.size === 0 && visualizationIntervalId !== null) {
        system.clearRun(visualizationIntervalId);
        visualizationIntervalId = null;
        console.log(`[Visualization] Cleared visualization interval - no active visualizations`);
    }
}


export function stopAllWaypointVisualizations() {
    const statueIds = Array.from(visualizationStates.keys());
    for (const statueId of statueIds) {
        stopWaypointVisualization(statueId);
    }
}


export function isVisualizationActive(statueId) {
    const state = visualizationStates.get(statueId);
    return state?.isActive === true;
}


export function getVisualizationState(statueId) {
    return visualizationStates.get(statueId) || null;
}


function processWaypointVisualization() {
    if (visualizationStates.size === 0) return;
    
    for (const [statueId, state] of visualizationStates) {
        if (!state.isActive) continue;
        
        try {
            const waypoints = getWaypointsForStatue(statueId);
            if (waypoints.length === 0) {
                stopWaypointVisualization(statueId);
                continue;
            }

            const dimName = state.dimensionId.replace("minecraft:", "");
            const dimension = world.getDimension(dimName);

            let player = null;
            for (const p of world.getAllPlayers()) {
                if (p.id === state.playerId) {
                    player = p;
                    break;
                }
            }

            for (let i = 0; i < waypoints.length; i++) {
                const wp = waypoints[i];
                const isHighlighted = checkWaypointProximity(wp.location, player);

                if (isHighlighted) {
                    state.highlightedWaypointIndex = i;
                }

                spawnWaypointMarkerParticles(dimension, wp.location, isHighlighted, wp.order);
            }

            drawRoutePath(dimension, waypoints);
            
        } catch (e) {
            console.warn(`[Visualization] Error processing visualization for statue ${statueId}:`, e);
        }
    }
}


function spawnWaypointMarkerParticles(dimension, location, isHighlighted, order) {
    const particleType = isHighlighted 
        ? VISUALIZATION_CONFIG.HIGHLIGHT_PARTICLE_TYPE 
        : VISUALIZATION_CONFIG.NORMAL_PARTICLE_TYPE;
    
    const x = location.x;
    const y = location.y;
    const z = location.z;
    
    try {

        const offsets = [
            { dx: 0, dy: 0, dz: 0 },
            { dx: 0, dy: 0.5, dz: 0 },
            { dx: 0, dy: 1.0, dz: 0 },
            { dx: 0, dy: 1.5, dz: 0 },
        ];

        if (isHighlighted) {
            offsets.push(
                { dx: -0.3, dy: 0.5, dz: -0.3 },
                { dx: 0.3, dy: 0.5, dz: -0.3 },
                { dx: -0.3, dy: 0.5, dz: 0.3 },
                { dx: 0.3, dy: 0.5, dz: 0.3 }
            );
        }
        
        for (const offset of offsets) {
            dimension.spawnParticle(particleType, {
                x: x + offset.dx,
                y: y + offset.dy,
                z: z + offset.dz
            });
        }

        if (isHighlighted) {

            const time = Date.now() / 1000;
            const angle = (time * 2) % (Math.PI * 2);
            const radius = 0.5;
            
            dimension.spawnParticle(particleType, {
                x: x + Math.cos(angle) * radius,
                y: y + 1.0,
                z: z + Math.sin(angle) * radius
            });
            
            dimension.spawnParticle(particleType, {
                x: x + Math.cos(angle + Math.PI) * radius,
                y: y + 1.0,
                z: z + Math.sin(angle + Math.PI) * radius
            });
        }
        
    } catch (e) {

    }
}


function drawRoutePath(dimension, waypoints) {
    if (waypoints.length < 2) return;
    
    const particleType = VISUALIZATION_CONFIG.LINE_PARTICLE_TYPE;
    const spacing = VISUALIZATION_CONFIG.LINE_PARTICLE_SPACING;
    
    try {
        for (let i = 0; i < waypoints.length - 1; i++) {
            const from = waypoints[i].location;
            const to = waypoints[i + 1].location;

            const points = getLinePoints(from, to, spacing);

            for (let j = 1; j < points.length - 1; j++) {
                const point = points[j];
                dimension.spawnParticle(particleType, {
                    x: point.x,
                    y: point.y + 0.5,
                    z: point.z
                });
            }
        }
    } catch (e) {

    }
}


function getLinePoints(from, to, spacing) {
    const points = [];
    
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (distance < spacing) {
        return [from, to];
    }
    
    const numPoints = Math.ceil(distance / spacing);
    
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        points.push({
            x: from.x + dx * t,
            y: from.y + dy * t,
            z: from.z + dz * t
        });
    }
    
    return points;
}


function checkWaypointProximity(waypointLocation, player) {
    if (!player) return false;
    
    try {
        const playerLoc = player.location;
        const dx = waypointLocation.x - playerLoc.x;
        const dy = waypointLocation.y - playerLoc.y;
        const dz = waypointLocation.z - playerLoc.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        return distance <= VISUALIZATION_CONFIG.HIGHLIGHT_DISTANCE;
    } catch {
        return false;
    }
}


export function highlightWaypoint(statueId, waypointIndex) {
    const state = visualizationStates.get(statueId);
    if (state) {
        state.highlightedWaypointIndex = waypointIndex;
    }
}


export function getHighlightedWaypointIndex(statueId) {
    const state = visualizationStates.get(statueId);
    return state?.highlightedWaypointIndex ?? null;
}




const routeTestSessions = new Map();

let nextRouteTestSessionId = 1;




export function startRouteTest(entity, player) {
    const statueId = entity.getDynamicProperty("fr:statue_id");
    if (!statueId) {
        player.sendMessage("§c[Route Test] §7No statue ID configured!");
        return null;
    }

    refreshWaypointCache(statueId);
    const waypoints = getWaypointsForStatue(statueId);
    
    if (waypoints.length === 0) {
        player.sendMessage("§c[Route Test] §7No waypoints configured!");
        return null;
    }

    let platformLocation = null;
    try {
        const platformData = entity.getDynamicProperty("fr:platform_location");
        if (platformData) {
            platformLocation = JSON.parse(platformData);
        }
    } catch {}
    
    if (!platformLocation) {

        platformLocation = { ...entity.location };
    }
    
    const dimension = entity.dimension;
    const entityRotation = entity.getRotation();
    const rawRotation = entityRotation ? entityRotation.y : 0;

    let variantIndex = 0;
    try {
        variantIndex = entity.getDynamicProperty("fr:variant_index") || 0;
    } catch {}

    let animatronic;
    try {

        const animatronicType = getAnimatronicTypeForStatue(entity.typeId);
        animatronic = dimension.spawnEntity(animatronicType, platformLocation);

        animatronic.setDynamicProperty("fr:statue_id", statueId);
        animatronic.setDynamicProperty("fr:platform_location", JSON.stringify(platformLocation));
        animatronic.setDynamicProperty("fr:variant_index", variantIndex);

        if (variantIndex > 0) {
            system.run(() => {
                try {
                    animatronic.triggerEvent(`fr:set_variant_${variantIndex}`);
                } catch {}
            });
        }

        animatronic.addTag("fr:route_test_mode");

        entity.remove();
        
    } catch (e) {
        console.warn("[Route Test] Failed to spawn animatronic:", e);
        player.sendMessage("§c[Route Test] §7Failed to spawn animatronic!");
        return null;
    }

    const sessionId = `route_test_${nextRouteTestSessionId++}`;
    
    routeTestSessions.set(sessionId, {
        sessionId: sessionId,
        statueId: statueId,
        entityId: animatronic.id,
        entityType: animatronic.typeId,
        dimensionId: dimension.id,
        currentWaypointIndex: 0,
        state: "moving",
        stateStartTime: Date.now(),
        platformLocation: platformLocation,
        platformRotation: rawRotation,
        variantIndex: variantIndex,
        playerId: player.id,
        playerName: player.name,
        visitedWaypoints: [],
        isCancelled: false,
        totalWaypoints: waypoints.length
    });
    
    player.sendMessage(`§a[Route Test] §7Starting test with ${waypoints.length} waypoints...`);
    player.sendMessage("§7Press §eSNEAK + INTERACT§7 on the animatronic to cancel.");

    const firstWaypoint = waypoints[0];
    spawnLureAtLocation(dimension, firstWaypoint.location);
    
    console.log(`[Route Test] Started session ${sessionId} for statue ${statueId}`);
    return sessionId;
}


export function cancelRouteTest(sessionId, reason = "User cancelled") {
    const session = routeTestSessions.get(sessionId);
    if (!session) return;
    
    session.isCancelled = true;
    session.state = "cancelled";
    
    console.log(`[Route Test] Cancelled session ${sessionId}: ${reason}`);

    const animatronic = findEntityById(session.entityId, session.entityType, session.dimensionId);
    
    if (animatronic) {

        cleanupLuresNearEntity(animatronic);

        returnAnimatronicToPlatform(session, animatronic, reason);
    } else {

        routeTestSessions.delete(sessionId);
    }

    notifyRouteTestPlayer(session, `§c[Route Test] §7Test cancelled: ${reason}`);
}


export function cancelRouteTestForEntity(entityId) {
    for (const [sessionId, session] of routeTestSessions) {
        if (session.entityId === entityId) {
            cancelRouteTest(sessionId, "Entity interaction");
            return true;
        }
    }
    return false;
}


export function isEntityInRouteTest(entityId) {
    for (const session of routeTestSessions.values()) {
        if (session.entityId === entityId && !session.isCancelled) {
            return true;
        }
    }
    return false;
}


export function getRouteTestSession(entityId) {
    for (const session of routeTestSessions.values()) {
        if (session.entityId === entityId) {
            return session;
        }
    }
    return null;
}


function returnAnimatronicToPlatform(session, animatronic, reason = "Test complete") {
    session.state = "returning";
    session.stateStartTime = Date.now();
    
    const platformLoc = session.platformLocation;
    const dimension = animatronic.dimension;

    cleanupLuresNearEntity(animatronic);

    try {
        animatronic.teleport(platformLoc);

        try {
            animatronic.triggerEvent("fr:set_pose_0");
        } catch {}

        system.runTimeout(() => {
            try {

                const statueType = getStatueTypeForAnimatronic(animatronic.typeId);

                const statue = dimension.spawnEntity(statueType, platformLoc);

                statue.setDynamicProperty("fr:statue_id", session.statueId);
                statue.setDynamicProperty("fr:platform_location", JSON.stringify(platformLoc));
                statue.setDynamicProperty("fr:variant_index", session.variantIndex);

                system.run(() => {
                    try {
                        statue.teleport(statue.location, { 
                            rotation: { x: 0, y: session.platformRotation || 0 } 
                        });
                    } catch {}
                });

                if (session.variantIndex > 0) {
                    system.run(() => {
                        try {
                            statue.triggerEvent(`fr:set_variant_${session.variantIndex}`);
                        } catch {}
                    });
                }

                animatronic.remove();

                const visitedCount = session.visitedWaypoints.length;
                const totalCount = session.totalWaypoints;
                notifyRouteTestPlayer(session, `§a[Route Test] §7${reason}. Visited ${visitedCount}/${totalCount} waypoints.`);

                routeTestSessions.delete(session.sessionId);
                
            } catch (e) {
                console.warn("[Route Test] Error restoring statue:", e);
                animatronic.remove();
                routeTestSessions.delete(session.sessionId);
            }
        }, 20);
        
    } catch (e) {
        console.warn("[Route Test] Error returning to platform:", e);
        routeTestSessions.delete(session.sessionId);
    }
}


function notifyRouteTestPlayer(session, message) {
    for (const player of world.getAllPlayers()) {
        if (player.id === session.playerId || player.name === session.playerName) {
            player.sendMessage(message);
            return;
        }
    }
}


function processRouteTests() {
    if (routeTestSessions.size === 0) return;
    
    for (const [sessionId, session] of routeTestSessions) {
        if (session.isCancelled) continue;
        
        try {
            processRouteTestSession(session);
        } catch (e) {
            console.warn(`[Route Test] Error processing session ${sessionId}:`, e);
            cancelRouteTest(sessionId, "Processing error");
        }
    }
}


function processRouteTestSession(session) {

    const animatronic = findEntityById(session.entityId, session.entityType, session.dimensionId);
    
    if (!animatronic) {
        console.log(`[Route Test] Animatronic not found for session ${session.sessionId}`);
        routeTestSessions.delete(session.sessionId);
        return;
    }

    const waypoints = getWaypointsForStatue(session.statueId);
    if (waypoints.length === 0) {
        cancelRouteTest(session.sessionId, "No waypoints");
        return;
    }
    
    const currentWaypoint = waypoints[session.currentWaypointIndex];
    if (!currentWaypoint) {

        returnAnimatronicToPlatform(session, animatronic, "Test complete");
        return;
    }
    
    const now = Date.now();
    const stateElapsed = now - session.stateStartTime;
    
    switch (session.state) {
        case "moving":

            const distance = getDistance(animatronic.location, currentWaypoint.location);
            
            if (distance <= PATHING_CONFIG.ARRIVAL_DISTANCE) {

                session.state = "posing";
                session.stateStartTime = now;
                session.visitedWaypoints.push(session.currentWaypointIndex);

                applyWaypointPose(animatronic, currentWaypoint);

                removeLureAtLocation(animatronic.dimension, currentWaypoint.location);
                
                console.log(`[Route Test] Arrived at waypoint ${session.currentWaypointIndex + 1}/${waypoints.length}`);
                notifyRouteTestPlayer(session, `§a[Route Test] §7Waypoint ${session.currentWaypointIndex + 1}/${waypoints.length} reached`);
            } else if (stateElapsed > PATHING_CONFIG.STUCK_TIMEOUT_MS) {

                console.log(`[Route Test] Stuck, teleporting to waypoint ${session.currentWaypointIndex}`);
                animatronic.teleport(currentWaypoint.location);
            }
            break;
            
        case "posing":

            if (stateElapsed >= 500) {
                session.state = "waiting";
                session.stateStartTime = now;
            }
            break;
            
        case "waiting":

            const waitTimeTicks = currentWaypoint.waitTime || DEFAULT_WAIT_TIME;
            const waitTimeMs = (waitTimeTicks / 20) * 1000;
            
            if (stateElapsed >= waitTimeMs) {

                session.currentWaypointIndex++;
                
                if (session.currentWaypointIndex >= waypoints.length) {

                    returnAnimatronicToPlatform(session, animatronic, "Test complete");
                } else {

                    session.state = "moving";
                    session.stateStartTime = now;
                    
                    const nextWaypoint = waypoints[session.currentWaypointIndex];
                    spawnLureAtLocation(animatronic.dimension, nextWaypoint.location);

                    try {
                        animatronic.triggerEvent("fr:start_walking");
                    } catch {}
                }
            }
            break;
            
        case "returning":

            break;
            
        case "completed":
        case "cancelled":

            routeTestSessions.delete(session.sessionId);
            break;
    }
}


function applyWaypointPose(animatronic, waypoint) {
    const poseIndex = waypoint.pose || 0;
    
    try {

        animatronic.triggerEvent("fr:stop_walking");
    } catch {}
    
    try {

        animatronic.triggerEvent(`fr:set_pose_${poseIndex}`);
    } catch (e) {
        console.warn(`[Route Test] Failed to apply pose ${poseIndex}:`, e);
    }

    if (waypoint.rotation !== undefined && waypoint.rotation !== 0) {
        try {
            animatronic.teleport(animatronic.location, {
                rotation: { x: 0, y: waypoint.rotation }
            });
        } catch {}
    }

    if (waypoint.abilities && waypoint.abilities.length > 0) {
        executeWaypointAbilities(animatronic, waypoint, animatronic.dimension);
    }
}


export function getActiveRouteTests() {
    return routeTestSessions;
}


export function getRouteTestDebugInfo() {
    const info = {
        activeSessions: routeTestSessions.size,
        sessions: []
    };
    
    for (const [sessionId, session] of routeTestSessions) {
        info.sessions.push({
            id: sessionId,
            state: session.state,
            currentWaypoint: session.currentWaypointIndex,
            totalWaypoints: session.totalWaypoints,
            visitedCount: session.visitedWaypoints.length,
            isCancelled: session.isCancelled
        });
    }
    
    return info;
}

system.runInterval(() => {
    processRouteTests();
}, 10);




export {
    waypointRegistry,
    activePathing,
    blockSelectorMode,
    nightTimeConfig,
    walkingEntities,
    temporaryStatues,
    simulationSessions,
    visualizationStates,
    routeTestSessions,
    PATHING_CONFIG,
    STATUE_TYPES,
    ANIMATRONIC_TYPES,
    ABILITY_TYPES,
    DETECTION_CONFIG,
    VISUALIZATION_CONFIG,
    MAX_SELECTOR_DISTANCE,
    MAX_WAYPOINTS_PER_STATUE,
    MAX_NIGHTS,
    NIGHT_START,
    NIGHT_END,
    MIN_WAIT_TIME,
    MAX_WAIT_TIME,
    DEFAULT_WAIT_TIME
};
