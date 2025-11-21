import { world, BlockPermutation, system } from '@minecraft/server'
import { dynamicToast, customActionbar, ACTIONBAR_CUSTOM_STYLE } from './utils.js'

const HallwayDrawingsComponent = {
    beforeOnPlayerPlace: (event) => {
        const { player, permutationToPlace, block } = event;
        if (!player || !permutationToPlace || !block) return;

        try {
            const paperType = permutationToPlace.getState('fr:paper_type');
            if (paperType !== 1) {
                return;
            }

            const loc = block.location;
            const dimension = block.dimension;
            const cardinalDirection = permutationToPlace.getState('minecraft:cardinal_direction');
            
            let adjacentX = loc.x;
            let adjacentZ = loc.z;
            
            switch (cardinalDirection) {
                case 'north':
                    adjacentX += 1;
                    break;
                case 'south':
                    adjacentX -= 1;
                    break;
                case 'east':
                    adjacentZ += 1;
                    break;
                case 'west':
                    adjacentZ -= 1;
                    break;
                default:
                    return;
            }
            
            const adjacentBlock = dimension.getBlock({ x: adjacentX, y: loc.y, z: adjacentZ });
            if (!adjacentBlock || !adjacentBlock.isAir) {
                event.cancel = true;
                player.sendMessage(dynamicToast(
                    "§l§cInfo:",
                    "§7There is no space to\nplace the block",
                    "textures/fr_ui/deny_icon",
                    "textures/fr_ui/deny_ui"
                ));
                return;
            }
            
        } catch {}
    },

    onPlace: (event) => {
        const { block } = event;
        if (!block) return;

        try {
            const paperType = block.permutation.getState('fr:paper_type');
            if (paperType !== 1) {
                return;
            }

            const loc = block.location;
            const dimension = block.dimension;
            const cardinalDirection = block.permutation.getState('minecraft:cardinal_direction');
            
            let adjacentX = loc.x;
            let adjacentZ = loc.z;
            
            switch (cardinalDirection) {
                case 'north':
                    adjacentX += 1;
                    break;
                case 'south':
                    adjacentX -= 1;
                    break;
                case 'east':
                    adjacentZ += 1;
                    break;
                case 'west':
                    adjacentZ -= 1;
                    break;
                default:
                    return;
            }
            
            const adjacentPermutation = BlockPermutation.resolve('fr:hallway_drawings', {
                'minecraft:cardinal_direction': cardinalDirection,
                'fr:paper_type': 2
            });
            
            const adjacentBlock = dimension.getBlock({ x: adjacentX, y: loc.y, z: adjacentZ });
            if (adjacentBlock && adjacentBlock.isAir) {
                adjacentBlock.setPermutation(adjacentPermutation);
            }
            
        } catch {}
    }
};


system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent(
        "ff:hallway_drawings_component",
        HallwayDrawingsComponent
    );
});

world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const { block } = event;
    if (!block || block.typeId !== 'fr:hallway_drawings') return;
    
    const loc = block.location;
    const dimension = block.dimension;
    const paperType = block.permutation.getState('fr:paper_type');
    
    const directions = [
        { x: 1, z: 0 },
        { x: -1, z: 0 },
        { x: 0, z: 1 },
        { x: 0, z: -1 }
    ];
    
    for (const dir of directions) {
        const adjacentX = loc.x + dir.x;
        const adjacentZ = loc.z + dir.z;
        
        const adjacentBlock = dimension.getBlock({ x: adjacentX, y: loc.y, z: adjacentZ });
        
        if (adjacentBlock && adjacentBlock.typeId === 'fr:hallway_drawings') {
            const adjacentPaperType = adjacentBlock.permutation.getState('fr:paper_type');
            
            if ((paperType === 1 && adjacentPaperType === 2) || 
                (paperType === 2 && adjacentPaperType === 1)) {
                system.run(() => {
                    const airPermutation = BlockPermutation.resolve('minecraft:air');
                    adjacentBlock.setPermutation(airPermutation);
                });
                return;
            }
        }
    }
});
