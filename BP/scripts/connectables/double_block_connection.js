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


import { system, world, EquipmentSlot, BlockPermutation } from "@minecraft/server"

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent("fr:double_block", {
        beforeOnPlayerPlace(event) {
            const blockBit = event.permutationToPlace.getState("fr:block_bit");
            
            if (!blockBit || blockBit === 'bottom') {
                const aboveBlock = event.block.above();
                
                if (!aboveBlock || aboveBlock.typeId !== 'minecraft:air') {
                    event.cancel = true;
                    return;
                }
            }
        },
// ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ 
        onPlace({ block }) {
            const blockBit = block.permutation.getState("fr:block_bit");
            
            if (blockBit === 'bottom') {
                const aboveBlock = block.above();
                const direction = block.permutation.getState("minecraft:cardinal_direction");
                let upperPermutation = block.permutation.withState("fr:block_bit", "upper");
                
                if (direction) {
                    upperPermutation = upperPermutation.withState("minecraft:cardinal_direction", direction);
                }
                
                aboveBlock.setPermutation(upperPermutation);
            }
        },
        onPlayerBreak({ block, brokenBlockPermutation }) {
            if (brokenBlockPermutation.getState("fr:block_bit") == 'bottom' && block.above().permutation.getState("fr:block_bit") == 'upper') {
                block.above().setType("minecraft:air")
            }// ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ ㅤ 
            if (brokenBlockPermutation.getState("fr:block_bit") == 'upper' && block.below().permutation.getState("fr:block_bit") == 'bottom') {
                block.below().setType("minecraft:air")
            }
        }
    })
})
