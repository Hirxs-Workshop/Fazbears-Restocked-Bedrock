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
    blockComponentRegistry.registerCustomComponent("fr:triple_block", {
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
        onPlace({ block }) {
            const blockBit = block.permutation.getState("fr:block_bit");

            if (blockBit === 'bottom') {
                const aboveBlock1 = block.above(1);
                const aboveBlock2 = block.above(2);
                const direction = block.permutation.getState("minecraft:cardinal_direction");
                let middlePermutation = block.permutation.withState("fr:block_bit", "middle");
                let upperPermutation = block.permutation.withState("fr:block_bit", "upper");

                if (direction) {
                    middlePermutation = middlePermutation.withState("minecraft:cardinal_direction", direction);
		    upperPermutation = upperPermutation.withState("minecraft:cardinal_direction", direction);
                }
                aboveBlock1.setPermutation(middlePermutation);
                aboveBlock2.setPermutation(upperPermutation);
            }
        },
        onPlayerBreak({ block, brokenBlockPermutation }) {
            if (brokenBlockPermutation.getState("fr:block_bit") == 'bottom' && block.above().permutation.getState("fr:block_bit") == 'middle' && block.above(2).permutation.getState("fr:block_bit") == 'upper') {
                block.above().setType("minecraft:air")
                block.above(1).setType("minecraft:air")
                block.above(2).setType("minecraft:air")
            }
            if (brokenBlockPermutation.getState("fr:block_bit") == 'middle' && block.below().permutation.getState("fr:block_bit") == 'bottom' && block.above().permutation.getState("fr:block_bit") == 'upper') {
                block.below().setType("minecraft:air")
                block.above().setType("minecraft:air")
            }
            if (brokenBlockPermutation.getState("fr:block_bit") == 'upper' && block.below().permutation.getState("fr:block_bit") == 'middle' && block.below(2).permutation.getState("fr:block_bit") == 'bottom') {
                block.below().setType("minecraft:air")
                block.below(1).setType("minecraft:air")
                block.below(2).setType("minecraft:air")
            }
        }
    })
})