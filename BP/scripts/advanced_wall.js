import { world, system, Direction, ItemStack, EquipmentSlot, GameMode, BlockPermutation } from "@minecraft/server"

const plants = {
    "fr:fnaf1_bathroom_wall": {
        value: "fnaf1_bathroom_wall",
        sound: "block.lantern.break",
    },
    "fr:fnaf1_bathroom_wall_bottom": {
        value: "fnaf1_bathroom_wall_bottom",
        sound: "block.lantern.break",
    },
    "fr:fnaf1_bathroom_wall_middle": {
        value: "fnaf1_bathroom_wall_middle",
        sound: "block.lantern.break",
    },
    "fr:fnaf1_bathroom_wall_top": {
        value: "fnaf1_bathroom_wall_top",
        sound: "block.lantern.break",
    },
    "fr:fnaf1_wall_down": {
        value: "fnaf1_wall_down",
        sound: "block.lantern.break",
    },
    "fr:fnaf1_dark_wall_down": {
        value: "fnaf1_dark_wall_down",
        sound: "block.lantern.break",
    },
    "fr:fnaf1_backstage_wall_middle": {
        value: "fnaf1_backstage_wall_middle",
        sound: "block.lantern.break",
    },
    "fr:fnaf1_wall_middle_tiles": {
        value: "fnaf1_wall_middle_tiles",
        sound: "block.lantern.break",
    },
    "fr:fnaf1_wall_top_tiles": {
        value: "fnaf1_wall_top_tiles",
        sound: "block.lantern.break",
    },
    "fr:fnaf1_wall_top_tiles_black": {
        value: "fnaf1_wall_top_tiles_black",
        sound: "block.lantern.break",
    },
    "fr:fnaf1_wall_up": {
        value: "fnaf1_wall_up",
        sound: "block.lantern.break",
    },
    "fr:stage_wall_down": {
        value: "stage_wall_down",
        sound: "block.lantern.break",
    },
    "fr:stage_wall_middle_tiles": {
        value: "stage_wall_middle_tiles",
        sound: "block.lantern.break",
    },
    "fr:stage_wall_middle": {
        value: "stage_wall_middle",
        sound: "block.lantern.break",
    },
    "fr:stage_wall_up": {
        value: "stage_wall_up",
        sound: "block.lantern.break",
    }
};

const isPotOccupied = (block, face) => block.permutation.getState(`wiki:pot_${face}_plant`) !== "none";

const setPotPlant = (block, face, plant) => block.setPermutation(block.permutation.withState(`wiki:pot_${face}_plant`, plant))

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent("fr:advanced_wall", {
        onPlayerInteract({ block, dimension, face, player }) {
            if (!player) return;

            const equippable = player.getComponent("minecraft:equippable");
            if (!equippable) return;

            const mainhand = equippable.getEquipmentSlot(EquipmentSlot.Mainhand);

            if (mainhand.hasItem()) {
                const plant = plants[mainhand.typeId];
                if (!plant) return;
                setPotPlant(block, face, plant.value);
                dimension.playSound(plant.sound, block.center(), { volume: 0.5 });
            } else if (!mainhand.hasItem() && isPotOccupied(block, face)) {
                const plantValue = block.permutation.getState(`wiki:pot_${face}_plant`);
                const plantId = Object.keys(plants).find((key) => plants[key].value === plantValue);
                setPotPlant(block, face, "none");
                dimension.playSound("random.pop", block.center());

                mainhand.setItem(new ItemStack(plantId));
            }
        },
        onPlayerBreak({ block, brokenBlockPermutation, dimension }) {
            const states = brokenBlockPermutation.getAllStates();

            const storedPlants = Object.entries(states)
                .filter(([state, value]) => state.startsWith("wiki:pot") && value !== "none")
                .map(([state, value]) => value);

            if (storedPlants.length === 0) return;

            for (const plant of storedPlants) {
                const plantId = Object.keys(plants).find((key) => plants[key].value === plant);

                dimension.spawnItem(new ItemStack(plantId), block.center());
            }
        }
    })
})