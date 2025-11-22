import { system, world, EquipmentSlot, BlockPermutation } from "@minecraft/server"

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent("fr:shelf_supply_closet", {
        onPlace({ block, dimension }) {
            if (block.permutation.getState("fr:block_bit") == 'bottom' && block.above().isAir)
                block.above().setPermutation(block.permutation.withState("fr:block_bit", "upper"))

        },
        onPlayerBreak({ block, brokenBlockPermutation }) {
            if ( brokenBlockPermutation.getState("fr:block_bit") == 'bottom' && block.above().permutation.getState("fr:block_bit") == 'upper') {
                block.above().setType("minecraft:air")
            }
            if ( brokenBlockPermutation.getState("fr:block_bit") == 'upper' && block.below().permutation.getState("fr:block_bit") == 'bottom') {
                block.below().setType("minecraft:air")
            }
        }
    })
})