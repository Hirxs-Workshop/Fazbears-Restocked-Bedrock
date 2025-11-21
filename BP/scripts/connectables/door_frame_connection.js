import { system, world, BlockPermutation } from '@minecraft/server';

const DoorFrameSystem = {
    neighborOffsets: Object.freeze({
        north: { left: [-1, 0, 0], right: [1, 0, 0], above: [0, 1, 0], below: [0, -1, 0] },
        south: { left: [1, 0, 0], right: [-1, 0, 0], above: [0, 1, 0], below: [0, -1, 0] },
        east:  { left: [0, 0, -1], right: [0, 0, 1], above: [0, 1, 0], below: [0, -1, 0] },
        west:  { left: [0, 0, 1], right: [0, 0, -1], above: [0, 1, 0], below: [0, -1, 0] }
    }),

    isDoorFrame(block) {
        if (!block || !block.typeId) return false;
        return block.typeId === 'fr:door_frame';
    },

    getDoorFrameNeighbors(block) {
        const { x, y, z } = block.location;
        const dim = block.dimension;
        const dir = block.permutation.getState('minecraft:cardinal_direction');
        const offsets = this.neighborOffsets[dir] || this.neighborOffsets.north;
        return {
            left: dim.getBlock({ x: x + offsets.left[0], y: y + offsets.left[1], z: z + offsets.left[2] }),
            right: dim.getBlock({ x: x + offsets.right[0], y: y + offsets.right[1], z: z + offsets.right[2] }),
            above: dim.getBlock({ x: x + offsets.above[0], y: y + offsets.above[1], z: z + offsets.above[2] }),
            below: dim.getBlock({ x: x + offsets.below[0], y: y + offsets.below[1], z: z + offsets.below[2] })
        };
    },

    updateDoorFrameConnections(block) {
        if (!this.isDoorFrame(block)) return;
        const direction = block.permutation.getState('minecraft:cardinal_direction');
        const neighbors = this.getDoorFrameNeighbors(block);
        let newStates = { ...block.permutation.getAllStates() };
        let hasChanges = false;
        
        for (const [dir, neighbor] of Object.entries(neighbors)) {
            const shouldConnect = this.isDoorFrame(neighbor) && neighbor.permutation.getState('minecraft:cardinal_direction') === direction;
            const newValue = shouldConnect ? 1 : 0;
            const currentValue = newStates[`fr:${dir}_connection`] || 0;
            
            if (newValue !== currentValue) {
                newStates[`fr:${dir}_connection`] = newValue;
                hasChanges = true;
            }
        }
        
        if (hasChanges) {
            const newPerm = BlockPermutation.resolve(block.typeId, newStates);
            block.setPermutation(newPerm);
        }
    },

    updateSelfAndNeighbors(block) {
        this.updateDoorFrameConnections(block);
        const direction = block.permutation.getState('minecraft:cardinal_direction');
        const neighbors = this.getDoorFrameNeighbors(block);
        for (const neighbor of Object.values(neighbors)) {
            if (this.isDoorFrame(neighbor) && neighbor.permutation.getState('minecraft:cardinal_direction') === direction) {
                this.updateDoorFrameConnections(neighbor);
            }
        }
    }
};

system.beforeEvents.startup.subscribe((eventData) => {
    eventData.blockComponentRegistry.registerCustomComponent('fr:door_frame_connection', {
        onPlace(e) {
            const { block } = e;
            DoorFrameSystem.updateSelfAndNeighbors(block);
        }
    });
});

world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
    if (!block || brokenBlockPermutation.type.id !== 'fr:door_frame') return;
    
    const dim = block.dimension;
    const { x, y, z } = block.location;
    const neighbors = [
        dim.getBlock({ x: x - 1, y, z }),
        dim.getBlock({ x: x + 1, y, z }),
        dim.getBlock({ x, y: y + 1, z }),
        dim.getBlock({ x, y: y - 1, z }),
        dim.getBlock({ x, y, z: z - 1 }),
        dim.getBlock({ x, y, z: z + 1 })
    ];
    
    for (const neighbor of neighbors) {
        if (DoorFrameSystem.isDoorFrame(neighbor)) {
            DoorFrameSystem.updateSelfAndNeighbors(neighbor);
        }
    }
});
