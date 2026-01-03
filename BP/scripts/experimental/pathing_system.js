
import { world, system, BlockPermutation } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { walkEntityTo } from "../statue_editor.js";

function getWaypointKey(location, dimensionId) {
    const x = Math.floor(location.x);
    const y = Math.floor(location.y);
    const z = Math.floor(location.z);
    const dimShort = dimensionId.replace("minecraft:", "");
    return `fr:wp_${x}_${y}_${z}_${dimShort}`;
}

function getWaypointData(location, dimensionId) {
    const key = getWaypointKey(location, dimensionId);
    const data = world.getDynamicProperty(key);
    const defaultData = { order: 0, pose: 0, rotation: 0, waitTime: 0, linkedStatueId: 0 };
    if (!data) {
        return defaultData;
    }
    try {
        const parsed = JSON.parse(data);

        return { ...defaultData, ...parsed };
    } catch {
        return defaultData;
    }
}

function setWaypointData(location, dimensionId, data) {
    const key = getWaypointKey(location, dimensionId);
    world.setDynamicProperty(key, JSON.stringify(data));
}

function removeWaypointData(location, dimensionId) {
    const key = getWaypointKey(location, dimensionId);
    world.setDynamicProperty(key, undefined);
}

function getWaypointsForStatue(statueId) {
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
                    waitTime: wpData.waitTime
                });
            }
        } catch {}
    }

    waypoints.sort((a, b) => a.order - b.order);
    return waypoints;
}

const waypointRegistry = new Map();
const activePathing = new Map();
const temporaryStatues = new Map();
const waypointLinkMode = new Map();
let nextPathingSessionId = 1;
let nextStatueId = 1;
const simulationSessions = new Map();

const PATHING_CONFIG = {
    STUCK_TIMEOUT_MS: 60000,
    STUCK_CHECK_INTERVAL_MS: 8000,
    MIN_PROGRESS_DISTANCE: 0.3,
    MAX_RETRIES: 3,
    ARRIVAL_DISTANCE: 3.0,
    TELEPORT_FALLBACK: true
};

const DETECTION_CONFIG = {
    BASE_RANGE: 20,
    SNEAK_RANGE: 8,
    SNEAK_CHANCE_REDUCTION: 0.7,
    CHECK_INTERVAL_TICKS: 20,
    CHASE_UPDATE_TICKS: 5,
    CHASE_TIMEOUT_MS: 30000,
    CHASE_ARRIVAL_DISTANCE: 2.0
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

const particleIntervals = new Map();

const DEFAULT_WAIT_TIME = 2400;
const MIN_WAIT_TIME = 600;
const MAX_WAIT_TIME = 7200;

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent("fr:waypoint_interaction", {
        onPlayerInteract: (event) => {
            const { block, player } = event;
            if (!block || !player) return;

            try {
                const heldItem = getHeldItem(player);

                if (heldItem?.typeId === "fr:path_marker") {

                    showWaypointConfigUI(player, block);
                }
            } catch (e) {
                console.warn("[Pathing] Error in waypoint interaction:", e);
            }
        },

        onPlayerDestroy: (event) => {
            const { block, player } = event;
            if (!block) return;

            removeWaypointFromRegistry(block.location, block.dimension.id);

            if (player) {
                player.sendMessage(`§c[Pathing] Waypoint removed`);
            }
        }
    });
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
    try {
        const { brokenBlockPermutation, block } = event;

        if (brokenBlockPermutation.type.id === "fr:waypoint") {

            const key = getWaypointKey(block.location, block.dimension.id);
            const existingData = world.getDynamicProperty(key);

            if (existingData) {

                console.log(`[Pathing] Backup cleanup for waypoint at ${block.location.x}, ${block.location.y}, ${block.location.z}`);
                removeWaypointFromRegistry(block.location, block.dimension.id);
            }
        }
    } catch (e) {
        console.warn("[Pathing] Error in block break backup handler:", e);
    }
});

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
    itemComponentRegistry.registerCustomComponent("fr:path_marker_interaction", {
        onUseOn: (event) => {
            const { source: player, block, blockFace } = event;
            if (!player || !block) return;

            try {

                if (blockFace !== "Up") return;

                const above = block.above();
                if (!above || !above.isAir) return;

                const waypointPerm = BlockPermutation.resolve("fr:waypoint");
                above.setPermutation(waypointPerm);

                player.playSound("dig.stone");

                spawnWaypointParticle(above.dimension, above.location);

                const linkData = waypointLinkMode.get(player.id);
                if (linkData) {

                    const existingWaypoints = getWaypointsForStatue(linkData.statueId);
                    const nextOrder = existingWaypoints.length;

                    setWaypointData(above.location, above.dimension.id, {
                        order: nextOrder,
                        pose: 0,
                        rotation: 0,
                        waitTime: 0,
                        linkedStatueId: linkData.statueId
                    });

                    refreshWaypointCache(linkData.statueId);
                    player.sendMessage(`§a[Pathing] Waypoint #${nextOrder} linked to ${linkData.entityName}`);
                }

            } catch (e) {
                console.warn("[Pathing] Error placing waypoint:", e);
            }
        }
    });
});

function getHeldItem(player) {
    try {
        const eq = player.getComponent("minecraft:equippable");
        return eq?.getEquipment("Mainhand");
    } catch {
        return undefined;
    }
}

function spawnWaypointParticle(dimension, location) {
    try {
        dimension.spawnParticle("fr:waypoint_marker", {
            x: location.x + 0.5,
            y: location.y + 0.5,
            z: location.z + 0.5
        });
    } catch (e) {
        console.warn("[Pathing] Error spawning particle:", e);
    }
}

function getOrCreateStatueId(entity) {

    let statueId = entity.getDynamicProperty("fr:statue_id");

    if (!statueId) {

        let counter = world.getDynamicProperty("fr:statue_id_counter") || 1;
        statueId = counter;

        entity.setDynamicProperty("fr:statue_id", statueId);

        world.setDynamicProperty("fr:statue_id_counter", counter + 1);

        console.log(`[Pathing] Assigned new statue ID ${statueId} to ${entity.typeId}`);
    }

    return statueId;
}

function getEntityDisplayName(entity) {

    const nameTag = entity.nameTag;
    if (nameTag && nameTag.trim() !== "") {
        return nameTag;
    }

    const typeId = entity.typeId.replace("fr:", "").replace(/_/g, " ");
    return typeId.charAt(0).toUpperCase() + typeId.slice(1);
}

