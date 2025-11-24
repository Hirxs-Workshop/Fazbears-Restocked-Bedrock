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



import { world, system } from '@minecraft/server';
import { securityCameraSystem } from './camera_system/security_camera_system.js';
import { dynamicToast, showCameraLoading } from './utils.js';

function getPcDataFromItem(itemStack) {
    try {
        const lore = itemStack.getLore();
        if (!lore || lore.length === 0) return null;
        
        for (const line of lore) {
            if (line.startsWith('§7PC:§r ')) {
                const data = line.substring(8);
                const [pcPosStr, dimId] = data.split('|');
                if (pcPosStr && dimId) {
                    return { pcPosStr, dimId };
                }
            }
        }
    } catch {}
    return null;
}

function setPcDataToItem(itemStack, pcPosStr, dimId, pcLocation) {
    try {
        const lore = [
            `§7PC:§r ${pcPosStr}|${dimId}`,
            `§7Location:§r ${pcLocation.x}, ${pcLocation.y}, ${pcLocation.z}`,
            `§7Dimension:§r ${dimId}`,
            `§a✓ Linked`
        ];
        itemStack.setLore(lore);
        return true;
    } catch {
        return false;
    }
}

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
    itemComponentRegistry.registerCustomComponent('fr:faz_tab_component', {
        onUseOn: (event) => {
            const { source: player, block, itemStack } = event;
            if (!player || !block || !itemStack) return;
            
            if (block.typeId !== 'fr:old_pc' && block.typeId !== 'fr:black_old_pc') return;
            
            if (!player.isSneaking) return;
            
            try {
                const pcPosStr = securityCameraSystem.locStr(securityCameraSystem.posOf(block));
                const dimId = block.dimension.id;
                const pcLocation = block.location;
                
                const camList = securityCameraSystem.connections.get(pcPosStr);
                if (!camList || camList.length === 0) {
                    player.sendMessage(dynamicToast(
                        "§l§cERROR",
                        "§cThis PC has no cameras linked",
                        "textures/fr_ui/deny_icon",
                        "textures/fr_ui/deny_ui"
                    ));
                    return;
                }
                
                const slot = player.selectedSlotIndex;
                const eq = player.getComponent('minecraft:equippable');
                const currentItem = eq?.getEquipment('Mainhand');
                
                if (!currentItem || currentItem.typeId !== 'fr:faz-tab') return;
                
                const newItem = currentItem.clone();
                if (setPcDataToItem(newItem, pcPosStr, dimId, pcLocation)) {
                    eq.setEquipment('Mainhand', newItem);
                    
                    player.sendMessage(dynamicToast(
                        "§l§qSUCCESS",
                        `§qFaz-Tab linked to PC\n§7Position: ${pcLocation.x}, ${pcLocation.y}, ${pcLocation.z}`,
                        "textures/fr_ui/approve_icon",
                        "textures/fr_ui/approve_ui"
                    ));
                    
                    player.playSound('random.click', { pitch: 1.5, volume: 1.0 });
                }
            } catch {}
        },
        
        onUse: (event) => {
            const { source: player, itemStack } = event;
            if (!player || !itemStack) return;
            
            if (player.isSneaking) return;// ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ
            
            try {
                const pcData = getPcDataFromItem(itemStack);
                if (!pcData) {
                    player.sendMessage(dynamicToast(
                        "§l§cERROR",
                        "§cFaz-Tab not linked to any PC\n§7Sneak + right-click on a PC to link",
                        "textures/fr_ui/deny_icon",
                        "textures/fr_ui/deny_ui"
                    ));
                    return;
                }
                
                const { pcPosStr, dimId } = pcData;
                const dimension = world.getDimension(dimId);
                if (!dimension) {
                    player.sendMessage(dynamicToast(
                        "§l§cERROR",
                        "§cLinked dimension not found",
                        "textures/fr_ui/deny_icon",
                        "textures/fr_ui/deny_ui"
                    ));
                    return;
                }
                
                const pcBlock = securityCameraSystem.blockFromLocStr(dimension, pcPosStr);
                if (!pcBlock || (pcBlock.typeId !== 'fr:old_pc' && pcBlock.typeId !== 'fr:black_old_pc')) {
                    player.sendMessage(dynamicToast(
                        "§l§cERROR",
                        "§cLinked PC not found or was destroyed",
                        "textures/fr_ui/deny_icon",
                        "textures/fr_ui/deny_ui"
                    ));
                    return;
                }
                
                const camList = securityCameraSystem.connections.get(pcPosStr);
                if (!camList || camList.length === 0) {
                    player.sendMessage(dynamicToast(
                        "§l§cERROR",
                        "§cThis PC has no cameras linked",
                        "textures/fr_ui/deny_icon",
                        "textures/fr_ui/deny_ui"
                    ));
                    return;
                }
                
                const firstCamera = camList[0];
                if (!firstCamera) {
                    player.sendMessage(dynamicToast(
                        "§l§cERROR",
                        "§cNo valid camera found",
                        "textures/fr_ui/deny_icon",
                        "textures/fr_ui/deny_ui"
                    ));
                    return;
                }
                
                showCameraLoading(player);
                
                system.runTimeout(() => {
                    securityCameraSystem.viewYaw.set(player.id, 0);
                    securityCameraSystem.applyView(player, dimension, firstCamera, pcPosStr, true);
                }, 0);
            } catch {}
        }
    });
});
