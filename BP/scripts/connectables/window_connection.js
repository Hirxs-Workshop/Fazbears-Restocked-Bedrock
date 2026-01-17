/**
 * FAZBEAR'S RESTOCKED - BEDROCK
 * ©2025
 * 
 * If you want to modify or use this system as a base, contact the code developer, 
 * Hyrxs (discord: hyrxs), for more information and authorization
 * 
 * DO NOT COPY OR STEAL, ty :>
 *  
*/

import { system, world, BlockPermutation } from '@minecraft/server';

const WindowSystem = {
    neighborOffsets: Object.freeze({
        north: { left: [-1, 0, 0], right: [1, 0, 0], above: [0, 1, 0], below: [0, -1, 0] },
        south: { left: [1, 0, 0], right: [-1, 0, 0], above: [0, 1, 0], below: [0, -1, 0] },
        east:  { left: [0, 0, -1], right: [0, 0, 1], above: [0, 1, 0], below: [0, -1, 0] },
        west:  { left: [0, 0, 1], right: [0, 0, -1], above: [0, 1, 0], below: [0, -1, 0] }
    }),

    isWindow(block) {
        if (!block || !block.typeId) return false;
        return block.typeId === 'fr:modular_office_window';
    },

    getWindowNeighbors(block) {
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

    getConnectionType(hasLeft, hasRight, hasAbove, hasBelow) {
        if (!hasLeft && !hasRight && !hasAbove && !hasBelow) {
            return 'single';
        }
        
        if (!hasLeft && !hasRight && hasAbove && !hasBelow) {
            return 'single_bottom';
        }
        if (!hasLeft && !hasRight && !hasAbove && hasBelow) {
            return 'single_upper';
        }
        if (!hasLeft && !hasRight && hasAbove && hasBelow) {
            return 'single_center';
        }

        if (!hasLeft && hasRight && !hasAbove && hasBelow) {
            return 'corner_upper_left';
        }
        if (hasLeft && !hasRight && !hasAbove && hasBelow) {
            return 'corner_upper_right';
        }
        if (!hasLeft && hasRight && hasAbove && !hasBelow) {
            return 'corner_bottom_left';
        }
        if (hasLeft && !hasRight && hasAbove && !hasBelow) {
            return 'corner_bottom_right';
        }
        
        if (!hasLeft && hasRight && hasAbove && hasBelow) {
            return 'left';
        }
        if (hasLeft && !hasRight && hasAbove && hasBelow) {
            return 'right';
        }
        if (hasLeft && hasRight && !hasAbove && hasBelow) {
            return 'middle_upper';
        }
        if (hasLeft && hasRight && hasAbove && !hasBelow) {
            return 'middle_bottom';
        }
        
        if (hasLeft && hasRight && hasAbove && hasBelow) {
            return 'center';
        }
        
        return 'single';
    },

    updateWindowConnections(block) {
        if (!this.isWindow(block)) return;
        
        const direction = block.permutation.getState('minecraft:cardinal_direction');
        const neighbors = this.getWindowNeighbors(block);
        
        const hasLeft = this.isWindow(neighbors.left) && 
                       neighbors.left.permutation.getState('minecraft:cardinal_direction') === direction;
        const hasRight = this.isWindow(neighbors.right) && 
                        neighbors.right.permutation.getState('minecraft:cardinal_direction') === direction;
        const hasAbove = this.isWindow(neighbors.above) && 
                        neighbors.above.permutation.getState('minecraft:cardinal_direction') === direction;
        const hasBelow = this.isWindow(neighbors.below) && 
                        neighbors.below.permutation.getState('minecraft:cardinal_direction') === direction;
        
        const newConnectionType = this.getConnectionType(hasLeft, hasRight, hasAbove, hasBelow);
        const currentConnectionType = block.permutation.getState('fr:connection_type');
        
        if (newConnectionType !== currentConnectionType) {
            const newStates = { ...block.permutation.getAllStates() };
            newStates['fr:connection_type'] = newConnectionType;
            const newPerm = BlockPermutation.resolve(block.typeId, newStates);
            block.setPermutation(newPerm);
        }
    },

    updateSelfAndNeighbors(block) {
        this.updateWindowConnections(block);
        
        const direction = block.permutation.getState('minecraft:cardinal_direction');
        const neighbors = this.getWindowNeighbors(block);
        
        for (const neighbor of Object.values(neighbors)) {
            if (this.isWindow(neighbor) && 
                neighbor.permutation.getState('minecraft:cardinal_direction') === direction) {
                this.updateWindowConnections(neighbor);
            }
        }
    }
};

system.beforeEvents.startup.subscribe((eventData) => {
    eventData.blockComponentRegistry.registerCustomComponent('fr:window_connection', {
        onPlace(e) {
            const { block } = e;
            WindowSystem.updateSelfAndNeighbors(block);
        }
    });
});

world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
    if (!block || brokenBlockPermutation.type.id !== 'fr:modular_office_window') return;
    
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
        if (WindowSystem.isWindow(neighbor)) {
            WindowSystem.updateSelfAndNeighbors(neighbor);
        }
    }
});