function isLinkableEntity(entity) {
    return STATUE_TYPES.includes(entity.typeId) || ANIMATRONIC_TYPES.includes(entity.typeId);
}

world.afterEvents.entityHitEntity.subscribe((event) => {
    try {
        const player = event.damagingEntity;
        const target = event.hitEntity;

        if (player.typeId !== "minecraft:player") return;

        const heldItem = getHeldItem(player);
        if (heldItem?.typeId !== "fr:path_marker") return;

        if (!isLinkableEntity(target)) return;

        const statueId = getOrCreateStatueId(target);
        const entityName = getEntityDisplayName(target);

        const currentLink = waypointLinkMode.get(player.id);
        if (currentLink && currentLink.statueId === statueId) {

            waypointLinkMode.delete(player.id);
            player.sendMessage(`§c[Pathing] Unlinked from ${entityName} (ID: ${statueId})`);
            player.sendMessage(`§7You can now place waypoints without auto-linking.`);
        } else {

            waypointLinkMode.set(player.id, {
                statueId: statueId,
                entityId: target.id,
                entityType: target.typeId,
                entityName: entityName
            });

            const existingWaypoints = getWaypointsForStatue(statueId);

            player.sendMessage(`§a[Pathing] §lLinked to ${entityName} (ID: ${statueId})`);
            player.sendMessage(`§7Current waypoints: ${existingWaypoints.length}`);
            player.sendMessage(`§7Place waypoints with the path marker - they will auto-link!`);
            player.sendMessage(`§7Hit the statue again to unlink.`);
        }

    } catch (e) {
        console.warn("[Pathing] Error in entity hit:", e);
    }
});

world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    try {
        const player = event.player;
        const target = event.target;

        const heldItem = getHeldItem(player);
        if (heldItem?.typeId !== "fr:path_marker") return;

        if (!isLinkableEntity(target)) return;

        const statueId = getOrCreateStatueId(target);
        const entityName = getEntityDisplayName(target);

        showStatueLinkUI(player, target, statueId, entityName);

    } catch (e) {
        console.warn("[Pathing] Error in entity interaction:", e);
    }
});

function showStatueLinkUI(player, entity, statueId, entityName) {
    const currentLink = waypointLinkMode.get(player.id);
    const isLinked = currentLink && currentLink.statueId === statueId;
    const existingWaypoints = getWaypointsForStatue(statueId);

    const form = new ActionFormData();
    form.title(`§l§6${entityName}`);
    form.body(
        `§7Statue ID: §f${statueId}\n` +
        `§7Waypoints: §f${existingWaypoints.length}\n` +
        `§7Status: ${isLinked ? '§aLinked' : '§7Not linked'}\n\n` +
        `§eSelect an action:`
    );

    if (isLinked) {
        form.button("§cUnlink from this statue", "textures/ui/cancel");
    } else {
        form.button("§aLink to this statue", "textures/ui/check");
    }

    form.button("§bView Waypoints", "textures/ui/magnifyingGlass");
    form.button("§cClear All Waypoints", "textures/ui/trash");
    form.button("§eStart Pathing (Test)", "textures/ui/fly_button");
    form.button("§aStart Simulation (10 WP)", "textures/ui/debug_glyph_color");
    form.button("§dSet Custom ID", "textures/ui/editIcon");
    form.button("§6Debug & Cleanup", "textures/ui/settings_glyph_color_2x");

    form.show(player).then((response) => {
        if (response.canceled) return;

        switch (response.selection) {
            case 0:
                if (isLinked) {
                    waypointLinkMode.delete(player.id);
                    player.sendMessage(`§c[Pathing] Unlinked from ${entityName}`);
                } else {
                    waypointLinkMode.set(player.id, {
                        statueId: statueId,
                        entityId: entity.id,
                        entityType: entity.typeId,
                        entityName: entityName
                    });
                    player.sendMessage(`§a[Pathing] Linked to ${entityName} (ID: ${statueId})`);
                    player.sendMessage(`§7Place waypoints - they will auto-link!`);
                }
                break;

            case 1:
                showWaypointListUI(player, statueId, entityName);
                break;

            case 2:
                clearAllWaypointsForStatue(statueId);
                player.sendMessage(`§c[Pathing] Cleared all waypoints for ${entityName}`);
                break;

            case 3:
                if (existingWaypoints.length > 0) {
                    const sessionId = createPathingSession(entity.id, statueId, entity.typeId, entity.dimension.id);
                    if (sessionId) {
                        const session = activePathing.get(sessionId);
                        if (session && existingWaypoints[session.waypointIndex]) {
                            spawnLureAtLocation(entity.dimension, existingWaypoints[session.waypointIndex].location);
                        }
                        player.sendMessage(`§a[Pathing] Started pathing test for ${entityName}`);
                        player.sendMessage(`§7Session: ${sessionId}`);
                    } else {
                        player.sendMessage(`§c[Pathing] Failed to start pathing!`);
                    }
                } else {
                    player.sendMessage(`§c[Pathing] No waypoints configured!`);
                }
                break;

            case 4:
                if (existingWaypoints.length > 0) {
                    startPathingSimulation(entity, player, 10);
                } else {
                    player.sendMessage(`§c[Simulation] No waypoints configured!`);
                }
                break;

            case 5:
                showCustomIdUI(player, entity, statueId, entityName);
                break;

            case 6:
                showDebugUI(player, statueId);
                break;
        }
    });
}

