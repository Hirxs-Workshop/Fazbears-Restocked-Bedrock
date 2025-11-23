import { system, world, EquipmentSlot, BlockPermutation } from "@minecraft/server"

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent("fr:shelf_supply_closet", {
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
            }
            if (brokenBlockPermutation.getState("fr:block_bit") == 'upper' && block.below().permutation.getState("fr:block_bit") == 'bottom') {
                block.below().setType("minecraft:air")
            }
        }
    })
})