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


import { world, system, BlockPermutation, ItemStack, EquipmentSlot } from '@minecraft/server'

const headMapping = {
    'fr:freddy_beta_head': 'fr:backstage_shelf_freddy_head',
    'fr:bonnie_head': 'fr:backstage_shelf_bonnie_head',
    'fr:chica_head': 'fr:backstage_shelf_chica_head'
};

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent('fr:backstage_shelf_head_placer', {
        onPlayerInteract: (e) => {
            const { block, player } = e;
            if (!block || !player) return;

            if (player.isSneaking) return;

            try {
                const eq = player.getComponent('minecraft:equippable');
                const heldItem = eq?.getEquipment(EquipmentSlot.Mainhand);

                if (!heldItem) return;

                const shelfBlock = headMapping[heldItem.typeId];
                if (!shelfBlock) return;

                const currentDirection = block.permutation.getState('minecraft:cardinal_direction');

                const hasVariants = shelfBlock === 'fr:backstage_shelf_freddy_head';
                const newPermutation = hasVariants 
                    ? BlockPermutation.resolve(shelfBlock, {
                        'minecraft:cardinal_direction': currentDirection,
                        'fr:variants': 0
                    })
                    : BlockPermutation.resolve(shelfBlock, {
                        'minecraft:cardinal_direction': currentDirection
                    });

                block.setPermutation(newPermutation);

                try {
                    const gameMode = player.getGameMode?.();
                    if (gameMode !== 'creative') {
                        if (heldItem.amount > 1) {
                            heldItem.amount -= 1;
                            eq.setEquipment(EquipmentSlot.Mainhand, heldItem);
                        } else {
                            eq.setEquipment(EquipmentSlot.Mainhand, undefined);
                        }
                    }
                } catch {}

                try {
                    player.playSound('dig.stone', { volume: 1.0 });
                } catch {}

            } catch {}
        }
    });

    blockComponentRegistry.registerCustomComponent('fr:backstage_shelf_head_remover', {
        onPlayerInteract: (e) => {
            const { block, player } = e;
            if (!block || !player) return;

            if (!player.isSneaking) return;

            try {
                const blockType = block.typeId;
                let itemToGive = null;

                for (const [itemId, shelfBlockId] of Object.entries(headMapping)) {
                    if (blockType === shelfBlockId) {
                        itemToGive = itemId;
                        break;
                    }
                }

                if (!itemToGive) return;

                const currentDirection = block.permutation.getState('minecraft:cardinal_direction');

                const newPermutation = BlockPermutation.resolve('fr:backstage_shelf', {
                    'minecraft:cardinal_direction': currentDirection
                });

                block.setPermutation(newPermutation);

                try {
                    const itemStack = new ItemStack(itemToGive, 1);
                    const inv = player.getComponent('minecraft:inventory');
                    const container = inv?.container;
                    
                    if (container) {
                        container.addItem(itemStack);
                    }
                } catch {}

                try {
                    player.playSound('dig.stone', { volume: 1.0 });
                } catch {}

            } catch {}
        }
    });
});
