/**
 * FAZBEAR'S RESTOCKED - BEDROCK
 * ©2026
 *
 * Centralized Chunked Storage System
 * Handles reading/writing large data sets that exceed Bedrock's 32KB dynamic property limit.
 *
 * This module provides a single source of truth for chunked storage operations,
 * preventing bugs from duplicated/inconsistent implementations across files.
 */


import { world, system } from "@minecraft/server";
import { isLightType, getLightConfig, spawnLightVfx, destroyLightVfx } from "./connection_types.js";
import { dynamicToast, lampVfxEntities, hasExistingVfxAtLocation } from "./utils.js";
import { getChunkedData, setChunkedData, STORAGE_KEYS } from "./chunked_storage.js";

const BROKEN_LIGHTS = new Map();

system.run(() => {
    try {
        const savedData = getChunkedData(STORAGE_KEYS.BROKEN_LIGHTS);
        if (Array.isArray(savedData)) {
            for (const [key, value] of savedData) {
                BROKEN_LIGHTS.set(key, value);
            }
        }
    } catch (e) { }
});

function saveBrokenLights() {
    setChunkedData(STORAGE_KEYS.BROKEN_LIGHTS, Array.from(BROKEN_LIGHTS.entries()));
}

export function isLightBroken(block) {
    if (!block) return false;
    const blockKey = `${block.dimension.id}_${block.location.x}_${block.location.y}_${block.location.z}`;
    return BROKEN_LIGHTS.has(blockKey);
}

export function repairLight(block, player) {
    if (!block || !isLightType(block.typeId)) return;

    const blockKey = `${block.dimension.id}_${block.location.x}_${block.location.y}_${block.location.z}`;
    const isBroken = BROKEN_LIGHTS.has(blockKey);

    if (!isBroken) return;

    const config = getLightConfig(block.typeId);
    if (!config || !config.powerState) return;

    BROKEN_LIGHTS.delete(blockKey);
    saveBrokenLights();

    try {
        const newPerm = block.permutation.withState(config.powerState, true);
        block.setPermutation(newPerm);

        const lightData = {
            dimensionId: block.dimension.id,
            x: block.location.x,
            y: block.location.y,
            z: block.location.z,
            typeId: block.typeId
        };

        const center = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };

        if (!hasExistingVfxAtLocation(block.dimension, center)) {
            spawnLightVfx(block.dimension, block, lightData, lampVfxEntities);
        }

        const nearbyEntities = block.dimension.getEntities({
            location: center,
            maxDistance: 2,
            type: "minecraft:arrow"
        });

        for (const entity of nearbyEntities) {
            try { entity.remove(); } catch (e) { try { entity.kill(); } catch (e2) { } }
        }


        if (player) {
            player.sendMessage(dynamicToast("§l§qREPAIRED", "§aLight fixed", "textures/fr_ui/approve_icon", "textures/fr_ui/approve_ui"));
        }
        block.dimension.playSound("hit.anvil", center, { pitch: 2.0 });
    } catch (e) { }
}

function breakLight(block) {
    if (!block || !isLightType(block.typeId)) return;

    const blockKey = `${block.dimension.id}_${block.location.x}_${block.location.y}_${block.location.z}`;

    if (BROKEN_LIGHTS.has(blockKey)) return;

    const config = getLightConfig(block.typeId);
    if (!config || !config.powerState) return;

    BROKEN_LIGHTS.set(blockKey, {
        dimensionId: block.dimension.id,
        location: { x: block.location.x, y: block.location.y, z: block.location.z },
        powerState: config.powerState
    });
    saveBrokenLights();

    try {
        const center = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
        block.dimension.playSound("random.glass", center, { pitch: 0.8 });
        block.dimension.spawnParticle("minecraft:critical_hit_emitter", center);
    } catch (e) { }
}

world.afterEvents.projectileHitBlock.subscribe((event) => {
    const { block } = event;
    if (block) {
        breakLight(block);
    }
});

system.runInterval(() => {
    const dimensions = ["overworld", "nether", "the_end"];

    for (const dimId of dimensions) {
        const dimension = world.getDimension(dimId);

        try {
            const projectiles = dimension.getEntities({
                type: "minecraft:arrow"
            });

            for (const projectile of projectiles) {
                const loc = projectile.location;
                const block = dimension.getBlock(loc);

                if (block && isLightType(block.typeId)) {
                    breakLight(block);
                }
            }
        } catch (e) { }
    }
}, 20);

system.runInterval(() => {
    if (BROKEN_LIGHTS.size === 0) return;

    for (const [key, data] of BROKEN_LIGHTS) {
        try {
            const dim = world.getDimension(data.dimensionId);
            const block = dim.getBlock(data.location);

            if (!block || !isLightType(block.typeId)) {
                BROKEN_LIGHTS.delete(key);
                continue;
            }

            if (system.currentTick % (Math.floor(Math.random() * 10) + 3) === 0) {
                const currentState = block.permutation.getState(data.powerState);
                const newState = !currentState;

                const newPerm = block.permutation.withState(data.powerState, newState);
                block.setPermutation(newPerm);

                const lightData = {
                    dimensionId: data.dimensionId,
                    x: block.location.x,
                    y: block.location.y,
                    z: block.location.z,
                    typeId: block.typeId
                };

                if (newState) {
                    spawnLightVfx(dim, block, lightData, lampVfxEntities);
                } else {
                    destroyLightVfx(dim, lightData, lampVfxEntities);
                }

                if (Math.random() > 0.8) {
                    const center = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
                    dim.spawnParticle("minecraft:lava_particle", center);
                    if (Math.random() > 0.5) {
                        dim.playSound("random.fizz", center, { volume: 0.5, pitch: 1.5 });
                    }
                }
            }
        } catch (e) {
            BROKEN_LIGHTS.delete(key);
        }
    }
}, 2);