function showDebugUI(player, statueId) {
    const debugInfo = getPathingDebugInfo();

    refreshWaypointCache(statueId);
    const waypoints = waypointRegistry.get(statueId) || [];

    const form = new ActionFormData();
    form.title(`§l§6Debug & Cleanup`);
    form.body(
        `§7Active Sessions: §f${debugInfo.activeSessions}\n` +
        `§7Temp Statues: §f${debugInfo.temporaryStatues}\n` +
        `§7Cached Routes: §f${debugInfo.cachedStatues}\n` +
        `§7This Statue Waypoints: §f${waypoints.length}\n\n` +
        `§eSelect an action:`
    );

    form.button("§bRefresh & View Waypoints", "textures/ui/refresh");
    form.button("§cCleanup Bugged Waypoints", "textures/ui/trash");
    form.button("§cRemove All Lures", "textures/ui/cancel");
    form.button("§cStop All Pathing", "textures/ui/cancel");
    form.button("§bView Active Sessions", "textures/ui/magnifyingGlass");
    form.button("§aBack", "textures/ui/arrow_left");

    form.show(player).then((response) => {
        if (response.canceled) return;

        switch (response.selection) {
            case 0:
                refreshWaypointCache(statueId);
                const wps = waypointRegistry.get(statueId) || [];
                if (wps.length === 0) {
                    player.sendMessage(`§7[Pathing] No waypoints for statue ${statueId}`);
                } else {
                    let msg = `§6=== Waypoints for Statue ${statueId} (${wps.length} total) ===\n`;
                    for (let i = 0; i < wps.length; i++) {
                        const wp = wps[i];
                        msg += `§e[${i}] §fOrder: ${wp.order}, Pos: (${Math.floor(wp.location.x)}, ${Math.floor(wp.location.y)}, ${Math.floor(wp.location.z)}), Pose: ${wp.pose}\n`;
                    }
                    player.sendMessage(msg);
                }
                break;

            case 1:
                const removed = cleanupBuggedWaypoints();
                player.sendMessage(`§a[Pathing] Cleaned up ${removed} bugged waypoints`);
                break;

            case 2:
                const lureCount = removeAllLures();
                player.sendMessage(`§a[Pathing] Removed ${lureCount} lures`);
                break;

            case 3:
                const sessionsToStop = [...activePathing.keys()];
                for (const sid of sessionsToStop) {
                    stopPathing(sid);
                }
                player.sendMessage(`§a[Pathing] Stopped ${sessionsToStop.length} sessions`);
                break;

            case 4:
                if (debugInfo.sessions.length === 0) {
                    player.sendMessage(`§7[Pathing] No active sessions`);
                } else {
                    let msg = `§6=== Active Sessions ===\n`;
                    for (const s of debugInfo.sessions) {
                        const wps = waypointRegistry.get(s.statueId) || [];
                        msg += `§e${s.id}: §fstate=${s.state}, wp=${s.waypoint}/${wps.length}, retries=${s.retries}, statueId=${s.statueId}\n`;
                    }
                    player.sendMessage(msg);
                }
                break;

            case 5:
                break;
        }
    });
}

function showCustomIdUI(player, entity, currentId, entityName) {
    const form = new ModalFormData();
    form.title(`§l§dSet Custom ID`);
    form.textField(
        `Set a custom ID for ${entityName}\n§7Current ID: ${currentId}`,
        "Enter new ID (number)",
        { defaultValue: currentId.toString() }
    );

    form.show(player).then((response) => {
        if (response.canceled) return;

        const newIdStr = response.formValues[0];
        const newId = parseInt(newIdStr);

        if (isNaN(newId) || newId <= 0) {
            player.sendMessage(`§c[Pathing] Invalid ID! Must be a positive number.`);
            return;
        }

        const oldId = entity.getDynamicProperty("fr:statue_id") || 0;

        entity.setDynamicProperty("fr:statue_id", newId);

        if (oldId > 0 && oldId !== newId) {
            updateWaypointsStatueId(oldId, newId);
        }

        const currentLink = waypointLinkMode.get(player.id);
        if (currentLink && currentLink.statueId === oldId) {
            currentLink.statueId = newId;
            waypointLinkMode.set(player.id, currentLink);
        }

        player.sendMessage(`§a[Pathing] Set custom ID for ${entityName}: §f${newId}`);
        if (oldId > 0 && oldId !== newId) {
            player.sendMessage(`§7All waypoints updated from ID ${oldId} to ${newId}`);
        }
    });
}

function updateWaypointsStatueId(oldId, newId) {
    const allKeys = world.getDynamicPropertyIds();
    let count = 0;

    for (const key of allKeys) {
        if (!key.startsWith("fr:wp_")) continue;

        const data = world.getDynamicProperty(key);
        if (!data) continue;

        try {
            const wpData = JSON.parse(data);
            if (wpData.linkedStatueId === oldId) {
                wpData.linkedStatueId = newId;
                world.setDynamicProperty(key, JSON.stringify(wpData));
                count++;
            }
        } catch {}
    }

    waypointRegistry.delete(oldId);
    refreshWaypointCache(newId);

    console.log(`[Pathing] Updated ${count} waypoints from statue ID ${oldId} to ${newId}`);
}

function showWaypointListUI(player, statueId, entityName) {
    const waypoints = getWaypointsForStatue(statueId);

    if (waypoints.length === 0) {
        player.sendMessage(`§7[Pathing] No waypoints configured for ${entityName}`);
        return;
    }

    let message = `§6=== Waypoints for ${entityName} (ID: ${statueId}) ===\n`;
    for (const wp of waypoints) {
        message += `§e#${wp.order}: §f(${Math.floor(wp.location.x)}, ${Math.floor(wp.location.y)}, ${Math.floor(wp.location.z)}) §7Pose: ${wp.pose}, Wait: ${wp.waitTime}\n`;
    }

    player.sendMessage(message);
}

