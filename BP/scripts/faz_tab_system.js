/**
 * FAZBEAR'S RESTOCKED - BEDROCK
 * ©2025
 * 
 * If you want to modify or use this system as a base, contact the code developer, 
 * Hyrxs (discord: hyrxs), for more information and authorization
 * 
 * DO NOT COPY OR STEAL, ty :>
 */

import { world, system } from '@minecraft/server';
import { securityCameraSystem } from './camera_system/security_camera_system.js';
import { toast, showFazTabOpen, distance3D, safeGet } from './utils.js';

const DEFAULT_MAX_RANGE = 64;
const DEFAULT_MIN_RANGE = 3;
const PC_TYPES = new Set(['fr:old_pc', 'fr:black_old_pc']);

const getRange = (key, def) => world.getDynamicProperty(key) ?? def;
const setRange = (key, val) => world.setDynamicProperty(key, val);

export const getFazTabMaxRange = () => getRange("fr:faz_tab_max_range", DEFAULT_MAX_RANGE);
export const getFazTabMinRange = () => getRange("fr:faz_tab_min_range", DEFAULT_MIN_RANGE);
export const setFazTabMaxRange = (v) => setRange("fr:faz_tab_max_range", v);
export const setFazTabMinRange = (v) => setRange("fr:faz_tab_min_range", v);

const getPcDataFromItem = (item) => {
    const lore = safeGet(() => item.getLore(), []);
    const line = lore.find(l => l.startsWith('§7PC:§r '));
    if (!line) return null;
    const [pcPosStr, dimId] = line.substring(8).split('|');
    return pcPosStr && dimId ? { pcPosStr, dimId } : null;
};

const setPcDataToItem = (item, pcPosStr, dimId, loc) => {
    try {
        item.setLore([
            `§7PC:§r ${pcPosStr}|${dimId}`,
            `§7Location:§r ${loc.x}, ${loc.y}, ${loc.z}`,
            `§7Dimension:§r ${dimId}`,
            `§a✓ Linked`
        ]);
        return true;
    } catch { return false; }
};

const sendError = (player, msg) => player.sendMessage(toast.error(msg));

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
    itemComponentRegistry.registerCustomComponent('fr:faz_tab_component', {
        onUseOn: ({ source: player, block, itemStack }) => {
            if (!player || !block || !itemStack || !player.isSneaking) return;
            if (!PC_TYPES.has(block.typeId)) return;

            try {
                const pcPosStr = securityCameraSystem.locStr(securityCameraSystem.posOf(block));
                const camList = securityCameraSystem.connections.get(pcPosStr);

                if (!camList?.length) {
                    return sendError(player, "This PC has no cameras linked");
                }

                const eq = player.getComponent('minecraft:equippable');
                const currentItem = eq?.getEquipment('Mainhand');
                if (!currentItem || currentItem.typeId !== 'fr:faz-tab') return;

                const newItem = currentItem.clone();
                if (setPcDataToItem(newItem, pcPosStr, block.dimension.id, block.location)) {
                    eq.setEquipment('Mainhand', newItem);
                    const loc = block.location;
                    player.sendMessage(toast.success(`Faz-Tab linked to PC\n§7Position: ${loc.x}, ${loc.y}, ${loc.z}`));
                    player.playSound('random.click', { pitch: 1.5, volume: 1.0 });
                }
            } catch { }
        },

        onUse: ({ source: player, itemStack }) => {
            if (!player || !itemStack || player.isSneaking) return;

            try {
                const pcData = getPcDataFromItem(itemStack);
                if (!pcData) {
                    return sendError(player, "Faz-Tab not linked to any PC\n§7Sneak + right-click on a PC to link");
                }

                const { pcPosStr, dimId } = pcData;
                const dimension = safeGet(() => world.getDimension(dimId));
                if (!dimension) return sendError(player, "Linked dimension not found");

                const pcBlock = securityCameraSystem.blockFromLocStr(dimension, pcPosStr);
                if (!pcBlock || !PC_TYPES.has(pcBlock.typeId)) {
                    return sendError(player, "Linked PC not found or was destroyed");
                }

                const maxRange = getFazTabMaxRange();
                const minRange = getFazTabMinRange();
                const pcDist = distance3D(player.location, pcBlock.location);

                if (pcDist > maxRange) return sendError(player, `PC Out of Range\n§7Max Range: ${maxRange} blocks`);
                if (pcDist < minRange) return sendError(player, `Too close to PC\n§7Min Range: ${minRange} blocks`);

                const camList = securityCameraSystem.connections.get(pcPosStr);
                if (!camList?.length) return sendError(player, "This PC has no cameras linked");

                const firstCamera = camList[0];
                if (!firstCamera) return sendError(player, "No valid camera found");

                const camBlock = securityCameraSystem.blockFromLocStr(dimension, firstCamera);
                if (!camBlock || camBlock.typeId !== "fr:security_cameras") {
                    return sendError(player, "Camera not loaded or destroyed\n§7Move closer to the camera area");
                }

                const camRotation = camBlock.permutation.getState("fr:rotation");
                if (camRotation === undefined || camRotation === null) {
                    return sendError(player, "Camera chunk not fully loaded\n§7Move closer to the camera");
                }

                const camDist = distance3D(player.location, camBlock.location);
                if (camDist > maxRange) return sendError(player, `Camera Out of Range\n§7Max Range: ${maxRange} blocks`);

                showFazTabOpen(player);
                system.runTimeout(() => {
                    securityCameraSystem.viewYaw.set(player.id, 0);
                    securityCameraSystem.applyView(player, dimension, firstCamera, pcPosStr, true);
                }, 5);
            } catch { }
        }
    });
});