function clearAllWaypointsForStatue(statueId) {
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

function showWaypointConfigUI(player, block) {
    const location = block.location;
    const dimensionId = block.dimension.id;

    const currentData = getWaypointData(location, dimensionId);

    const linkData = waypointLinkMode.get(player.id);

    let defaultStatueId = currentData.linkedStatueId;
    if (linkData && currentData.linkedStatueId === 0) {
        defaultStatueId = linkData.statueId;
    }

    const form = new ModalFormData();

    if (linkData) {
        form.title(`§l§6Waypoint §r§7(Linked: ${linkData.entityName})`);
    } else {
        form.title("§l§6Waypoint Configuration");
    }

    form.slider("Order (sequence position)", 0, 31, {
        valueStep: 1,
        defaultValue: currentData.order
    });
    form.slider("Pose Index", 0, 11, {
        valueStep: 1,
        defaultValue: currentData.pose
    });

    const rotationIndex = typeof currentData.rotation === 'number' ? currentData.rotation : 0;
    form.dropdown("Rotation", [
        "0° (North)",
        "90° (East)", 
        "180° (South)",
        "-90° (West)"
    ], { defaultValueIndex: rotationIndex });
    form.dropdown("Wait Time", [
        "Random (30s-2min)",
        "30 seconds",
        "1 minute",
        "2 minutes",
        "3 minutes",
        "4 minutes",
        "5 minutes",
        "6 minutes"
    ], { defaultValueIndex: currentData.waitTime || 0 });

    const statueLabel = linkData ? `Statue ID (linked to: ${linkData.entityName})` : "Statue ID";
    form.textField(statueLabel, "Enter statue ID (number)", { defaultValue: defaultStatueId.toString() });

    form.show(player).then((response) => {
        if (response.canceled) return;

        const [newOrder, newPose, newRotation, newWaitTime, linkedStatueIdStr] = response.formValues;
        const linkedStatueId = parseInt(linkedStatueIdStr) || 0;

        try {

            const oldStatueId = currentData.linkedStatueId;

            setWaypointData(location, dimensionId, {
                order: newOrder,
                pose: newPose,
                rotation: newRotation,
                waitTime: newWaitTime,
                linkedStatueId: linkedStatueId
            });

            if (oldStatueId > 0 && oldStatueId !== linkedStatueId) {
                refreshWaypointCache(oldStatueId);
            }
            if (linkedStatueId > 0) {
                refreshWaypointCache(linkedStatueId);
            }

            player.sendMessage(`§a[Pathing] Waypoint configured: Order ${newOrder}, Pose ${newPose}, Statue ID ${linkedStatueId}`);
        } catch (e) {
            console.warn("[Pathing] Error configuring waypoint:", e);
        }
    });
}

function refreshWaypointCache(statueId) {
    const oldWaypoints = waypointRegistry.get(statueId) || [];
    const newWaypoints = getWaypointsForStatue(statueId);

    console.log(`[Pathing] Refreshing cache for statue ${statueId}. Found ${newWaypoints.length} waypoints:`);
    for (let i = 0; i < newWaypoints.length; i++) {
        const wp = newWaypoints[i];
        console.log(`  [${i}] order=${wp.order}, pos=(${Math.floor(wp.location.x)}, ${Math.floor(wp.location.y)}, ${Math.floor(wp.location.z)})`);
    }

    if (oldWaypoints.length > 0) {
        for (const oldWp of oldWaypoints) {

            const stillExists = newWaypoints.some(newWp => 
                Math.floor(newWp.location.x) === Math.floor(oldWp.location.x) &&
                Math.floor(newWp.location.y) === Math.floor(oldWp.location.y) &&
                Math.floor(newWp.location.z) === Math.floor(oldWp.location.z)
            );

            if (!stillExists) {

                try {
                    const dimName = oldWp.dimensionId?.replace("minecraft:", "") || "overworld";
                    const dim = world.getDimension(dimName);
                    removeLureAtLocation(dim, oldWp.location);
                } catch {}
            }
        }
    }

    if (newWaypoints.length > 0) {
        waypointRegistry.set(statueId, newWaypoints);
    } else {
        waypointRegistry.delete(statueId);
    }
}

function removeWaypointFromRegistry(location, dimensionId) {

    const wpData = getWaypointData(location, dimensionId);
    const statueId = wpData.linkedStatueId;
    const key = getWaypointKey(location, dimensionId);

    removeWaypointData(location, dimensionId);

    if (statueId > 0) {
        refreshWaypointCache(statueId);
        console.log(`[Pathing] Removed waypoint from statue ${statueId}. Remaining: ${waypointRegistry.get(statueId)?.length || 0}`);
    }

    try {
        const dimName = dimensionId.replace("minecraft:", "");
        const dim = world.getDimension(dimName);
        removeLureAtLocation(dim, location);
    } catch (e) {
        console.warn(`[Pathing] Error removing lure at destroyed waypoint: ${e}`);
    }

    console.log(`[Pathing] Destroyed waypoint at (${Math.floor(location.x)}, ${Math.floor(location.y)}, ${Math.floor(location.z)}) - Key: ${key}`);
}

export function linkWaypointToStatue(statueId, waypointLocation, dimensionId, order = 0, pose = 0, waitTime = 0, rotation = 0) {

    setWaypointData(waypointLocation, dimensionId, {
        order: order,
        pose: pose,
        rotation: rotation,
        waitTime: waitTime,
        linkedStatueId: statueId
    });

    refreshWaypointCache(statueId);

    console.log(`[Pathing] Linked waypoint to statue ${statueId}. Total: ${waypointRegistry.get(statueId)?.length || 0}`);
}

function createPathingSession(entityId, statueId, entityType, dimensionId, originLocation = null, variantIndex = 0) {
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

function spawnLureAtLocation(dimension, location) {
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

function removeLureAtLocation(dimension, location) {
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

        const gameMode = player.dimension?.runCommand?.(`testfor @a[name="${player.name}",m=survival]`);
        if (gameMode && gameMode.successCount > 0) return true;

        return true;
    } catch (e) {
        console.warn(`[Detection] Error checking game mode: ${e}`);
        return false;
    }
}

function detectNearbyPlayer(entity, dimension) {
    try {
        const entityLoc = entity.location;
        const entityRot = entity.getRotation();

        const allPlayers = dimension.getPlayers();

        let closestPlayer = null;
        let closestDistance = Infinity;

        for (const player of allPlayers) {

            if (!isPlayerInSurvivalMode(player)) {
                continue;
            }

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

function checkLineOfSight(dimension, from, to) {
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

function getWaitTimeFromState(state) {
    switch (state) {
        case 0:
            return MIN_WAIT_TIME + Math.random() * (DEFAULT_WAIT_TIME - MIN_WAIT_TIME);
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

function getStatueTypeForAnimatronic(animatronicType) {
    const mapping = {
        "fr:fnaf1_bonnie_entity": "fr:bonnie_statue",
        "fr:fnaf1_chica_entity": "fr:chica_statue",
        "fr:fnaf1_foxy_entity": "fr:foxy_statue",
        "fr:fnaf1_freddy_entity": "fr:freddy_fazbear_statue"
    };
    return mapping[animatronicType] || "fr:bonnie_statue";
}

function getAnimatronicTypeForStatue(statueType) {
    const mapping = {
        "fr:bonnie_statue": "fr:fnaf1_bonnie_entity",
        "fr:chica_statue": "fr:fnaf1_chica_entity",
        "fr:foxy_statue": "fr:fnaf1_foxy_entity",
        "fr:freddy_fazbear_statue": "fr:fnaf1_freddy_entity"
    };
    return mapping[statueType] || "fr:fnaf1_bonnie_entity";
}

function findEntityById(entityId, entityType, preferredDimId = null) {
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

function selectNextWaypoint(pathData, waypoints) {
    console.log(`[Pathing] Selecting next waypoint. Total waypoints: ${waypoints.length}, Current: ${pathData.waypointIndex}, Failed: [${[...pathData.failedWaypoints].join(', ')}]`);

    pathData.failedWaypoints.delete(pathData.waypointIndex);

    if (pathData.useRandomOrder && waypoints.length > 1) {

        const validIndices = [];
        for (let i = 0; i < waypoints.length; i++) {
            if (i !== pathData.waypointIndex && !pathData.failedWaypoints.has(i)) {
                validIndices.push(i);
            }
        }

        console.log(`[Pathing] Valid waypoint indices: [${validIndices.join(', ')}]`);

        if (validIndices.length > 0) {
            const selectedIndex = validIndices[Math.floor(Math.random() * validIndices.length)];
            console.log(`[Pathing] Selected waypoint index: ${selectedIndex} (order: ${waypoints[selectedIndex]?.order})`);
            return selectedIndex;
        }

        console.log(`[Pathing] No valid waypoints, clearing failed set`);
        pathData.failedWaypoints.clear();
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * waypoints.length);
        } while (newIndex === pathData.waypointIndex && waypoints.length > 1);
        console.log(`[Pathing] Selected waypoint index after clear: ${newIndex}`);
        return newIndex;
    } else {

        let nextIndex = (pathData.waypointIndex + 1) % waypoints.length;
        let attempts = 0;

        while (pathData.failedWaypoints.has(nextIndex) && attempts < waypoints.length) {
            nextIndex = (nextIndex + 1) % waypoints.length;
            attempts++;
        }

        if (attempts >= waypoints.length) {
            console.log(`[Pathing] Sequential mode: all waypoints failed, clearing`);
            pathData.failedWaypoints.clear();
            nextIndex = (pathData.waypointIndex + 1) % waypoints.length;
        }

        console.log(`[Pathing] Sequential mode, next index: ${nextIndex}`);
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
        console.log(`[Pathing] Waypoint ${pathData.waypointIndex} marked as failed, selecting new target`);

        if (pathData.isSimulation && pathData.simulationId) {
            recordSimulationResult(pathData.simulationId, pathData.waypointIndex, false, "Stuck/Timeout", currentWp?.location);
        }

        if (PATHING_CONFIG.TELEPORT_FALLBACK && entity) {
            try {
                entity.teleport(currentWp.location);
                console.log(`[Pathing] Teleported stuck entity to waypoint`);

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

const NIGHT_START = 13000;
const NIGHT_END = 23000;

function isNightTime() {
    try {
        const time = world.getTimeOfDay();
        const isNight = time >= NIGHT_START && time < NIGHT_END;

        if (Math.random() < 0.01) {
            console.log(`[Pathing] Time check: ${time} ticks, isNight=${isNight}`);
        }
        return isNight;
    } catch (e) {
        console.warn(`[Pathing] Error checking time: ${e}`);
        return true;
    }
}

function processPathing() {
    const now = Date.now();
    const sessionsToRemove = [];

    if (!isNightTime()) {

        let nonSimSessions = 0;
        for (const [sessionId, data] of activePathing) {
            if (!data.isSimulation) nonSimSessions++;
        }

        if (nonSimSessions > 0 || temporaryStatues.size > 0) {
            console.log(`[Pathing] Daytime detected, stopping non-simulation pathing`);

            for (const [sessionId, tempData] of temporaryStatues) {

                const pathData = activePathing.get(sessionId);
                if (pathData && pathData.isSimulation) {
                    console.log(`[Pathing] Skipping simulation temp statue ${sessionId}`);
                    continue;
                }

                try {
                    const dimension = world.getDimension(tempData.dimensionId.replace("minecraft:", ""));
                    let foundStatue = null;

                    for (const e of dimension.getEntities({ type: tempData.statueType })) {
                        if (e.id === tempData.statueId) {
                            foundStatue = e;
                            break;
                        }
                    }

                    if (foundStatue) {
                        const statueLocation = foundStatue.location;

                        const animatronic = dimension.spawnEntity(
                            tempData.animatronicData.entityType,
                            statueLocation
                        );

                        if (tempData.animatronicData.variantIndex > 0) {
                            system.run(() => {
                                try {
                                    animatronic.triggerEvent(`fr:set_variant_${tempData.animatronicData.variantIndex}`);
                                } catch {}
                            });
                        }

                        animatronic.setDynamicProperty("fr:statue_id", tempData.animatronicData.waypointStatueId);

                        if (tempData.animatronicData.platformLocation) {
                            animatronic.setDynamicProperty("fr:platform_location", tempData.animatronicData.platformLocation);
                        }

                        foundStatue.remove();

                        console.log(`[Pathing] Daytime: Converted temp statue back to animatronic`);
                    }
                } catch (e) {
                    console.warn(`[Pathing] Error converting temp statue: ${e}`);
                }
            }

            const tempStatuesToRemove = [];
            for (const [sessionId, tempData] of temporaryStatues) {
                const pathData = activePathing.get(sessionId);
                if (!pathData || !pathData.isSimulation) {
                    tempStatuesToRemove.push(sessionId);
                }
            }
            for (const sid of tempStatuesToRemove) {
                temporaryStatues.delete(sid);
            }

            const sessionsToRemoveDay = [];
            for (const [sessionId, pathData] of activePathing) {
                if (pathData.isSimulation) continue;

                try {
                    const entity = findEntityById(pathData.currentEntityId, pathData.entityType, pathData.dimensionId);
                    if (entity) {
                        cleanupLuresNearEntity(entity);
                    }
                } catch {}
                sessionsToRemoveDay.push(sessionId);
            }

            for (const sid of sessionsToRemoveDay) {
                activePathing.delete(sid);
            }
            console.log(`[Pathing] ${sessionsToRemoveDay.length} non-simulation sessions cleared for daytime`);
        }

        let hasSimulations = false;
        for (const [_, data] of activePathing) {
            if (data.isSimulation) {
                hasSimulations = true;
                break;
            }
        }
        if (!hasSimulations) return;
    }

    for (const [sessionId, pathData] of activePathing) {
        try {

            const waypoints = waypointRegistry.get(pathData.statueId);
            if (!waypoints || waypoints.length === 0) {
                console.log(`[Pathing] Session ${sessionId}: No waypoints, removing`);
                sessionsToRemove.push(sessionId);
                continue;
            }

            const currentWp = waypoints[pathData.waypointIndex];
            if (!currentWp) {
                pathData.waypointIndex = 0;
                continue;
            }

            if (pathData.state === "moving") {

                const entity = findEntityById(pathData.currentEntityId, pathData.entityType, pathData.dimensionId);

                if (!entity) {

                    if (temporaryStatues.has(sessionId)) {
                        continue;
                    }

                    console.log(`[Pathing] Session ${sessionId}: Entity not found, removing`);
                    sessionsToRemove.push(sessionId);
                    continue;
                }

                if (!pathData.isSimulation) {
                    const tickCount = system.currentTick || 0;

                    const checkInterval = pathData.isChasing ? 
                        DETECTION_CONFIG.CHASE_UPDATE_TICKS : 
                        DETECTION_CONFIG.CHECK_INTERVAL_TICKS;

                    if (tickCount - pathData.lastDetectionCheck >= checkInterval) {
                        pathData.lastDetectionCheck = tickCount;

                        if (pathData.isChasing) {
                            let targetPlayer = null;

                            if (now - pathData.chaseStartTime > DETECTION_CONFIG.CHASE_TIMEOUT_MS) {
                                console.log(`[Detection] Chase timeout, returning to waypoint pathing`);
                                pathData.isChasing = false;
                                pathData.chaseTargetId = null;
                                pathData.chaseWalkActive = false;
                                pathData.isWalkCommandActive = false;

                                spawnLureAtLocation(entity.dimension, currentWp.location);
                            } else {

                                try {
                                    for (const p of entity.dimension.getPlayers()) {
                                        if (p.id === pathData.chaseTargetId && isPlayerInSurvivalMode(p)) {
                                            targetPlayer = p;
                                            break;
                                        }
                                    }
                                } catch {}

                                if (targetPlayer) {
                                    const dist = getDistance(entity.location, targetPlayer.location);

                                    if (dist < DETECTION_CONFIG.CHASE_ARRIVAL_DISTANCE) {
                                        console.log(`[Detection] Caught player ${targetPlayer.name}!`);
                                        try {
                                            entity.triggerEvent("fr:attack_player");
                                        } catch {}
                                        pathData.isChasing = false;
                                        pathData.chaseTargetId = null;
                                        pathData.chaseWalkActive = false;
                                        pathData.isWalkCommandActive = false;
                                    } else if (dist > DETECTION_CONFIG.BASE_RANGE * 2) {

                                        console.log(`[Detection] Player escaped, returning to waypoints`);
                                        pathData.isChasing = false;
                                        pathData.chaseTargetId = null;
                                        pathData.chaseWalkActive = false;
                                        pathData.isWalkCommandActive = false;
                                        spawnLureAtLocation(entity.dimension, currentWp.location);
                                    } else {

                                        const lastTarget = pathData.chaseTargetLocation || targetPlayer.location;
                                        const moveDist = getDistance(lastTarget, targetPlayer.location);

                                        if (moveDist > 0.2 || !pathData.chaseTargetLocation) {
                                            pathData.chaseTargetLocation = { ...targetPlayer.location };
                                            pathData.chaseWalkActive = false;
                                        }
                                    }
                                } else {

                                    console.log(`[Detection] Lost target, returning to waypoint pathing`);
                                    pathData.isChasing = false;
                                    pathData.chaseTargetId = null;
                                    pathData.chaseWalkActive = false;
                                    pathData.isWalkCommandActive = false;
                                    spawnLureAtLocation(entity.dimension, currentWp.location);
                                }
                            }
                        } else {

                            const detectedPlayer = detectNearbyPlayer(entity, entity.dimension);

                            if (detectedPlayer) {
                                console.log(`[Detection] Animatronic detected player: ${detectedPlayer.name}`);
                                pathData.isChasing = true;
                                pathData.chaseTargetId = detectedPlayer.id;
                                pathData.chaseStartTime = now;
                                pathData.chaseTargetLocation = { ...detectedPlayer.location };
                                pathData.chaseWalkActive = false;
                                pathData.isWalkCommandActive = false;

                                try {
                                    entity.triggerEvent("fr:detected_player");
                                } catch {}
                            }
                        }
                    }

                    if (pathData.isChasing && pathData.chaseTargetLocation) {

                        if (!pathData.chaseWalkActive) {
                            pathData.chaseWalkActive = true;

                            walkEntityTo(
                                entity,
                                pathData.chaseTargetLocation,

                                (arrivedEntity) => {
                                    pathData.chaseWalkActive = false;

                                },

                                (stuckEntity, targetLoc) => {
                                    pathData.chaseWalkActive = false;

                                },
                                { skipDrawing: true }
                            );
                        }
                        continue;
                    }
                }

                const dist = getDistance(entity.location, currentWp.location);

                if (dist < PATHING_CONFIG.ARRIVAL_DISTANCE) {

                    pathData.state = "arriving";
                    pathData.stateStartTime = now;
                    pathData.retryCount = 0;

                    pathData.lastSuccessfulLocation = { ...entity.location };
                    console.log(`[Pathing] Session ${sessionId}: Arrived at waypoint ${pathData.waypointIndex}`);

                    if (pathData.isSimulation && pathData.simulationId) {
                        recordSimulationResult(pathData.simulationId, pathData.waypointIndex, true, "", currentWp.location);

                        if (checkSimulationComplete(pathData.simulationId, pathData)) {
                            endSimulation(pathData.simulationId, entity);
                            sessionsToRemove.push(sessionId);
                            continue;
                        }
                    }
                    continue;
                }

                const timeSinceStart = now - pathData.stateStartTime;

                if (timeSinceStart > PATHING_CONFIG.STUCK_TIMEOUT_MS) {

                    console.log(`[Pathing] Session ${sessionId}: Timeout reaching waypoint`);
                    handleStuckEntity(pathData, entity, waypoints, currentWp, sessionId);

                    if (pathData.isSimulation && pathData.simulationId && checkSimulationComplete(pathData.simulationId, pathData)) {
                        endSimulation(pathData.simulationId, entity);
                        sessionsToRemove.push(sessionId);
                    }
                    continue;
                }

                if (now - pathData.lastProgressCheck > PATHING_CONFIG.STUCK_CHECK_INTERVAL_MS) {
                    if (pathData.lastKnownPosition) {
                        const progress = getDistance(entity.location, pathData.lastKnownPosition);
                        if (progress < PATHING_CONFIG.MIN_PROGRESS_DISTANCE) {

                            console.log(`[Pathing] Session ${sessionId}: No progress detected`);
                            handleStuckEntity(pathData, entity, waypoints, currentWp, sessionId);

                            if (pathData.isSimulation && pathData.simulationId && checkSimulationComplete(pathData.simulationId, pathData)) {
                                endSimulation(pathData.simulationId, entity);
                                sessionsToRemove.push(sessionId);
                            }
                            continue;
                        }
                    }
                    pathData.lastKnownPosition = { ...entity.location };
                    pathData.lastProgressCheck = now;
                }

                if (!pathData.isWalkCommandActive) {
                    pathData.isWalkCommandActive = true;

                    spawnLureAtLocation(entity.dimension, currentWp.location);

                    walkEntityTo(entity, currentWp.location, 

                        (arrivedEntity) => {
                            pathData.isWalkCommandActive = false;
                        },

                        (stuckEntity, targetLoc) => {
                            console.log(`[Pathing] Waypoint ${pathData.waypointIndex} is UNREACHABLE!`);
                            pathData.isWalkCommandActive = false;

                            pathData.failedWaypoints.add(pathData.waypointIndex);

                            if (pathData.isSimulation && pathData.simulationId) {
                                recordSimulationResult(pathData.simulationId, pathData.waypointIndex, false, "Unreachable", currentWp?.location);
                            }

                            removeLureAtLocation(stuckEntity.dimension, targetLoc);

                            const waypoints = waypointRegistry.get(pathData.statueId);

                            let validCount = 0;
                            let nextValidIndex = -1;
                            for (let i = 0; i < waypoints.length; i++) {
                                if (!pathData.failedWaypoints.has(i)) {
                                    validCount++;
                                    if (nextValidIndex === -1) nextValidIndex = i;
                                }
                            }

                            console.log(`[Pathing] Valid waypoints remaining: ${validCount}/${waypoints.length}`);

                            if (validCount === 0) {
                                console.log(`[Pathing] ALL waypoints unreachable! Returning to platform.`);

                                if (pathData.isSimulation && pathData.simulationId) {
                                    endSimulation(pathData.simulationId, stuckEntity);
                                } else {
                                    stopPathing(sessionId);
                                }
                                return;
                            }

                            if (validCount <= 2) {
                                console.log(`[Pathing] Few waypoints left, trying directly without return`);
                                pathData.waypointIndex = nextValidIndex;
                                pathData.retryCount = 0;
                                pathData.stateStartTime = Date.now();

                                const nextWp = waypoints[pathData.waypointIndex];
                                if (nextWp) {
                                    spawnLureAtLocation(stuckEntity.dimension, nextWp.location);
                                }
                                return;
                            }

                            const originPoint = pathData.lastSuccessfulLocation || pathData.originLocation;

                            if (originPoint) {
                                console.log(`[Pathing] Returning to origin before trying next waypoint...`);

                                walkEntityTo(stuckEntity, originPoint, 
                                    (returnedEntity) => {
                                        pathData.waypointIndex = selectNextWaypoint(pathData, waypoints);
                                        pathData.retryCount = 0;
                                        pathData.stateStartTime = Date.now();
                                        pathData.isWalkCommandActive = false;

                                        const nextWp = waypoints[pathData.waypointIndex];
                                        if (nextWp) {
                                            spawnLureAtLocation(returnedEntity.dimension, nextWp.location);
                                            console.log(`[Pathing] Trying next waypoint: ${pathData.waypointIndex}`);
                                        }
                                    },
                                    (failedEntity, failedLoc) => {
                                        pathData.waypointIndex = selectNextWaypoint(pathData, waypoints);
                                        pathData.retryCount = 0;
                                        pathData.stateStartTime = Date.now();
                                        pathData.isWalkCommandActive = false;

                                        const nextWp = waypoints[pathData.waypointIndex];
                                        if (nextWp) {
                                            spawnLureAtLocation(failedEntity.dimension, nextWp.location);
                                        }
                                    }
                                );
                            } else {
                                pathData.waypointIndex = selectNextWaypoint(pathData, waypoints);
                                pathData.retryCount = 0;
                                pathData.stateStartTime = Date.now();

                                const nextWp = waypoints[pathData.waypointIndex];
                                if (nextWp) {
                                    spawnLureAtLocation(stuckEntity.dimension, nextWp.location);
                                }
                            }
                        }
                    );
                }
            }

            else if (pathData.state === "arriving") {

                const entity = findEntityById(pathData.currentEntityId, pathData.entityType, pathData.dimensionId);

                if (!entity) {
                    pathData.state = "moving";
                    pathData.isWalkCommandActive = false;
                    continue;
                }

                removeLureAtLocation(entity.dimension, currentWp.location);

                const dimension = entity.dimension;
                const location = { ...entity.location };
                const rotation = entity.getRotation();
                const variantIndex = pathData.variantIndex || 0;

                const animatronicData = {
                    entityType: pathData.entityType,
                    location: location,
                    rotation: rotation,
                    variantIndex: variantIndex,
                    waypointStatueId: pathData.statueId,

                    platformLocation: entity.getDynamicProperty("fr:platform_location") || null
                };

                const statueType = getStatueTypeForAnimatronic(pathData.entityType);

                try {

                    const statue = dimension.spawnEntity(statueType, currentWp.location);

                    const rotationDegrees = [0, 90, 180, -90];
                    const waypointRotation = rotationDegrees[currentWp.rotation || 0] || 0;

                    system.run(() => {
                        try {

                            statue.teleport(statue.location, { rotation: { x: 0, y: waypointRotation } });
                            if (currentWp.pose >= 0) {
                                statue.triggerEvent(`fr:set_pose_${currentWp.pose}`);
                            }

                            if (variantIndex > 0) {
                                statue.triggerEvent(`fr:set_variant_${variantIndex}`);
                            }
                        } catch (e) {
                            console.warn(`[Pathing] Error applying pose: ${e}`);
                        }
                    });

                    temporaryStatues.set(sessionId, {
                        statueId: statue.id,
                        statueType: statueType,
                        animatronicData: animatronicData,
                        location: currentWp.location,
                        dimensionId: dimension.id
                    });

                    entity.remove();

                    pathData.state = "posing";
                    pathData.stateStartTime = now;
                    pathData.currentEntityId = null;

                    console.log(`[Pathing] Session ${sessionId}: Transformed to statue for pose ${currentWp.pose}`);

                } catch (e) {
                    console.warn(`[Pathing] Error spawning statue: ${e}`);
                    pathData.state = "moving";
                    pathData.isWalkCommandActive = false;
                }
            }

            else if (pathData.state === "posing") {

                const waitTime = pathData.isSimulation ? 100 : getWaitTimeFromState(currentWp.waitTime);
                const elapsedMs = now - pathData.stateStartTime;
                const elapsedTicks = elapsedMs / 50;

                if (elapsedTicks >= waitTime) {

                    const tempData = temporaryStatues.get(sessionId);

                    if (!tempData) {
                        console.warn(`[Pathing] Session ${sessionId}: No temp statue data, resetting`);
                        sessionsToRemove.push(sessionId);
                        continue;
                    }

                    try {
                        const dimension = world.getDimension(tempData.dimensionId.replace("minecraft:", ""));
                        let foundStatue = null;

                        for (const e of dimension.getEntities({ type: tempData.statueType })) {
                            if (e.id === tempData.statueId) {
                                foundStatue = e;
                                break;
                            }
                        }

                        if (!foundStatue) {

                            console.warn(`[Pathing] Session ${sessionId}: Statue not found, spawning at stored location`);
                            foundStatue = { 
                                location: tempData.location, 
                                getRotation: () => tempData.animatronicData.rotation,
                                remove: () => {}
                            };
                        }

                        const statueLocation = foundStatue.location;
                        const statueRotation = foundStatue.getRotation();

                        const animatronic = dimension.spawnEntity(
                            tempData.animatronicData.entityType,
                            statueLocation
                        );

                        if (tempData.animatronicData.variantIndex > 0) {
                            system.run(() => {
                                try {
                                    animatronic.triggerEvent(`fr:set_variant_${tempData.animatronicData.variantIndex}`);
                                } catch {}
                            });
                        }

                        animatronic.setDynamicProperty("fr:statue_id", tempData.animatronicData.waypointStatueId);

                        if (tempData.animatronicData.platformLocation) {
                            animatronic.setDynamicProperty("fr:platform_location", tempData.animatronicData.platformLocation);
                        }

                        if (pathData.isSimulation) {
                            animatronic.addTag("fr:simulation_mode");
                        }

                        system.run(() => {
                            try {
                                animatronic.triggerEvent("fr:start_pathing");
                            } catch {}
                        });

                        if (foundStatue.id) {
                            foundStatue.remove();
                        }

                        pathData.currentEntityId = animatronic.id;
                        pathData.dimensionId = dimension.id;
                        pathData.state = "moving";
                        pathData.isWalkCommandActive = false;
                        pathData.stateStartTime = now;
                        pathData.lastProgressCheck = now;
                        pathData.lastKnownPosition = { ...animatronic.location };

                        pathData.waypointIndex = selectNextWaypoint(pathData, waypoints);
                        pathData.retryCount = 0;

                        const nextWp = waypoints[pathData.waypointIndex];
                        if (nextWp) {
                            spawnLureAtLocation(dimension, nextWp.location);
                        }

                        console.log(`[Pathing] Session ${sessionId}: Transformed to animatronic, moving to wp ${pathData.waypointIndex}`);

                    } catch (e) {
                        console.warn(`[Pathing] Session ${sessionId}: Error transforming: ${e}`);
                        sessionsToRemove.push(sessionId);
                    }

                    temporaryStatues.delete(sessionId);
                }
            }

        } catch (e) {
            console.warn(`[Pathing] Session ${sessionId}: Error: ${e}`);
        }
    }

    for (const sessionId of sessionsToRemove) {
        activePathing.delete(sessionId);
        temporaryStatues.delete(sessionId);
    }
}

function getDistance(loc1, loc2) {
    const dx = loc1.x - loc2.x;
    const dy = loc1.y - loc2.y;
    const dz = loc1.z - loc2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function updateWaypointVisibility() {
    for (const player of world.getAllPlayers()) {
        try {
            const heldItem = getHeldItem(player);
            const isHoldingMarker = heldItem?.typeId === "fr:path_marker";

            if (isHoldingMarker) {

                const dim = player.dimension;
                const loc = player.location;

                const entities = dim.getEntities({
                    location: loc,
                    maxDistance: 32
                });

                for (let x = Math.floor(loc.x) - 16; x <= Math.floor(loc.x) + 16; x++) {
                    for (let y = Math.floor(loc.y) - 8; y <= Math.floor(loc.y) + 8; y++) {
                        for (let z = Math.floor(loc.z) - 16; z <= Math.floor(loc.z) + 16; z++) {
                            try {
                                const block = dim.getBlock({ x, y, z });
                                if (block?.typeId === "fr:waypoint") {
                                    spawnWaypointParticle(dim, { x, y, z });
                                }
                            } catch {}
                        }
                    }
                }
            }
        } catch (e) {

        }
    }
}

system.runInterval(() => {
    processPathing();
}, 20);

system.runInterval(() => {
    updateWaypointVisibility();
}, 10);

system.runInterval(() => {
    cleanupOrphanedSessions();
}, 1200);

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
            } catch {

            }

        } catch {

            world.setDynamicProperty(key, undefined);
            removedCount++;
        }
    }

    console.log(`[Pathing] Checked ${checkedCount} waypoints, removed ${removedCount} bugged entries`);
    return removedCount;
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
        player.sendMessage(`§7Total waypoints available: §e${waypoints.length}`);

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
        `§6•••••••••••••••••••••••••••••••••••`,
        `§6    SIMULATION COMPLETE    `,
        `§6•••••••••••••••••••••••••••••••••••`,
        ``,
        `§7Total Time: §e${totalTime}s`,
        `§7Waypoints Visited: §e${totalVisited}/${simData.maxWaypoints}`,
        `§7Total Available: §8${simData.totalWaypoints || '?'} §7(${simData.selectionMode || 'random'})`,
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
        summaryLines.push(``);
    }

    summaryLines.push(`§6•••••••••••••••••••••••••••••••••••`);

    if (player) {
        for (const line of summaryLines) {
            player.sendMessage(line);
        }
    }

    console.log(`[Simulation] Summary: ${successCount} successes, ${failCount} failures, ${successRate}% rate`);

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

            walkEntityTo(animatronic, platformLoc, (entity) => {

                try {
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

                    entity.remove();

                    if (player) {
                        player.sendMessage(`§a[Simulation] §7Returned to platform successfully!`);
                    }

                } catch (e) {
                    console.warn(`[Simulation] Error transforming back to statue: ${e}`);
                }
            });
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

export { 
    waypointRegistry, 
    activePathing, 
    linkWaypointToStatue as addWaypoint,
    getWaypointData,
    setWaypointData,
    getWaypointsForStatue,
    refreshWaypointCache
};
